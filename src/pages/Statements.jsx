import { useEffect, useMemo, useState } from "react";
import api from "../api";

const TYPE_LABELS = {
  A: "ការ៉ុត",
  B: "បាកាន",
  C: "សំបកក្រហមស",
};

function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

function formatRielPerKg(value) {
  return `${Number(value || 0).toLocaleString()} រៀល/គីឡូ`;
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function productKhmerByTypeGrade(type, grade) {
  return `${TYPE_LABELS[type] || type} លេខ ${grade}`;
}

function isMergeInvoice(sale) {
  return String(sale?.invoice_no || "").toUpperCase().startsWith("MERGE-");
}

function cleanCustomerData(data) {
  if (!data) return null;

  const sales = (data.sales || []).filter((sale) => !isMergeInvoice(sale));

  return {
    ...data,
    sales,
    summary: {
      invoice_count: sales.length,
      total_amount: sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
      paid_amount: sales.reduce((sum, sale) => sum + Number(sale.paid_amount || 0), 0),
      balance_amount: sales.reduce((sum, sale) => sum + Number(sale.balance_amount || 0), 0),
    },
  };
}

export default function Statements() {
  const [tab, setTab] = useState("customer");

  return (
    <main className="statement-page">
      <style>{`
        .statement-page {
          min-height: 100vh;
          background: #f7faf5;
          padding: 32px;
          color: #0f172a;
        }

        html.dark .statement-page {
          background: #020617;
          color: #f8fafc;
        }

        .statement-wrap {
          max-width: 1500px;
          margin: 0 auto;
        }

        .statement-header {
          margin-bottom: 28px;
        }

        .statement-title h1 {
          font-size: 32px;
          font-weight: 900;
          margin: 0;
          color: #0f172a;
        }

        html.dark .statement-title h1 {
          color: #ffffff;
        }

        .statement-title p {
          margin-top: 6px;
          color: #64748b;
          font-size: 16px;
        }

        html.dark .statement-title p {
          color: #94a3b8;
        }

        .statement-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          gap: 16px;
          margin-top: 22px;
          max-width: 760px;
        }

        .statement-tab {
          border: 1px solid #d6ead8;
          background: linear-gradient(135deg, #ffffff, #f3fbf4);
          color: #0f172a;
          padding: 20px 22px;
          border-radius: 20px;
          font-weight: 900;
          cursor: pointer;
          text-align: left;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease;
        }

        html.dark .statement-tab {
          border-color: #1e293b;
          background: linear-gradient(135deg, #0f172a, #020617);
          color: #e2e8f0;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
        }

        .statement-tab:hover {
          transform: translateY(-2px);
          border-color: #16a34a;
          box-shadow: 0 16px 35px rgba(22, 163, 74, 0.16);
        }

        .statement-tab.active {
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: white;
          border-color: #16a34a;
        }

        .statement-tab span {
          display: block;
          font-size: 22px;
          margin-bottom: 6px;
        }

        .statement-tab small {
          display: block;
          font-size: 13px;
          opacity: 0.8;
        }

        .statement-card {
          background: white;
          border: 1px solid #d6ead8;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          margin-bottom: 28px;
        }

        html.dark .statement-card {
          background: #0f172a;
          border-color: #1e293b;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
        }

        .statement-card h2 {
          font-size: 24px;
          margin: 0 0 24px;
          color: #0f172a;
        }

        html.dark .statement-card h2 {
          color: #ffffff;
        }

        .statement-filter-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr 1fr 1fr;
          gap: 18px;
          margin-bottom: 22px;
        }

        .statement-field {
          position: relative;
        }

        .statement-field label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 800;
          color: #475569;
        }

        html.dark .statement-field label {
          color: #cbd5e1;
        }

        .statement-field input,
        .statement-field select {
          width: 100%;
          height: 48px;
          border: 1px solid #d6ead8;
          border-radius: 12px;
          padding: 0 16px;
          font-size: 16px;
          outline: none;
          background: white;
          color: #0f172a;
          box-sizing: border-box;
        }

        html.dark .statement-field input,
        html.dark .statement-field select {
          border-color: #334155;
          background: #020617;
          color: #f8fafc;
        }

        .suggest-box {
          position: absolute;
          top: 76px;
          left: 0;
          right: 0;
          z-index: 50;
          max-height: 260px;
          overflow: auto;
          border: 1px solid #d6ead8;
          background: white;
          border-radius: 14px;
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.16);
        }

        html.dark .suggest-box {
          border-color: #334155;
          background: #020617;
        }

        .suggest-item {
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          padding: 13px 16px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }

        html.dark .suggest-item {
          color: #f8fafc;
        }

        .suggest-item:hover {
          background: #ecfdf5;
          color: #15803d;
        }

        html.dark .suggest-item:hover {
          background: #13251b;
          color: #4ade80;
        }

        .statement-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .statement-btn,
        .print-btn {
          color: white;
          border: none;
          border-radius: 12px;
          padding: 15px 28px;
          font-weight: 900;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.16s ease, opacity 0.16s ease;
        }

        .statement-btn {
          background: #168b33;
        }

        .print-btn {
          background: #2563eb;
        }

        .statement-btn:hover,
        .print-btn:hover {
          transform: translateY(-1px);
        }

        .statement-btn:disabled,
        .print-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-box {
          border: 1px solid #d6ead8;
          background: #f8fff9;
          border-radius: 14px;
          padding: 16px;
        }

        html.dark .summary-box {
          background: #020617;
          border-color: #1e293b;
        }

        .summary-box span {
          display: block;
          font-size: 13px;
          color: #64748b;
          font-weight: 800;
        }

        html.dark .summary-box span {
          color: #94a3b8;
        }

        .summary-box strong {
          display: block;
          margin-top: 6px;
          font-size: 22px;
          color: #22c55e;
        }

        .statement-table-wrap {
          overflow-x: auto;
        }

        .statement-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        }

        .statement-table th {
          text-align: left;
          color: #475569;
          font-weight: 900;
          padding: 14px 8px;
          border-bottom: 1px solid #d6ead8;
        }

        html.dark .statement-table th {
          color: #cbd5e1;
          border-bottom-color: #1e293b;
        }

        .statement-table td {
          padding: 15px 8px;
          border-bottom: 1px solid #d6ead8;
          color: #0f172a;
        }

        html.dark .statement-table td {
          border-bottom-color: #1e293b;
          color: #e2e8f0;
        }

        .qty,
        .bold {
          font-weight: 900;
        }

        .empty-row {
          text-align: center;
          padding: 30px !important;
          color: #64748b !important;
        }

        .print-report {
          display: none;
        }

        @media (max-width: 900px) {
          .statement-page {
            padding: 18px;
          }

          .statement-tabs,
          .statement-filter-grid,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .statement-table {
            min-width: 900px;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .print-report,
          .print-report * {
            visibility: visible !important;
          }

          .print-report {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 14mm;
            background: white;
            color: black;
            font-family: "Hanuman", "Khmer OS Battambang", Arial, sans-serif;
            box-sizing: border-box;
          }

          .print-title {
            text-align: center;
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 4px;
          }

          .print-subtitle {
            text-align: center;
            font-size: 13px;
            margin-bottom: 16px;
          }

          .print-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 28px;
            font-size: 12px;
            margin-bottom: 14px;
          }

          .print-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }

          .print-summary div {
            border: 1px solid #000;
            padding: 8px;
            font-size: 11px;
          }

          .print-summary strong {
            display: block;
            margin-top: 4px;
            font-size: 13px;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 14px;
          }

          .print-table th,
          .print-table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
          }

          .print-table th {
            background: #f1f5f9;
            font-weight: 900;
          }

          .print-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30mm;
            margin-top: 28px;
            font-size: 12px;
            text-align: center;
          }

          .print-sign-line {
            margin-top: 45px;
            border-top: 1px solid #000;
            padding-top: 6px;
          }

          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <section className="statement-wrap">
        <div className="statement-header">
          <div className="statement-title">
            <h1>របាយការណ៍ Statement</h1>
            <p>មើលរបាយការណ៍អតិថិជន និងអ្នកផ្គត់ផ្គង់ / កសិករ។</p>

            <div className="statement-tabs">
              <button
                type="button"
                onClick={() => setTab("customer")}
                className={tab === "customer" ? "statement-tab active" : "statement-tab"}
              >
                <span>👤 អតិថិជន / Customer</span>
                <small>វិក្កយបត្រ ការបង់ប្រាក់ និងបំណុល</small>
              </button>

              <button
                type="button"
                onClick={() => setTab("farmer")}
                className={tab === "farmer" ? "statement-tab active" : "statement-tab"}
              >
                <span>🌾 កសិករ / Farmer</span>
                <small>ស្តុកចូល បរិមាណ និងចំណាយទិញ</small>
              </button>
            </div>
          </div>
        </div>

        {tab === "customer" ? <CustomerStatement /> : <FarmerStatement />}
      </section>
    </main>
  );
}

function CustomerStatement() {
  const [customerInput, setCustomerInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState({
    period: "custom",
    from: "",
    to: "",
    month: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function searchCustomers(value) {
    setCustomerInput(value);
    setSelectedCustomer(null);
    setShowSuggestions(true);

    if (!value.trim()) {
      setCustomers([]);
      return;
    }

    const res = await api.get("/customers", {
      params: { search: value },
    });

    setCustomers(res.data || []);
  }

  function chooseCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerInput(`${customer.name}${customer.phone ? " - " + customer.phone : ""}`);
    setShowSuggestions(false);
  }

  async function fetchStatement() {
    if (!selectedCustomer?.id) {
      alert("សូមជ្រើសរើសអតិថិជនជាមុនសិន។");
      return;
    }

    setLoading(true);

    try {
      const res = await api.get(`/customers/${selectedCustomer.id}/statement`, {
        params: {
          period: filters.period,
          from: filters.period === "custom" ? filters.from || undefined : undefined,
          to: filters.period === "custom" ? filters.to || undefined : undefined,
          month: filters.period === "specific_month" ? filters.month || undefined : undefined,
        },
      });

      setData(cleanCustomerData(res.data));
    } catch {
      alert("ទាញយក Statement អតិថិជនមិនបានទេ។");
    } finally {
      setLoading(false);
    }
  }

  function printStatement() {
    if (!data) {
      alert("សូមបង្កើតរបាយការណ៍ជាមុនសិន។");
      return;
    }

    window.print();
  }

  return (
    <>
      <div className="statement-card">
        <h2>របាយការណ៍អតិថិជន</h2>

        <div className="statement-filter-grid">
          <Field label="អតិថិជន">
            <input
              value={customerInput}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => searchCustomers(e.target.value)}
              placeholder="វាយឈ្មោះ ឬលេខទូរស័ព្ទ"
            />

            {showSuggestions && customers.length > 0 && (
              <div className="suggest-box">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onMouseDown={() => chooseCustomer(customer)}
                    className="suggest-item"
                  >
                    {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="ចាប់ពីថ្ងៃ">
            <input
              type="date"
              disabled={filters.period !== "custom"}
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
          </Field>

          <Field label="ដល់ថ្ងៃ">
            <input
              type="date"
              disabled={filters.period !== "custom"}
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
          </Field>

          <Field label="ប្រភេទរបាយការណ៍">
            <select
              value={filters.period}
              onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value }))}
            >
              <option value="custom">ផ្ទាល់ខ្លួន / Custom</option>
              <option value="today">ថ្ងៃនេះ</option>
              <option value="week">សប្តាហ៍នេះ</option>
              <option value="month">ខែនេះ</option>
              <option value="specific_month">ជ្រើសខែ</option>
            </select>
          </Field>

          {filters.period === "specific_month" && (
            <Field label="ខែ">
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
              />
            </Field>
          )}
        </div>

        <div className="statement-actions">
          <button type="button" onClick={fetchStatement} className="statement-btn" disabled={loading}>
            {loading ? "កំពុងបង្កើត..." : "បង្កើតរបាយការណ៍"}
          </button>

          <button type="button" onClick={printStatement} className="print-btn" disabled={!data}>
            បោះពុម្ព Statement
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="summary-grid">
            <SummaryBox label="ចំនួនវិក្កយបត្រ" value={Number(data.summary?.invoice_count || 0).toLocaleString()} />
            <SummaryBox label="សរុប" value={formatRiel(data.summary?.total_amount)} />
            <SummaryBox label="បានបង់" value={formatRiel(data.summary?.paid_amount)} />
            <SummaryBox label="នៅសល់" value={formatRiel(data.summary?.balance_amount)} />
          </div>

          <div className="statement-card">
            <h2>បញ្ជីវិក្កយបត្រ</h2>

            <div className="statement-table-wrap">
              <table className="statement-table">
                <thead>
                  <tr>
                    <th>កាលបរិច្ឆេទ</th>
                    <th>Invoice</th>
                    <th>សរុប</th>
                    <th>បានបង់</th>
                    <th>នៅសល់</th>
                    <th>ស្ថានភាព</th>
                  </tr>
                </thead>

                <tbody>
                  {data.sales?.map((sale) => (
                    <tr key={sale.id}>
                      <td>{formatDate(sale.created_at)}</td>
                      <td className="bold">{sale.invoice_no}</td>
                      <td>{formatRiel(sale.total_amount)}</td>
                      <td>{formatRiel(sale.paid_amount)}</td>
                      <td className="bold">{formatRiel(sale.balance_amount)}</td>
                      <td>{sale.payment_status}</td>
                    </tr>
                  ))}

                  {(!data.sales || data.sales.length === 0) && (
                    <tr>
                      <td colSpan="6" className="empty-row">មិនមានទិន្នន័យ។</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <CustomerPrintReport data={data} customer={selectedCustomer} filters={filters} />
        </>
      )}
    </>
  );
}

function FarmerStatement() {
  const [filters, setFilters] = useState({
    supplier: "",
    start_date: "",
    end_date: "",
    group_by: "week",
  });

  const [supplierInput, setSupplierInput] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSupplierSuggestions();
  }, []);

  async function fetchSupplierSuggestions() {
    try {
      const res = await api.get("/stock-reports/suppliers", {
        params: { _t: Date.now() },
      });

      const suppliers = (res.data?.by_supplier || [])
        .map((item) => String(item.supplier || "").trim())
        .filter(Boolean)
        .filter((name) => name !== "មិនមានឈ្មោះ");

      const uniqueSuppliers = Array.from(
        new Map(
          suppliers.map((name) => [name.toLowerCase(), name])
        ).values()
      );

      setAllSuppliers(uniqueSuppliers.sort((a, b) => a.localeCompare(b)));
    } catch {
      setAllSuppliers([]);
    }
  }

  const filteredSuppliers = useMemo(() => {
    const keyword = supplierInput.trim().toLowerCase();

    if (!keyword) return allSuppliers.slice(0, 8);

    return allSuppliers
      .filter((supplier) => supplier.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [supplierInput, allSuppliers]);

  function chooseSupplier(supplier) {
    setSupplierInput(supplier);
    setSelectedSupplier(supplier);
    setFilters((prev) => ({ ...prev, supplier }));
    setShowSuggestions(false);
  }

  function clearSupplierInput(value) {
    setSupplierInput(value);
    setSelectedSupplier("");
    setFilters((prev) => ({ ...prev, supplier: "" }));
    setShowSuggestions(true);
  }

  async function fetchReport() {
    const typedValue = supplierInput.trim();

    if (typedValue && !selectedSupplier) {
      alert("សូមជ្រើសរើសឈ្មោះកសិករ/អ្នកផ្គត់ផ្គង់ពីបញ្ជីណែនាំ។");
      return;
    }

    setLoading(true);

    try {
      const res = await api.get("/stock-reports/suppliers", {
        params: {
          supplier: selectedSupplier || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          group_by: filters.group_by,
        },
      });

      setReport(res.data);
    } catch {
      alert("ទាញយករបាយការណ៍កសិករមិនបានទេ។");
    } finally {
      setLoading(false);
    }
  }

  function printStatement() {
    if (!report) {
      alert("សូមបង្កើតរបាយការណ៍ជាមុនសិន។");
      return;
    }

    window.print();
  }

  return (
    <>
      <div className="statement-card">
        <h2>របាយការណ៍អ្នកផ្គត់ផ្គង់ / កសិករ</h2>

        <div className="statement-filter-grid">
          <Field label="អ្នកផ្គត់ផ្គង់ / កសិករ">
            <input
              value={supplierInput}
              onFocus={() => {
                fetchSupplierSuggestions();
                setShowSuggestions(true);
              }}
              onChange={(e) => clearSupplierInput(e.target.value)}
              placeholder="ទុកទទេ = ទាំងអស់"
            />

            {showSuggestions && supplierInput.trim() && filteredSuppliers.length > 0 && (
              <div className="suggest-box">
                {filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier}
                    type="button"
                    onMouseDown={() => chooseSupplier(supplier)}
                    className="suggest-item"
                  >
                    {supplier}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="ចាប់ពីថ្ងៃ">
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start_date: e.target.value }))
              }
            />
          </Field>

          <Field label="ដល់ថ្ងៃ">
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end_date: e.target.value }))
              }
            />
          </Field>

          <Field label="ប្រភេទរបាយការណ៍">
            <select
              value={filters.group_by}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, group_by: e.target.value }))
              }
            >
              <option value="week">សប្តាហ៍ / ច្រើនសប្តាហ៍</option>
              <option value="month">ខែ / ច្រើនខែ</option>
            </select>
          </Field>
        </div>

        <div className="statement-actions">
          <button
            type="button"
            onClick={fetchReport}
            className="statement-btn"
            disabled={loading}
          >
            {loading ? "កំពុងបង្កើត..." : "បង្កើតរបាយការណ៍"}
          </button>

          <button
            type="button"
            onClick={printStatement}
            className="print-btn"
            disabled={!report}
          >
            បោះពុម្ព Statement
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="summary-grid">
            <SummaryBox label="បរិមាណសរុប" value={formatKg(report.summary?.total_kg)} />
            <SummaryBox label="ចំណាយសរុប" value={formatRiel(report.summary?.total_cost)} />
            <SummaryBox label="ចំនួនដងនាំចូល" value={Number(report.summary?.total_entries || 0).toLocaleString()} />
            <SummaryBox label="រយៈពេល" value={`${filters.start_date || "—"} - ${filters.end_date || "—"}`} />
          </div>

          <div className="statement-card">
            <h2>សរុបតាមប្រភេទ និងលេខ</h2>

            <div className="statement-table-wrap">
              <table className="statement-table">
                <thead>
                  <tr>
                    <th>ប្រភេទ</th>
                    <th>លេខ</th>
                    <th>ចំនួនដង</th>
                    <th>បរិមាណសរុប</th>
                    <th>ចំណាយសរុប</th>
                  </tr>
                </thead>

                <tbody>
                  {report.by_product?.map((item) => (
                    <tr key={`${item.type}-${item.grade}`}>
                      <td>{TYPE_LABELS[item.type] || item.type}</td>
                      <td>លេខ {item.grade}</td>
                      <td>{Number(item.count || 0).toLocaleString()}</td>
                      <td className="qty">{formatKg(item.total_kg)}</td>
                      <td>{formatRiel(item.total_cost)}</td>
                    </tr>
                  ))}

                  {(!report.by_product || report.by_product.length === 0) && (
                    <tr>
                      <td colSpan="5" className="empty-row">មិនមានទិន្នន័យ។</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="statement-card">
            <h2>បញ្ជីលម្អិត</h2>

            <div className="statement-table-wrap">
              <table className="statement-table">
                <thead>
                  <tr>
                    <th>កាលបរិច្ឆេទ</th>
                    <th>អ្នកផ្គត់ផ្គង់</th>
                    <th>ប្រភេទ</th>
                    <th>បរិមាណ</th>
                    <th>តម្លៃ/គីឡូ</th>
                    <th>សរុប</th>
                  </tr>
                </thead>

                <tbody>
                  {report.entries?.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.date)}</td>
                      <td className="bold">{entry.supplier || "—"}</td>
                      <td>{productKhmerByTypeGrade(entry.type, entry.grade)}</td>
                      <td className="qty">{formatKg(entry.quantity_kg)}</td>
                      <td>{formatRielPerKg(entry.buying_price_per_kg)}</td>
                      <td className="bold">{formatRiel(entry.total_cost)}</td>
                    </tr>
                  ))}

                  {(!report.entries || report.entries.length === 0) && (
                    <tr>
                      <td colSpan="6" className="empty-row">មិនមានទិន្នន័យ។</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <FarmerPrintReport
            report={report}
            filters={{ ...filters, supplier: selectedSupplier }}
          />
        </>
      )}
    </>
  );
}
function CustomerPrintReport({ data, customer, filters }) {
  return (
    <section className="print-report">
      <div className="print-title">Heng Huy</div>
      <div className="print-subtitle">របាយការណ៍ Statement អតិថិជន</div>

      <div className="print-info">
        <div>អតិថិជន: {customer?.name || data.customer?.name || "—"}</div>
        <div>លេខទូរស័ព្ទ: {customer?.phone || data.customer?.phone || "—"}</div>
        <div>ប្រភេទរបាយការណ៍: {filters.period}</div>
        <div>ថ្ងៃបោះពុម្ព: {formatDate(today())}</div>
        <div>ចាប់ពីថ្ងៃ: {data.period?.from || filters.from || "—"}</div>
        <div>ដល់ថ្ងៃ: {data.period?.to || filters.to || "—"}</div>
      </div>

      <div className="print-summary">
        <div>ចំនួនវិក្កយបត្រ<strong>{Number(data.summary?.invoice_count || 0).toLocaleString()}</strong></div>
        <div>សរុប<strong>{formatRiel(data.summary?.total_amount)}</strong></div>
        <div>បានបង់<strong>{formatRiel(data.summary?.paid_amount)}</strong></div>
        <div>នៅសល់<strong>{formatRiel(data.summary?.balance_amount)}</strong></div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>កាលបរិច្ឆេទ</th>
            <th>Invoice</th>
            <th>សរុប</th>
            <th>បានបង់</th>
            <th>នៅសល់</th>
            <th>ស្ថានភាព</th>
          </tr>
        </thead>

        <tbody>
          {data.sales?.map((sale, index) => (
            <tr key={sale.id}>
              <td>{index + 1}</td>
              <td>{formatDate(sale.created_at)}</td>
              <td>{sale.invoice_no}</td>
              <td>{formatRiel(sale.total_amount)}</td>
              <td>{formatRiel(sale.paid_amount)}</td>
              <td>{formatRiel(sale.balance_amount)}</td>
              <td>{sale.payment_status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintFooter />
    </section>
  );
}

function FarmerPrintReport({ report, filters }) {
  return (
    <section className="print-report">
      <div className="print-title">Heng Huy</div>
      <div className="print-subtitle">របាយការណ៍ Statement អ្នកផ្គត់ផ្គង់ / កសិករ</div>

      <div className="print-info">
        <div>អ្នកផ្គត់ផ្គង់: {filters.supplier || "ទាំងអស់"}</div>
        <div>ប្រភេទរបាយការណ៍: {filters.group_by === "month" ? "ប្រចាំខែ" : "ប្រចាំសប្តាហ៍"}</div>
        <div>ចាប់ពីថ្ងៃ: {filters.start_date || "—"}</div>
        <div>ដល់ថ្ងៃ: {filters.end_date || "—"}</div>
        <div>ថ្ងៃបោះពុម្ព: {formatDate(today())}</div>
        <div>ចំនួនប្រវត្តិ: {Number(report.summary?.total_entries || 0).toLocaleString()}</div>
      </div>

      <div className="print-summary">
        <div>បរិមាណសរុប<strong>{formatKg(report.summary?.total_kg)}</strong></div>
        <div>ចំណាយសរុប<strong>{formatRiel(report.summary?.total_cost)}</strong></div>
        <div>ចំនួនដង<strong>{Number(report.summary?.total_entries || 0).toLocaleString()}</strong></div>
        <div>រយៈពេល<strong>{filters.start_date || "—"} - {filters.end_date || "—"}</strong></div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>កាលបរិច្ឆេទ</th>
            <th>អ្នកផ្គត់ផ្គង់</th>
            <th>ប្រភេទ</th>
            <th>បរិមាណ</th>
            <th>តម្លៃ/គីឡូ</th>
            <th>សរុប</th>
          </tr>
        </thead>

        <tbody>
          {report.entries?.map((entry, index) => (
            <tr key={entry.id}>
              <td>{index + 1}</td>
              <td>{formatDate(entry.date)}</td>
              <td>{entry.supplier || "—"}</td>
              <td>{productKhmerByTypeGrade(entry.type, entry.grade)}</td>
              <td>{formatKg(entry.quantity_kg)}</td>
              <td>{formatRielPerKg(entry.buying_price_per_kg)}</td>
              <td>{formatRiel(entry.total_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintFooter />
    </section>
  );
}

function PrintFooter() {
  return (
    <div className="print-footer">
      <div>
        <div className="print-sign-line">អ្នករៀបចំរបាយការណ៍</div>
      </div>

      <div>
        <div className="print-sign-line">អ្នកត្រួតពិនិត្យ</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="statement-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="summary-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
} 