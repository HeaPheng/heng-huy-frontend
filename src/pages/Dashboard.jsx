  import { useEffect, useMemo, useState } from "react";
  import { Link } from "react-router-dom";
  import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } from "recharts";
  import api from "../api";
  import DueReminderBox from "../components/DueReminderBox";

  export default function Dashboard() {
    const [data, setData] = useState(null);
    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("overall");
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("today");

    const [reminderTasks, setReminderTasks] = useState([]);
    const [showReminderBox, setShowReminderBox] = useState(true);
    const [payDayStaff, setPayDayStaff] = useState([]);
    const [showPayDayReminder, setShowPayDayReminder] = useState(() => {
      return localStorage.getItem('lastPayDayReminderDate') !== new Date().toDateString();
    });

    const fetchReminderTasks = async () => {
      try {
        const res = await api.get(`/tasks?t=${Date.now()}`);
        const list = Array.isArray(res.data) ? res.data : [];
        setReminderTasks(list.filter(isDueNow));
      } catch (err) {
        console.error("Failed to load reminder tasks:", err);
      }
    };

    useEffect(() => {
      async function loadDashboard() {
        try {
          setError("");

          const salesRes = await api.get(
            `/dashboard/today?period=${period}&t=${Date.now()}`
          );
          setData(salesRes.data);

          const productsRes = await api.get(`/products?t=${Date.now()}`);
          const productsData = productsRes.data;

          const productList = Array.isArray(productsData)
            ? productsData
            : Array.isArray(productsData.data)
              ? productsData.data
              : [];

          setProducts(productList);
        } catch (err) {
          console.error("Dashboard failed:", err);
          setError("មិនអាចទាញយកទិន្នន័យ Dashboard បានទេ");
        }
      }

      loadDashboard();
    }, [period]);

    useEffect(() => {
      fetchReminderTasks();

      // Check staff pay days
      api.get("/staff").then(res => {
        const today = new Date().getDate();
        const list = Array.isArray(res.data) ? res.data : [];
        setPayDayStaff(list.filter(s => s.pay_day === today));
      }).catch(() => {});

      const interval = setInterval(() => {
        fetchReminderTasks();
        setShowReminderBox(true);
      }, 600000);

      return () => clearInterval(interval);
    }, []);

    const rawSales = data?.sales || [];

    const sales = useMemo(() => {
      return rawSales.filter((sale) => !sale.is_merged && !isMergedInvoice(sale));
    }, [rawSales]);

    const isOverall = selectedProductId === "overall";

    const selectedProduct = useMemo(() => {
      if (isOverall) return null;

      return products.find(
        (product) => String(product.id) === String(selectedProductId)
      );
    }, [products, selectedProductId, isOverall]);

    const filteredSales = useMemo(() => {
      if (isOverall) return sales;
      if (!selectedProduct) return [];

      return sales.filter((sale) =>
        (sale.items || []).some(
          (item) => String(item.product_id) === String(selectedProduct.id)
        )
      );
    }, [sales, selectedProduct, isOverall]);

    const summary = useMemo(() => {
      let quantityKg = 0;
      let grossSalesAmount = 0;
      let receivedAmount = 0;
      let depositAmount = 0;
      let debtAmount = 0;
      let unpaidAmount = 0;

      const invoiceIds = new Set();
      let paidCount = 0;
      let debtCount = 0;
      let unpaidCount = 0;

      filteredSales.forEach((sale) => {
        const selectedSubtotal = getSelectedSubtotal(sale, isOverall, selectedProduct);
        if (selectedSubtotal <= 0) return;

        const finance = getAllocatedFinance(sale, selectedSubtotal);
        const status = calculatePaymentStatus(selectedSubtotal, finance.paidAmount);

        invoiceIds.add(sale.id);
        grossSalesAmount += selectedSubtotal;
        receivedAmount += finance.paidAmount;
        debtAmount += finance.balanceAmount;

        if (status === "paid") {
          paidCount += 1;
        } else if (status === "debt") {
          debtCount += 1;
          depositAmount += finance.paidAmount;
        } else {
          unpaidCount += 1;
          unpaidAmount += finance.balanceAmount;
        }

        (sale.items || []).forEach((item) => {
          const matched =
            isOverall || String(item.product_id) === String(selectedProduct?.id);

          if (matched) quantityKg += Number(item.quantity_kg || 0);
        });
      });

      return {
        quantityKg,
        grossSalesAmount,
        receivedAmount,
        depositAmount,
        debtAmount,
        unpaidAmount,
        invoiceCount: invoiceIds.size,
        paidCount,
        debtCount,
        unpaidCount,
      };
    }, [filteredSales, isOverall, selectedProduct]);

    const stockKg = useMemo(() => {
      if (!isOverall) return Number(selectedProduct?.stock_kg || 0);

      return products.reduce(
        (sum, product) => sum + Number(product.stock_kg || 0),
        0
      );
    }, [products, selectedProduct, isOverall]);

    const incomeCompare = useMemo(() => {
      const current = Number(summary.receivedAmount || 0);
      const previous = Number(
        data?.income?.previous_received ??
        data?.income?.previous_paid ??
        data?.income?.previous_with_deposit ??
        data?.income?.previous ??
        0
      );
      const difference = current - previous;
      const percent =
        previous > 0
          ? Math.round((difference / previous) * 100)
          : current > 0
            ? 100
            : 0;

      return { current, previous, difference, percent };
    }, [data, summary.receivedAmount]);

    const mostSoldProducts = useMemo(() => {
      const summaryMap = new Map();

      sales.forEach((sale) => {
        (sale.items || []).forEach((item) => {
          const productId = String(item.product_id);
          const product =
            products.find((p) => String(p.id) === productId) || item.product;
          const subtotal = Number(item.subtotal || 0);
          const finance = getAllocatedFinance(sale, subtotal);

          const current = summaryMap.get(productId) || {
            product,
            quantityKg: 0,
            grossSalesAmount: 0,
            receivedAmount: 0,
            debtAmount: 0,
          };

          current.quantityKg += Number(item.quantity_kg || 0);
          current.grossSalesAmount += subtotal;
          current.receivedAmount += finance.paidAmount;
          current.debtAmount += finance.balanceAmount;

          summaryMap.set(productId, current);
        });
      });

      return Array.from(summaryMap.values()).sort(
        (a, b) => b.quantityKg - a.quantityKg
      );
    }, [sales, products]);

    const barChartData = useMemo(() => {
      return mostSoldProducts.map((item) => ({
        name: item.product ? getProductKhmerName(item.product) : "-",
        quantity: Number(item.quantityKg || 0),
        received: Number(item.receivedAmount || 0),
        debt: Number(item.debtAmount || 0),
      }));
    }, [mostSoldProducts]);

    const lineChartData = useMemo(() => {
      const grouped = new Map();

      filteredSales.forEach((sale) => {
        const date = formatDateShort(sale.created_at);
        const current = grouped.get(date) || {
          date,
          income: 0,
          debt: 0,
          quantity: 0,
        };

        (sale.items || []).forEach((item) => {
          const matched =
            isOverall || String(item.product_id) === String(selectedProduct?.id);

          if (matched) {
            const subtotal = Number(item.subtotal || 0);
            const finance = getAllocatedFinance(sale, subtotal);

            current.income += finance.paidAmount;
            current.debt += finance.balanceAmount;
            current.quantity += Number(item.quantity_kg || 0);
          }
        });

        grouped.set(date, current);
      });

      return Array.from(grouped.values());
    }, [filteredSales, isOverall, selectedProduct]);

    const latestInvoices = useMemo(() => {
      return [...filteredSales]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
    }, [filteredSales]);

    if (error) {
      return (
        <div className="p-6 font-bold text-red-600 dark:text-red-400">
          {error}
        </div>
      );
    }

    if (!data) {
      return (
        <div className="p-6 font-bold text-slate-900 dark:text-white">
          កំពុងទាញយកទិន្នន័យ...
        </div>
      );
    }

    return (
      <main className="min-h-screen bg-[#fbfdf8] p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 md:p-7">
        {showReminderBox && reminderTasks.length > 0 && (
          <DueReminderBox
            tasks={reminderTasks}
            onClose={() => setShowReminderBox(false)}
            onEnough={() => setShowReminderBox(false)}
            onOpen={(task) => {
              const query =
                task.sale?.invoice_no ||
                task.customer?.name ||
                task.title ||
                "";

              window.location.href = `/tasks?tab=debt&q=${encodeURIComponent(query)}`;
            }}
          />
        )}

        {showPayDayReminder && payDayStaff.length > 0 && (
          <PayDayReminderModal
            staff={payDayStaff}
            onClose={() => {
              setShowPayDayReminder(false);
              localStorage.setItem('lastPayDayReminderDate', new Date().toDateString());
            }}
          />
        )}

        <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
              ផ្ទាំងគ្រប់គ្រងស្តុក
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              កំពុងបង្ហាញ៖{" "}
              {isOverall
                ? "សរុបទាំងអស់"
                : selectedProduct
                  ? getProductKhmerName(selectedProduct)
                  : "-"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-row">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white lg:w-[190px]"
            >
              <option value="today">ថ្ងៃនេះ</option>
              <option value="weekly">ប្រចាំសប្តាហ៍</option>
              <option value="monthly">ប្រចាំខែ</option>
            </select>

            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white lg:w-[280px]"
            >
              <option value="overall">សរុបទាំងអស់</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductKhmerName(product)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="ស្តុកសរុប"
            value={formatKg(stockKg)}
            note={isOverall ? "ស្តុកសរុបគ្រប់ផលិតផល" : "ស្តុកនៅសល់បច្ចុប្បន្ន"}
            icon="📦"
            tone="green"
          />

          <SummaryCard
            title="ចំណូលលក់ថ្ងៃនេះ"
            value={formatRiel(summary.receivedAmount)}
            note={`បានទូទាត់ ${formatRiel(summary.depositAmount)} | នៅជំពាក់ ${formatRiel(
              summary.debtAmount
            )} | លក់សរុប ${formatRiel(summary.grossSalesAmount)}`}
            icon="💰"
            tone="yellow"
          />

          <SummaryCard
            title="ចំណូលពីម្សិលមិញ"
            value={formatRiel(incomeCompare.previous)}
            note={`${incomeCompare.difference >= 0 ? "កើនឡើង" : "ថយចុះ"} ${formatRiel(
              Math.abs(incomeCompare.difference)
            )} (${Math.abs(incomeCompare.percent)}%) ពីម្សិលមិញ`}
            icon={incomeCompare.difference >= 0 ? "📈" : "📉"}
            tone={incomeCompare.difference >= 0 ? "green" : "red"}
          />

          <SummaryCard
            title="ចំនួនវិក្កយបត្រ"
            value={summary.invoiceCount}
            note={`${summary.paidCount} បានទូទាត់ | ${summary.debtCount} ជំពាក់ | ${summary.unpaidCount} មិនទាន់ទូទាត់`}
            icon="🧾"
            tone="white"
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickLink to="/stock" label="បន្ថែមស្តុក" icon="＋" />
          <QuickLink to="/sell" label="លក់" icon="🛒" />
          <QuickLink to="/sales" label="ប្រវត្តិវិក្កយបត្រ" icon="🧾" active />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartCard
            title="លក់ច្រើនបំផុតទៅតិចបំផុត"
            subtitle="បង្ហាញបរិមាណលក់តាមផលិតផល"
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={barChartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-8}
                  textAnchor="end"
                  height={55}
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <YAxis
                  width={58}
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatCompactNumber}
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <Tooltip
                  cursor={{ fill: "rgba(34,197,94,0.08)" }}
                  content={<CustomTooltip type="quantity" />}
                />
                <Bar
                  dataKey="quantity"
                  name="បរិមាណលក់"
                  radius={[10, 10, 0, 0]}
                  className="fill-green-500 dark:fill-emerald-400"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="ចំណូលតាមពេលវេលា"
            subtitle="ចំណូលនេះគិតតែប្រាក់ដែលបានទទួលពិត"
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={lineChartData}
                margin={{ top: 10, right: 24, left: 22, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <YAxis
                  width={76}
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatCompactRiel}
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <Tooltip content={<CustomTooltip type="income" />} />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="ចំណូល"
                  strokeWidth={4}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                  className="stroke-green-500 dark:stroke-emerald-400"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="mt-8 rounded-2xl border border-green-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                វិក្កយបត្រថ្មីៗ
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                បង្ហាញចំណូល ប្រាក់កក់ និងបំណុលនៅសល់
              </p>
            </div>
            <Link
              to="/sales"
              className="shrink-0 font-bold text-green-700 dark:text-green-400"
            >
              មើលទាំងអស់ →
            </Link>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-green-100 text-left text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <th className="py-3">លេខវិក្កយបត្រ</th>
                  <th className="py-3">អតិថិជន</th>
                  <th className="py-3">កាលបរិច្ឆេទ</th>
                  <th className="py-3">ផលិតផល</th>
                  <th className="py-3">បរិមាណ</th>
                  <th className="py-3 text-right">សរុប</th>
                  <th className="py-3 text-right">បានបង់/កក់</th>
                  <th className="py-3 text-right">នៅសល់</th>
                  <th className="py-3">ស្ថានភាព</th>
                </tr>
              </thead>

              <tbody>
                {latestInvoices.length > 0 ? (
                  latestInvoices.map((sale) => (
                    <LatestInvoiceRow
                      key={sale.id}
                      sale={sale}
                      isOverall={isOverall}
                      selectedProduct={selectedProduct}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      className="py-8 text-center font-bold text-slate-500 dark:text-slate-400"
                    >
                      មិនមានវិក្កយបត្រសម្រាប់ជម្រើសនេះទេ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {latestInvoices.length > 0 ? (
              latestInvoices.map((sale) => (
                <LatestInvoiceMobileCard
                  key={sale.id}
                  sale={sale}
                  isOverall={isOverall}
                  selectedProduct={selectedProduct}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                មិនមានវិក្កយបត្រសម្រាប់ជម្រើសនេះទេ
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  function normalizeDate(value) {
    if (!value) return "";

    const str = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return str.slice(0, 10);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function todayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function isDueNow(task) {
    if (task.status === "done" || !task.due_date) return false;

    const dueDate = normalizeDate(task.due_date);
    const today = todayDate();

    if (dueDate < today) return true;

    if (dueDate === today && task.due_time) {
      const nowTime = new Date().toTimeString().slice(0, 5);
      return String(task.due_time).slice(0, 5) <= nowTime;
    }

    return dueDate === today;
  }

  function LatestInvoiceRow({ sale, isOverall, selectedProduct }) {
    const invoice = getInvoiceDisplay(sale, isOverall, selectedProduct);

    return (
      <tr className="border-b border-green-100 last:border-b-0 dark:border-slate-800">
        <td className="py-3 font-bold text-slate-900 dark:text-white">
          {sale.invoice_no}
        </td>
        <td className="py-3 text-slate-700 dark:text-slate-300">
          {sale.customer?.name || "-"}
        </td>
        <td className="py-3 text-slate-700 dark:text-slate-300">
          {formatDate(sale.created_at)}
        </td>
        <td className="py-3 text-slate-700 dark:text-slate-300">
          {invoice.productLabel}
        </td>
        <td className="py-3 text-slate-700 dark:text-slate-300">
          {formatKg(invoice.qty)}
        </td>
        <td className="py-3 text-right font-black text-slate-900 dark:text-white">
          {formatRiel(invoice.total)}
        </td>
        <td className="py-3 text-right font-black text-green-700 dark:text-green-400">
          {formatRiel(invoice.paid)}
        </td>
        <td className="py-3 text-right font-black text-red-700 dark:text-red-400">
          {formatRiel(invoice.balance)}
        </td>
        <td className="py-3">
          <PaymentStatusBadge status={invoice.status} />
        </td>
      </tr>
    );
  }

  function LatestInvoiceMobileCard({ sale, isOverall, selectedProduct }) {
    const invoice = getInvoiceDisplay(sale, isOverall, selectedProduct);

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-black text-slate-950 dark:text-white">
              {sale.invoice_no}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {formatDate(sale.created_at)}
            </p>
          </div>
          <PaymentStatusBadge status={invoice.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <InfoBox label="អតិថិជន" value={sale.customer?.name || "-"} />
          <InfoBox label="ផលិតផល" value={invoice.productLabel} />
        </div>

        <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <MoneyBox label="សរុប" value={formatRiel(invoice.total)} />
          <MoneyBox label="បានបង់" value={formatRiel(invoice.paid)} green />
          <MoneyBox label="នៅសល់" value={formatRiel(invoice.balance)} red={invoice.balance > 0} />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-600 dark:text-slate-300">
          <span>{formatKg(invoice.qty)}</span>
          <span>{paymentLabel(sale.payment_method)}</span>
        </div>
      </div>
    );
  }

  function InfoBox({ label, value }) {
    return (
      <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
        <p className="text-xs font-black text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words font-black text-slate-950 dark:text-white">
          {value}
        </p>
      </div>
    );
  }

  function MoneyBox({ label, value, green, red }) {
    return (
      <div className="border-r border-slate-200 bg-white p-3 last:border-r-0 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p
          className={`mt-1 text-sm font-black ${green
            ? "text-green-700 dark:text-green-400"
            : red
              ? "text-red-700 dark:text-red-400"
              : "text-slate-950 dark:text-white"
            }`}
        >
          {value}
        </p>
      </div>
    );
  }

  function PaymentStatusBadge({ status }) {
    const className =
      status === "paid"
        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
        : status === "debt"
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300"
          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>
        {paymentStatusLabel(status)}
      </span>
    );
  }

  function QuickLink({ to, label, icon, active }) {
    return (
      <Link
        to={to}
        className={`flex min-h-[76px] items-center justify-between rounded-2xl border p-5 text-lg font-black shadow-sm transition active:scale-[0.99] md:min-h-[84px] md:p-6 md:text-xl ${active
          ? "border-green-600 bg-green-50 text-slate-950 dark:border-green-700 dark:bg-green-950/30 dark:text-white"
          : "border-green-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          }`}
      >
        <span>{label}</span>
        <span className="text-3xl">{icon}</span>
      </Link>
    );
  }

  function SummaryCard({ title, value, note, icon, tone }) {
    const toneClass =
      tone === "yellow"
        ? "border-yellow-200 bg-[#fff6ce] dark:border-yellow-700/60 dark:bg-yellow-950/30"
        : tone === "red"
          ? "border-red-200 bg-red-50 dark:border-red-700/60 dark:bg-red-950/30"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 dark:border-blue-700/60 dark:bg-blue-950/30"
            : tone === "green"
              ? "border-green-200 bg-[#f8fff8] dark:border-green-800/70 dark:bg-green-950/20"
              : "border-green-100 bg-white dark:border-slate-800 dark:bg-slate-900";

    return (
      <div className={`min-h-[145px] rounded-[18px] border p-4 shadow-sm md:p-5 ${toneClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-600 dark:text-slate-300 md:text-base">
              {title}
            </p>
            <h3 className="mt-3 break-words text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
              {value}
            </h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-400 md:text-sm">
              {note}
            </p>
          </div>
          <div className="shrink-0 text-2xl md:text-3xl">{icon}</div>
        </div>
      </div>
    );
  }

  function ChartCard({ title, subtitle, children }) {
    return (
      <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-white md:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    );
  }

  function CustomTooltip({ active, payload, label, type }) {
    if (!active || !payload || payload.length === 0) return null;

    const value = Number(payload[0]?.value || 0);

    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-950">
        <p className="mb-1 font-black text-slate-900 dark:text-white">{label}</p>
        <p className="font-bold text-green-700 dark:text-green-400">
          {type === "income" ? formatRiel(value) : formatKg(value)}
        </p>
      </div>
    );
  }

  function getInvoiceDisplay(sale, isOverall, selectedProduct) {
    const selectedItems = (sale.items || []).filter((item) => {
      return isOverall || String(item.product_id) === String(selectedProduct?.id);
    });

    const qty = selectedItems.reduce(
      (sum, item) => sum + Number(item.quantity_kg || 0),
      0
    );

    const total = selectedItems.reduce(
      (sum, item) => sum + Number(item.subtotal || 0),
      0
    );

    const finance = getAllocatedFinance(sale, total);

    return {
      qty,
      total,
      paid: finance.paidAmount,
      balance: finance.balanceAmount,
      status: calculatePaymentStatus(total, finance.paidAmount),
      productLabel: isOverall
        ? "សរុបទាំងអស់"
        : selectedProduct
          ? getProductKhmerName(selectedProduct)
          : "-",
    };
  }

  function getSelectedSubtotal(sale, isOverall, selectedProduct) {
    return (sale.items || []).reduce((sum, item) => {
      const matched =
        isOverall || String(item.product_id) === String(selectedProduct?.id);

      return matched ? sum + Number(item.subtotal || 0) : sum;
    }, 0);
  }

  function getAllocatedFinance(sale, selectedSubtotal) {
    const saleTotal = Number(sale?.total_amount || 0);
    const subtotal = Number(selectedSubtotal || 0);

    if (saleTotal <= 0 || subtotal <= 0) {
      return { paidAmount: 0, balanceAmount: 0 };
    }

    const ratio = subtotal / saleTotal;
    const paidAmount = Math.min(getPaidAmount(sale) * ratio, subtotal);
    const balanceAmount = Math.max(subtotal - paidAmount, 0);

    return { paidAmount, balanceAmount };
  }

  function getPaymentAmount(payment) {
    return Number(
      payment?.amount ??
      payment?.paid_amount ??
      payment?.payment_amount ??
      payment?.deposit_amount ??
      0
    );
  }

  function getPaidAmount(sale) {
    if (Array.isArray(sale?.payments) && sale.payments.length > 0) {
      return sale.payments.reduce((sum, payment) => {
        return sum + getPaymentAmount(payment);
      }, 0);
    }

    if (sale?.paid_amount !== undefined && sale?.paid_amount !== null) {
      return Number(sale.paid_amount || 0);
    }

    if (sale?.deposit_amount !== undefined && sale?.deposit_amount !== null) {
      return Number(sale.deposit_amount || 0);
    }

    return sale?.payment_status === "paid" ? Number(sale.total_amount || 0) : 0;
  }

  function calculatePaymentStatus(total, paid) {
    const totalAmount = Number(total || 0);
    const paidAmount = Number(paid || 0);

    if (paidAmount <= 0) return "unpaid";
    if (paidAmount >= totalAmount) return "paid";
    return "debt";
  }

  function paymentStatusLabel(status) {
    if (status === "paid") return "បានទូទាត់";
    if (status === "debt") return "ជំពាក់";
    return "មិនទាន់ទូទាត់";
  }

  function paymentLabel(method) {
    return method === "qr" ? "QR" : "សាច់ប្រាក់";
  }

  function isMergedInvoice(sale) {
    return (
      sale?.invoice_no?.startsWith("MERGE-") ||
      sale?.merged_from ||
      sale?.note?.toLowerCase?.().includes("merged from")
    );
  }

  function getProductKhmerName(product) {
    const typeMap = {
      A: "ការ៉ុត",
      B: "បាកាន",
      C: "សំបកក្រហមស",
    };

    const typeName =
      typeMap[String(product?.type || "").toUpperCase()] || product?.type || "-";

    return `${typeName} - លេខ ${product?.grade || "-"}`;
  }

  function formatRiel(value) {
    return new Intl.NumberFormat("km-KH").format(Math.round(Number(value || 0))) + " ៛";
  }

  function formatKg(value) {
    const kg = Number(value || 0);
    if (kg >= 1000) return `${(kg / 1000).toLocaleString("km-KH")} តោន`;
    return `${kg.toLocaleString("km-KH")} គីឡូ`;
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);

    if (number >= 1000000) {
      return `${(number / 1000000).toLocaleString("km-KH", {
        maximumFractionDigits: 1,
      })}M`;
    }

    if (number >= 1000) {
      return `${(number / 1000).toLocaleString("km-KH", {
        maximumFractionDigits: 1,
      })}K`;
    }

    return number.toLocaleString("km-KH");
  }

  function formatCompactRiel(value) {
    const number = Number(value || 0);

    if (number >= 1000000) {
      return `${(number / 1000000).toLocaleString("km-KH", {
        maximumFractionDigits: 1,
      })}M`;
    }

    if (number >= 1000) {
      return `${(number / 1000).toLocaleString("km-KH", {
        maximumFractionDigits: 0,
      })}K`;
    }

    return number.toLocaleString("km-KH");
  }

  function formatDate(value) {
    const date = normalizeDate(value);
    if (!date) return "-";

    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  function formatDateShort(value) {
    const date = normalizeDate(value);
    if (!date) return "-";

    const [, month, day] = date.split("-");
    return `${day}/${month}`;
  }

  function PayDayReminderModal({ staff, onClose }) {
    function formatRielLocal(v) {
      return new Intl.NumberFormat("km-KH").format(Number(v || 0)) + " ៛";
    }
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl dark:bg-green-950/40">
              💰
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">ថ្ងៃទទួលប្រាក់ខែ!</h2>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {staff.length} នាក់ ត្រូវទទួលប្រាក់ខែថ្ងៃនេះ
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {staff.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3 dark:bg-green-950/20">
                <div>
                  <p className="font-black text-slate-900 dark:text-white">{s.name}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.phone || "—"}</p>
                </div>
                <p className="font-black text-green-700 dark:text-green-400">{formatRielLocal(s.salary_per_month)}</p>
              </div>
            ))}
          </div>

          <p className="mb-4 rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            ⏰ ប្រព័ន្ធនឹងដាក់ប្រាក់ខែដោយស្វ័យប្រវត្តិនៅម៉ោង 00:05 ព្រឹក
          </p>

          <div className="grid grid-cols-2 gap-2">
            <a href="/staff" className="rounded-2xl bg-green-600 py-3 text-center font-black text-white transition hover:bg-green-700 active:scale-95">
              មើលបុគ្គលិក
            </a>
            <button onClick={onClose} className="rounded-2xl bg-slate-100 py-3 font-black text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300">
              បិទ
            </button>
          </div>
        </div>
      </div>
    );
  }