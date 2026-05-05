import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";

const LOAD_MORE_DAYS = 7;

export default function DailySalesHistory() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("overall");

  const [todayRows, setTodayRows] = useState([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState("");

  const [allRows, setAllRows] = useState([]);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);

  const [visibleDays, setVisibleDays] = useState(7);
  const [dateFilterType, setDateFilterType] = useState("today");
  const [selectedDay, setSelectedDay] = useState(todayDate());
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekValue());
  const [selectedMonth, setSelectedMonth] = useState(todayDate().slice(0, 7));

  const fetchKeyRef = useRef(0);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await api.get("/products");
        const data = res.data;
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
        setProducts(list);
      } catch (err) {
        console.error(err);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    const fetchKey = ++fetchKeyRef.current;

    setTodayRows([]);
    setAllRows([]);
    setBackgroundReady(false);
    setTodayLoading(true);
    setTodayError("");

    const productQuery =
      selectedProductId !== "overall" ? `product_id=${selectedProductId}` : "";

    async function fetchAggregate(extraQuery = "") {
      const queryParts = [productQuery, extraQuery].filter(Boolean);
      const query = queryParts.length ? `?${queryParts.join("&")}` : "";

      const res = await api.get(`/daily-history/aggregate${query}`);
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];

      return sortRowsNewest(
        data.map((row) => ({
          ...row,
          product_name:
            row.product_name ||
            (selectedProductId !== "overall"
              ? getProductKhmerName(products.find((p) => String(p.id) === String(selectedProductId)))
              : null),
        }))
      );
    }

    async function phase1() {
      try {
        const rows = await fetchAggregate(`date=${todayDate()}`);

        if (fetchKeyRef.current !== fetchKey) return;
        setTodayRows(rows);
      } catch (err) {
        if (fetchKeyRef.current !== fetchKey) return;
        console.error(err);
        setTodayError("មិនអាចទាញយកប្រវត្តិថ្ងៃនេះបានទេ");
      } finally {
        if (fetchKeyRef.current === fetchKey) setTodayLoading(false);
      }
    }

    async function phase2() {
      setBackgroundLoading(true);

      try {
        const rows = await fetchAggregate();

        if (fetchKeyRef.current !== fetchKey) return;
        setAllRows(rows);
        setBackgroundReady(true);
      } catch (err) {
        console.error("Background history fetch failed:", err);
      } finally {
        if (fetchKeyRef.current === fetchKey) setBackgroundLoading(false);
      }
    }

    phase1().then(() => phase2());
  }, [selectedProductId, products]);

  useEffect(() => {
    setVisibleDays(7);
  }, [selectedProductId, dateFilterType, selectedDay, selectedWeek, selectedMonth]);

  const selectedProduct = useMemo(() => {
    if (selectedProductId === "overall") return null;
    return products.find((p) => String(p.id) === String(selectedProductId));
  }, [products, selectedProductId]);

  const activeRows = useMemo(() => {
    if (dateFilterType === "today") return todayRows;
    return allRows;
  }, [dateFilterType, todayRows, allRows]);

  const loading = dateFilterType === "today" ? todayLoading : !backgroundReady;
  const error = dateFilterType === "today" ? todayError : "";

  const filteredRows = useMemo(() => {
    const sorted = sortRowsNewest(activeRows);

    if (dateFilterType === "today") return sorted;

    if (dateFilterType === "day") {
      return sorted.filter((row) => row.date === selectedDay);
    }

    if (dateFilterType === "week") {
      const range = getWeekRange(selectedWeek);
      if (!range) return sorted;
      return sorted.filter((row) => row.date >= range.start && row.date <= range.end);
    }

    if (dateFilterType === "month") {
      return sorted.filter((row) => String(row.date || "").startsWith(selectedMonth));
    }

    return sorted;
  }, [activeRows, dateFilterType, selectedDay, selectedWeek, selectedMonth]);

  const visibleRows = useMemo(() => {
    if (dateFilterType !== "recent") return filteredRows;
    return filteredRows.slice(0, visibleDays);
  }, [filteredRows, visibleDays, dateFilterType]);

  const hasMore = dateFilterType === "recent" && visibleDays < filteredRows.length;

  const summary = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.totalSold += Number(row.sold_kg || 0);
        acc.totalAdded += Number(row.added_kg || 0);
        acc.totalMoney += Number(row.money_amount || 0);
        acc.totalPaid += Number(row.paid_amount || 0);
        acc.totalBalance += Number(row.balance_amount || 0);
        acc.totalSaleAmount += Number(row.total_amount || 0);
        acc.totalInvoices += Number(row.invoice_count || 0);
        acc.totalOpening += Number(row.first_stock_kg || 0);
        acc.totalClosing += Number(row.last_stock_kg || 0);
        return acc;
      },
      {
        totalSold: 0,
        totalAdded: 0,
        totalMoney: 0,
        totalPaid: 0,
        totalBalance: 0,
        totalSaleAmount: 0,
        totalInvoices: 0,
        totalOpening: 0,
        totalClosing: 0,
      }
    );
  }, [visibleRows]);

  const displayTitle =
    selectedProductId === "overall"
      ? "គ្រប់ប្រភេទ និងលេខទាំងអស់"
      : selectedProduct
        ? getProductKhmerName(selectedProduct)
        : "-";

  return (
    <main className="min-h-screen bg-[#fbfdf8] p-4 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50 md:p-7">
      <section className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
            ប្រវត្តិលក់ប្រចាំថ្ងៃ
          </h1>

          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <span>កំពុងបង្ហាញ៖ {displayTitle}</span>

            {backgroundLoading && dateFilterType !== "today" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                កំពុងទាញទិន្នន័យ...
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[260px_190px_180px]">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="overall">គ្រប់ប្រភេទ និងលេខទាំងអស់</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {getProductKhmerName(product)}
              </option>
            ))}
          </select>

          <select
            value={dateFilterType}
            onChange={(e) => setDateFilterType(e.target.value)}
            className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="today">ថ្ងៃនេះ</option>
            <option value="recent">ថ្មីៗ</option>
            <option value="day">ជ្រើសថ្ងៃ</option>
            <option value="week">ជ្រើសសប្តាហ៍</option>
            <option value="month">ជ្រើសខែ</option>
          </select>

          {dateFilterType === "day" && (
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          )}

          {dateFilterType === "week" && (
            <input
              type="week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          )}

          {dateFilterType === "month" && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          )}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="លក់សរុប" value={formatKg(summary.totalSold)} note="ចំនួនគីឡូដែលបានលក់" />

        <Card
          title="បន្ថែមស្តុក"
          value={formatKg(summary.totalAdded)}
          note="ស្តុកដែលបានបញ្ចូល"
          tone="yellow"
        />

        <Card
          title="ចំណូលលក់ថ្ងៃនេះ"
          value={formatRiel(summary.totalMoney)}
          note={
            `បានទូទាត់ ${formatRiel(summary.totalPaid)} | នៅជំពាក់ ${formatRiel(summary.totalBalance)} | លក់សរុប ${formatRiel(summary.totalSaleAmount)}`
          }
        />

        <Card
          title="វិក្កយបត្រ"
          value={summary.totalInvoices}
          note={`បង្ហាញ ${visibleRows.length} ថ្ងៃ / មាន ${filteredRows.length} ថ្ងៃ`}
        />
      </section>

      <section className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              តារាងប្រវត្តិប្រចាំថ្ងៃ
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {dateFilterType === "today"
                ? "កំពុងបង្ហាញប្រវត្តិថ្ងៃនេះ"
                : "កំពុងបង្ហាញតាមកាលបរិច្ឆេទដែលបានជ្រើស"}
            </p>
          </div>

          {dateFilterType !== "today" && (
            <button
              type="button"
              onClick={() => setDateFilterType("today")}
              className="w-fit rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              ត្រឡប់ទៅថ្ងៃនេះ
            </button>
          )}
        </div>

        {dateFilterType !== "today" && backgroundLoading && !backgroundReady && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3 dark:border-green-900/40 dark:bg-green-950/20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <p className="text-sm font-bold text-green-700 dark:text-green-400">
              កំពុងទាញប្រវត្តិទាំងអស់...
            </p>
          </div>
        )}

        {error ? (
          <div className="py-8 text-center font-bold text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : loading ? (
          <div className="py-8 text-center font-bold text-slate-500 dark:text-slate-400">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-green-100 text-left text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <th className="py-3">កាលបរិច្ឆេទ</th>
                    <th className="py-3">ស្តុកដើមថ្ងៃ</th>
                    <th className="py-3">បន្ថែមស្តុក</th>
                    <th className="py-3">លក់ចេញ</th>
                    <th className="py-3">ស្តុកចុងថ្ងៃ</th>
                    <th className="py-3">វិក្កយបត្រ</th>
                    <th className="py-3">ផលិតផល</th>
                    <th className="py-3 text-right">ចំនួនប្រាក់</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row) => <DailyRow key={row.date} row={row} />)
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="py-8 text-center font-bold text-slate-500 dark:text-slate-400"
                      >
                        មិនទាន់មានប្រវត្តិសម្រាប់ជម្រើសនេះទេ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {visibleRows.length > 0 ? (
                visibleRows.map((row) => <DailyMobileCard key={row.date} row={row} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  មិនទាន់មានប្រវត្តិសម្រាប់ជម្រើសនេះទេ
                </div>
              )}
            </div>

            {hasMore && (
              <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-green-100 pt-5 dark:border-slate-800 sm:flex-row">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  បង្ហាញ {visibleRows.length} / {filteredRows.length} ថ្ងៃ
                </p>

                <button
                  type="button"
                  onClick={() => setVisibleDays((prev) => prev + LOAD_MORE_DAYS)}
                  className="rounded-2xl bg-green-600 px-6 py-3 font-black text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98]"
                >
                  មើលបន្ថែម 7 ថ្ងៃ
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function DailyRow({ row }) {
  return (
    <tr className="border-b border-green-100 last:border-b-0 dark:border-slate-800">
      <td className="py-3 font-bold text-slate-900 dark:text-white">{formatDate(row.date)}</td>
      <td className="py-3 text-slate-700 dark:text-slate-300">{formatKg(row.first_stock_kg)}</td>
      <td className="py-3 font-bold text-green-700 dark:text-green-400">
        + {formatKg(row.added_kg)}
      </td>
      <td className="py-3 font-bold text-red-600 dark:text-red-400">
        - {formatKg(row.sold_kg)}
      </td>
      <td className="py-3 font-black text-slate-900 dark:text-white">
        {formatKg(row.last_stock_kg)}
      </td>
      <td className="py-3 text-slate-700 dark:text-slate-300">{row.invoice_count}</td>
      <td className="py-3 text-slate-700 dark:text-slate-300">
        {row.product_count ? `${row.product_count} មុខ` : row.product_name || "-"}
      </td>
      <td className="py-3 text-right font-black text-slate-900 dark:text-white">
        {formatRiel(row.money_amount)}
      </td>
    </tr>
  );
}

function DailyMobileCard({ row }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950 dark:text-white">{formatDate(row.date)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {row.product_count ? `${row.product_count} មុខទំនិញ` : row.product_name || "-"}
          </p>
        </div>

        <div className="rounded-xl bg-green-100 px-3 py-2 text-sm font-black text-green-700 dark:bg-green-950/40 dark:text-green-300">
          {row.invoice_count} វិក្កយបត្រ
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoBox label="ស្តុកដើមថ្ងៃ" value={formatKg(row.first_stock_kg)} />
        <InfoBox label="ស្តុកចុងថ្ងៃ" value={formatKg(row.last_stock_kg)} />
      </div>

      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <MoneyBox label="បន្ថែម" value={`+ ${formatKg(row.added_kg)}`} green />
        <MoneyBox label="លក់ចេញ" value={`- ${formatKg(row.sold_kg)}`} red />
        <MoneyBox label="ប្រាក់" value={formatRiel(row.money_amount)} />
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
      <p className="text-xs font-black text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function MoneyBox({ label, value, green, red }) {
  return (
    <div className="border-r border-slate-200 bg-white p-3 last:border-r-0 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-sm font-black ${
          green
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

function Card({ title, value, note, tone = "green" }) {
  const toneClass =
    tone === "yellow"
      ? "border-yellow-200 bg-[#fff6ce] dark:border-yellow-700/60 dark:bg-yellow-950/30"
      : "border-green-200 bg-[#f8fff8] dark:border-green-800/70 dark:bg-green-950/20";

  return (
    <div className={`rounded-[18px] border p-5 shadow-sm ${toneClass}`}>
      <p className="text-base font-black text-slate-600 dark:text-slate-300">{title}</p>
      <h3 className="mt-4 break-words text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
        {value}
      </h3>
      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{note}</p>
    </div>
  );
}

function sortRowsNewest(rows) {
  return [...(rows || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getProductKhmerName(product) {
  const typeMap = { A: "ការ៉ុត", B: "បាកាន", C: "សំបកក្រហមស" };
  const typeName = typeMap[String(product?.type || "").toUpperCase()] || product?.type || "-";
  return `${typeName} - លេខ ${product?.grade || "-"}`;
}

function formatRiel(value) {
  return new Intl.NumberFormat("km-KH").format(Number(value || 0)) + " ៛";
}

function formatKg(value) {
  const kg = Number(value || 0);
  if (kg >= 1000) return `${(kg / 1000).toLocaleString("km-KH")} តោន`;
  return `${kg.toLocaleString("km-KH")} គីឡូ`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("km-KH");
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekValue() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getWeekRange(weekValue) {
  if (!weekValue || !weekValue.includes("-W")) return null;

  const [yearText, weekText] = weekValue.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);

  if (!year || !week) return null;

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const isoWeekStart = simple;

  if (dayOfWeek <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const start = formatInputDate(isoWeekStart);
  const endDate = new Date(isoWeekStart);
  endDate.setUTCDate(isoWeekStart.getUTCDate() + 6);
  const end = formatInputDate(endDate);

  return { start, end };
}

function formatInputDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}