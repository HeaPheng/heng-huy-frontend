import { useEffect, useMemo, useState } from "react";
import api from "../api";

const TYPE_LABELS = {
  A: "ការ៉ុត",
  B: "បាកាន",
  C: "សំបកក្រហមស",
};

const TYPES = ["A", "B", "C"];
const GRADES = [1, 2, 3];

function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

function formatRielPerKg(value) {
  return `${Number(value || 0).toLocaleString()} រៀល/គីឡូ`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function productKhmer(product) {
  if (!product) return "—";
  return `${TYPE_LABELS[product.type] || product.type} លេខ ${product.grade}`;
}

function kgToFormQuantity(entry) {
  const kg = Number(entry.quantity_kg || 0);

  if (kg >= 1000 && kg % 1000 === 0) {
    return {
      quantity: String(kg / 1000),
      unit: "ton",
    };
  }

  return {
    quantity: String(kg),
    unit: "kg",
  };
}

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [activeType, setActiveType] = useState("A");
  const [activeGrade, setActiveGrade] = useState(1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [filters, setFilters] = useState({
    supplier: "all",
    startDate: "",
    endDate: "",
  });

  const emptyForm = {
    date: today(),
    quantity: "",
    unit: "kg",
    supplier: "",
    buying_price_per_kg: "",
    note: "",
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const type = params.get("type");
    const grade = params.get("grade");
    const quantity = params.get("quantity");
    const unit = params.get("unit");

    if (type && TYPES.includes(type)) {
      setActiveType(type);
    }

    if (grade && GRADES.includes(Number(grade))) {
      setActiveGrade(Number(grade));
    }

    if (quantity || unit) {
      setForm((prev) => ({
        ...prev,
        quantity: quantity || prev.quantity,
        unit: unit || prev.unit,
      }));
    }
  }, []);

  const activeProduct = useMemo(() => {
    return products.find(
      (p) => String(p.type) === activeType && Number(p.grade) === activeGrade
    );
  }, [products, activeType, activeGrade]);

  useEffect(() => {
    setEditId(null);

    const params = new URLSearchParams(window.location.search);
    const quantity = params.get("quantity");
    const unit = params.get("unit");

    setForm((prev) => ({
      ...emptyForm,
      quantity: quantity || "",
      unit: unit || "kg",
      date: prev.date || emptyForm.date,
    }));

    setFilters({
      supplier: "all",
      startDate: "",
      endDate: "",
    });

    if (activeProduct?.id) {
      fetchEntries(activeProduct.id);
    } else {
      setEntries([]);
    }
  }, [activeProduct?.id]);

  async function fetchProducts() {
    const res = await api.get("/products");
    setProducts(res.data);
  }

  async function fetchEntries(productId) {
    const res = await api.get(`/products/${productId}/stock-entries`);
    setEntries(res.data);
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
  }

  function resetFilters() {
    setFilters({
      supplier: "all",
      startDate: "",
      endDate: "",
    });
  }

  function startEdit(entry) {
    const qty = kgToFormQuantity(entry);

    setEditId(entry.id);
    setForm({
      date: entry.date || today(),
      quantity: qty.quantity,
      unit: qty.unit,
      supplier: entry.supplier || "",
      buying_price_per_kg: entry.buying_price_per_kg || "",
      note: entry.note || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!activeProduct?.id) {
      alert("រកមិនឃើញប្រភេទស្តុកនេះទេ។");
      return;
    }

    setLoading(true);

    const payload = {
      product_id: activeProduct.id,
      date: form.date,
      quantity: Number(form.quantity),
      unit: form.unit,
      buying_price_per_kg: Number(form.buying_price_per_kg || 0),
      supplier: form.supplier,
      note: form.note,
    };

    try {
      if (editId) {
        await api.put(`/stock-entries/${editId}`, payload);
      } else {
        await api.post("/stock-entries", payload);
      }

      resetForm();
      await fetchProducts();
      await fetchEntries(activeProduct.id);
    } catch {
      alert(editId ? "កែប្រែស្តុកមិនបានទេ។" : "បន្ថែមស្តុកមិនបានទេ។");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(entryId) {
    setDeleteId(entryId);
  }

  async function confirmDelete() {
    if (!deleteId) return;

    try {
      await api.delete(`/stock-entries/${deleteId}`);

      if (editId === deleteId) {
        resetForm();
      }

      setDeleteId(null);

      await fetchProducts();
      if (activeProduct?.id) {
        await fetchEntries(activeProduct.id);
      }
    } catch {
      alert("លុបស្តុកមិនបានទេ។");
    }
  }

  const suppliers = useMemo(() => {
    const stockSuppliers = entries
      .map((entry) => entry.supplier?.trim())
      .filter(Boolean);

    return Array.from(new Set(stockSuppliers)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const supplierMatch =
        filters.supplier === "all" ||
        (entry.supplier || "").trim() === filters.supplier;

      const dateValue = entry.date ? entry.date.slice(0, 10) : "";

      const startMatch = !filters.startDate || dateValue >= filters.startDate;
      const endMatch = !filters.endDate || dateValue <= filters.endDate;

      return supplierMatch && startMatch && endMatch;
    });
  }, [entries, filters]);

  const totalFilteredKg = useMemo(() => {
    return filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.quantity_kg || 0),
      0
    );
  }, [filteredEntries]);

  return (
    <main className="stock-page">
      <style>{`
        .stock-page {
          min-height: 100vh;
          background: #f7faf5;
          padding: 32px;
          color: #0f172a;
          transition: background 0.2s ease, color 0.2s ease;
        }

        html.dark .stock-page {
          background: #020617;
          color: #f8fafc;
        }

        .stock-wrap {
          max-width: 1500px;
          margin: 0 auto;
        }

        .stock-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
        }

        .stock-title h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          color: #0f172a;
        }

        html.dark .stock-title h1 {
          color: #ffffff;
        }

        .stock-title p {
          margin-top: 6px;
          color: #64748b;
          font-size: 16px;
        }

        html.dark .stock-title p {
          color: #94a3b8;
        }

        .stock-tabs,
        .grade-tabs {
          display: flex;
          gap: 12px;
          margin-top: 18px;
          flex-wrap: wrap;
        }

        .grade-tabs {
          margin-top: 12px;
        }

        .stock-tab,
        .grade-tab {
          border: 1px solid #d6ead8;
          background: white;
          color: #0f172a;
          padding: 14px 22px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        html.dark .stock-tab,
        html.dark .grade-tab {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }

        .grade-tab {
          padding: 11px 18px;
        }

        .stock-tab:hover,
        .grade-tab:hover {
          border-color: #16a34a;
          background: #ecfdf5;
          color: #15803d;
        }

        html.dark .stock-tab:hover,
        html.dark .grade-tab:hover {
          border-color: #22c55e;
          background: #052e16;
          color: #86efac;
        }

        .stock-tab.active,
        .grade-tab.active {
          background: #16a34a !important;
          color: white !important;
          border-color: #16a34a !important;
          box-shadow: 0 10px 24px rgba(22, 163, 74, 0.25);
        }

        .stock-current {
          border: 1px solid #a7d8ad;
          background: #f3fbf4;
          border-radius: 16px;
          padding: 18px 28px;
          min-width: 240px;
          text-align: center;
          transition: background 0.2s ease, border 0.2s ease;
        }

        html.dark .stock-current {
          border-color: #166534;
          background: #052e16;
        }

        .stock-current span {
          display: block;
          font-size: 13px;
          color: #475569;
        }

        html.dark .stock-current span {
          color: #cbd5e1;
        }

        .stock-current strong {
          display: block;
          margin-top: 4px;
          font-size: 32px;
          color: #15803d;
        }

        html.dark .stock-current strong {
          color: #4ade80;
        }

        .stock-current small {
          display: block;
          margin-top: 6px;
          color: #64748b;
          font-weight: 700;
        }

        html.dark .stock-current small {
          color: #94a3b8;
        }

        .stock-card {
          background: white;
          border: 1px solid #d6ead8;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          margin-bottom: 28px;
          transition: background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease;
        }

        html.dark .stock-card {
          background: #0f172a;
          border-color: #1e293b;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
        }

        .stock-card h2 {
          font-size: 24px;
          margin: 0 0 24px;
          color: #0f172a;
        }

        html.dark .stock-card h2 {
          color: #ffffff;
        }

        .stock-form-head,
        .history-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .stock-form-head h2,
        .history-head h2 {
          margin: 0;
        }

        .edit-badge {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        html.dark .edit-badge {
          background: #451a03;
          color: #fbbf24;
          border-color: #92400e;
        }

        .stock-form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 18px;
          margin-bottom: 20px;
        }

        .stock-field label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        html.dark .stock-field label {
          color: #cbd5e1;
        }

        .stock-field input,
        .stock-field select {
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

        html.dark .stock-field input,
        html.dark .stock-field select {
          border-color: #334155;
          background: #020617;
          color: #f8fafc;
        }

        html.dark .stock-field input::placeholder {
          color: #64748b;
        }

        .qty-row {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 12px;
        }

        .note-field {
          grid-column: span 2;
        }

        .stock-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 26px;
        }

        .stock-btn {
          background: #168b33;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 15px 28px;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
        }

        .cancel-btn {
          background: #e2e8f0;
          color: #0f172a;
          border: none;
          border-radius: 12px;
          padding: 15px 24px;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
        }

        html.dark .cancel-btn {
          background: #334155;
          color: #f8fafc;
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
          font-weight: 700;
        }

        html.dark .summary-box span {
          color: #94a3b8;
        }

        .summary-box strong {
          display: block;
          margin-top: 6px;
          font-size: 22px;
          color: #15803d;
        }

        html.dark .summary-box strong {
          color: #4ade80;
        }

        .stock-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        }

        .stock-table th {
          text-align: left;
          color: #475569;
          font-weight: 800;
          padding: 14px 8px;
          border-bottom: 1px solid #d6ead8;
        }

        html.dark .stock-table th {
          color: #cbd5e1;
          border-bottom-color: #1e293b;
        }

        .stock-table td {
          padding: 15px 8px;
          border-bottom: 1px solid #d6ead8;
          color: #0f172a;
        }

        html.dark .stock-table td {
          border-bottom-color: #1e293b;
          color: #e2e8f0;
        }

        .stock-table td.qty {
          font-weight: 800;
        }

        .muted {
          color: #64748b;
        }

        html.dark .muted {
          color: #94a3b8;
        }

        .row-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .row-btn {
          border: none;
          border-radius: 10px;
          padding: 9px 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .edit-btn {
          background: #e0f2fe;
          color: #0369a1;
        }

        .delete-btn {
          background: #fee2e2;
          color: #b91c1c;
        }

        html.dark .edit-btn {
          background: #082f49;
          color: #38bdf8;
        }

        html.dark .delete-btn {
          background: #450a0a;
          color: #fca5a5;
        }

        .popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .popup-box {
          background: white;
          padding: 24px;
          border-radius: 16px;
          width: 320px;
          text-align: center;
        }

        html.dark .popup-box {
          background: #0f172a;
          color: white;
        }

        .popup-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }

        .btn-cancel {
          background: #e2e8f0;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          color: #0f172a;
        }

        .btn-delete {
          background: #dc2626;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .stock-page {
            padding: 18px;
          }

          .stock-header,
          .stock-form-head,
          .history-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .stock-current {
            width: 100%;
          }

          .stock-form-grid,
          .filter-grid,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .note-field {
            grid-column: span 1;
          }

          .stock-table-wrap {
            overflow-x: auto;
          }

          .stock-table {
            min-width: 900px;
          }
        }
      `}</style>

      <section className="stock-wrap">
        <div className="stock-header">
          <div className="stock-title">
            <h1>គ្រប់គ្រងស្តុក</h1>
            <p>បន្ថែម កែប្រែ លុបស្តុកដំឡូង និងមើលប្រវត្តិនាំចូលតាមប្រភេទ។</p>

            <div className="stock-tabs">
              {TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setActiveType(type);
                    setActiveGrade(1);
                  }}
                  className={`stock-tab ${activeType === type ? "active" : ""}`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="grade-tabs">
              {GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setActiveGrade(grade)}
                  className={`grade-tab ${Number(activeGrade) === Number(grade) ? "active" : ""}`}
                >
                  លេខ {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="stock-current">
            <span>ស្តុកបច្ចុប្បន្ន</span>
            <strong>{formatKg(activeProduct?.stock_kg)}</strong>
            <small>{productKhmer(activeProduct)}</small>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stock-card">
          <div className="stock-form-head">
            <h2>{editId ? "កែប្រែស្តុក" : "បន្ថែមស្តុកថ្មី"}</h2>
            {editId && <span className="edit-badge">កំពុងកែប្រែប្រវត្តិស្តុក</span>}
          </div>

          <div className="stock-form-grid">
            <Field label="កាលបរិច្ឆេទ">
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateForm("date", e.target.value)}
              />
            </Field>

            <Field label="បរិមាណ">
              <div className="qty-row">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.quantity}
                  onChange={(e) => updateForm("quantity", e.target.value)}
                  placeholder="0"
                />
                <select value={form.unit} onChange={(e) => updateForm("unit", e.target.value)}>
                  <option value="kg">គីឡូ</option>
                  <option value="ton">តោន</option>
                </select>
              </div>
            </Field>

            <Field label="អ្នកផ្គត់ផ្គង់ / កសិដ្ឋាន">
              <input
                value={form.supplier}
                onChange={(e) => updateForm("supplier", e.target.value)}
                placeholder="ឈ្មោះអ្នកផ្គត់ផ្គង់ ឬ កសិដ្ឋាន"
              />
            </Field>

            <Field label="តម្លៃទិញ / គីឡូ">
              <input
                type="number"
                step="1"
                min="0"
                value={form.buying_price_per_kg}
                onChange={(e) => updateForm("buying_price_per_kg", e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="ចំណាំ" className="note-field">
              <input
                value={form.note}
                onChange={(e) => updateForm("note", e.target.value)}
                placeholder="មិនចាំបាច់បញ្ចូល"
              />
            </Field>
          </div>

          <div className="stock-actions">
            <button disabled={loading} type="submit" className="stock-btn">
              {loading
                ? editId
                  ? "កំពុងកែប្រែ..."
                  : "កំពុងបន្ថែម..."
                : editId
                  ? "រក្សាទុកការកែប្រែ"
                  : "បន្ថែមស្តុក"}
            </button>

            {editId && (
              <button type="button" onClick={resetForm} className="cancel-btn">
                បោះបង់
              </button>
            )}
          </div>
        </form>

        <div className="stock-card">
          <div className="history-head">
            <h2>ប្រវត្តិស្តុក</h2>

            <button type="button" onClick={resetFilters} className="cancel-btn">
              សម្អាត Filter
            </button>
          </div>

          <div className="filter-grid">
            <Field label="ជ្រើសអ្នកផ្គត់ផ្គង់ / កសិដ្ឋាន">
              <select value={filters.supplier} onChange={(e) => updateFilter("supplier", e.target.value)}>
                <option value="all">ទាំងអស់</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ចាប់ពីថ្ងៃ">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => updateFilter("startDate", e.target.value)}
              />
            </Field>

            <Field label="ដល់ថ្ងៃ">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => updateFilter("endDate", e.target.value)}
              />
            </Field>
          </div>

          <div className="summary-grid">
            <div className="summary-box">
              <span>ចំនួនប្រវត្តិ</span>
              <strong>{filteredEntries.length.toLocaleString()}</strong>
            </div>

            <div className="summary-box">
              <span>បរិមាណសរុប</span>
              <strong>{formatKg(totalFilteredKg)}</strong>
            </div>

            <div className="summary-box">
              <span>ប្រភេទស្តុក</span>
              <strong>{productKhmer(activeProduct)}</strong>
            </div>

            <div className="summary-box">
              <span>អ្នកផ្គត់ផ្គង់</span>
              <strong>{filters.supplier === "all" ? "ទាំងអស់" : filters.supplier}</strong>
            </div>
          </div>

          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>កាលបរិច្ឆេទ</th>
                  <th>អ្នកផ្គត់ផ្គង់</th>
                  <th>បរិមាណ</th>
                  <th>តម្លៃទិញ</th>
                  <th>ចំណាំ</th>
                  <th style={{ textAlign: "right" }}>សកម្មភាព</th>
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.date)}</td>
                    <td>{entry.supplier || "—"}</td>
                    <td className="qty">{formatKg(entry.quantity_kg)}</td>
                    <td>{formatRielPerKg(entry.buying_price_per_kg)}</td>
                    <td className="muted">{entry.note || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => startEdit(entry)} className="row-btn edit-btn">
                          កែប្រែ
                        </button>
                        <button type="button" onClick={() => handleDelete(entry.id)} className="row-btn delete-btn">
                          លុប
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: 30 }}>
                      មិនមានប្រវត្តិស្តុកត្រូវនឹង Filter នេះទេ។
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {deleteId && (
        <div className="popup-overlay">
          <div className="popup-box">
            <p>តើអ្នកពិតជាចង់លុបប្រវត្តិនេះមែនទេ?</p>

            <div className="popup-actions">
              <button className="btn-cancel" onClick={() => setDeleteId(null)}>
                បោះបង់
              </button>

              <button className="btn-delete" onClick={confirmDelete}>
                លុប
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`stock-field ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}