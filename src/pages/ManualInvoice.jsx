import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import api from "../api";
import PrintInvoice from "../components/PrintInvoice";

const emptyItem = {
  name: "",
  quantity_kg: "",
  price_per_kg: "",
};

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initialForm = {
  invoice_date: todayLocalDate(),
  customer_name: "",
  customer_phone: "",
  paid_amount: "",
  payment_method: "",
  items: [{ ...emptyItem }],
};

function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateInputValue(value) {
  if (!value) return todayLocalDate();
  return new Date(value).toISOString().slice(0, 10);
}

function statusLabel(status) {
  if (status === "paid") return "បានទូទាត់";
  if (status === "debt") return "ជំពាក់";
  return "មិនទាន់ទូទាត់";
}

function paymentMethodLabel(method) {
  if (method === "cash") return "សាច់ប្រាក់";
  if (method === "qr") return "QR";
  return "មិនកំណត់";
}

function statusClass(status) {
  if (status === "paid") {
    return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300";
  }

  if (status === "debt") {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300";
  }

  return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
}

function methodClass(method) {
  if (method === "cash") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
  }

  if (method === "qr") {
    return "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300";
  }

  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function calcItemsTotal(items) {
  return items.reduce((sum, item) => {
    return sum + Number(item.quantity_kg || 0) * Number(item.price_per_kg || 0);
  }, 0);
}

function sortNewestFirst(list) {
  return [...(list || [])].sort((a, b) => {
    const dateA = new Date(a.created_at || a.invoice_date || 0).getTime();
    const dateB = new Date(b.created_at || b.invoice_date || 0).getTime();

    if (dateB !== dateA) return dateB - dateA;

    const idA = Number(a.id || 0);
    const idB = Number(b.id || 0);

    if (idB !== idA) return idB - idA;

    const noA = String(a.invoice_no || "").replace(/[^0-9]/g, "");
    const noB = String(b.invoice_no || "").replace(/[^0-9]/g, "");

    return Number(noB || 0) - Number(noA || 0);
  });
}

export default function ManualInvoice() {

  // Change 1: delete modal states
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const printRef = useRef(null);

  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [filters, setFilters] = useState({
    search: "",
    payment_status: "",
    payment_method: "",
    from_date: "",
    to_date: "",
  });

  const [visibleCount, setVisibleCount] = useState(10);

  const [editOpen, setEditOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "",
    paid_at: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const totalAmount = useMemo(() => calcItemsTotal(form.items), [form.items]);
  const paidAmount = Number(form.paid_amount || 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentStatus =
    paidAmount <= 0 ? "unpaid" : paidAmount >= totalAmount ? "paid" : "debt";

  const editTotalAmount = useMemo(
    () => calcItemsTotal(editForm.items),
    [editForm.items]
  );

  async function fetchInvoices(customFilters = filters) {
    setListLoading(true);

    try {
      const params = {};
      Object.entries(customFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const res = await api.get("/manual-invoices", { params });
      setInvoices(sortNewestFirst(res.data || []));
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (activeTab !== "list") return;

    const timer = setTimeout(() => {
      setVisibleCount(10);
      fetchInvoices(filters);
    }, 350);

    return () => clearTimeout(timer);
  }, [
    activeTab,
    filters.search,
    filters.payment_status,
    filters.payment_method,
    filters.from_date,
    filters.to_date,
  ]);

  function updateItem(index, field, value) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function updateEditItem(index, field, value) {
    setEditForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    if (form.items.length >= 10) return;
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  }

  function addEditItem() {
    if (editForm.items.length >= 10) return;
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  }

  function removeItem(index) {
    if (form.items.length === 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function removeEditItem(index) {
    if (editForm.items.length === 1) return;
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function resetForm() {
    setForm({
      ...initialForm,
      invoice_date: todayLocalDate(),
      items: [{ ...emptyItem }],
    });
  }

  function cleanItems(items) {
    return items
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity_kg: Number(item.quantity_kg || 0),
        price_per_kg: Number(item.price_per_kg || 0),
      }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.customer_name.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (!form.customer_phone.trim()) {
      alert("Please enter customer phone number.");
      return;
    }

    if (!form.invoice_date) {
      alert("Please select invoice date.");
      return;
    }

    if (!form.payment_method) {
      alert("Please select payment method.");
      return;
    }

    const invalidItem = form.items.some((item) => {
      const hasAnyValue = item.name.trim() || item.quantity_kg || item.price_per_kg;
      if (!hasAnyValue) return false;
      return !item.name.trim() || Number(item.quantity_kg || 0) <= 0 || Number(item.price_per_kg || 0) <= 0;
    });

    if (invalidItem) {
      alert("Please complete product name, quantity, and price for every item.");
      return;
    }

    const items = cleanItems(form.items);
    if (items.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/manual-invoices", {
        invoice_date: form.invoice_date,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        paid_amount: paidAmount,
        payment_method: form.payment_method || null,
        items,
      });

      setSelectedInvoice(res.data);
      await fetchInvoices();
      resetForm();
      setActiveTab("list");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(invoice) {
    setEditInvoice(invoice);
    setEditForm({
      invoice_date: dateInputValue(invoice.created_at || invoice.invoice_date),
      customer_name: invoice.customer_name || "",
      customer_phone: invoice.customer_phone || "",
      paid_amount: invoice.paid_amount || "",
      payment_method: invoice.payment_method || "",
      items:
        invoice.items?.length > 0
          ? invoice.items.map((item) => ({
            name: item.name || "",
            quantity_kg: Number(item.quantity_kg || 0),
            price_per_kg: Number(item.price_per_kg || 0),
          }))
          : [{ ...emptyItem }],
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();

    if (!editInvoice) return;

    const items = cleanItems(editForm.items);
    if (items.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.put(`/manual-invoices/${editInvoice.id}`, {
        invoice_date: editForm.invoice_date,
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        payment_method: editForm.payment_method || null,
        items,
      });

      setSelectedInvoice(res.data);
      setEditOpen(false);
      setEditInvoice(null);
      await fetchInvoices();
    } finally {
      setLoading(false);
    }
  }

  function openPayment(invoice) {
    setPaymentInvoice(invoice);
    setPaymentForm({
      amount: "",
      payment_method: invoice.payment_method || "",
      paid_at: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setPaymentOpen(true);
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();

    if (!paymentInvoice) return;

    setLoading(true);

    try {
      const res = await api.post(`/manual-invoices/${paymentInvoice.id}/payment`, {
        amount: Number(paymentForm.amount || 0),
        payment_method: paymentForm.payment_method || null,
        paid_at: paymentForm.paid_at,
        note: paymentForm.note,
      });

      setSelectedInvoice(res.data);
      setPaymentOpen(false);
      setPaymentInvoice(null);
      await fetchInvoices();
    } finally {
      setLoading(false);
    }
  }

  function handlePrint(invoice) {
    setSelectedInvoice(invoice);
    setTimeout(() => window.print(), 150);
  }

  function handleDownloadImage(invoice) {
    setSelectedInvoice(invoice);

    setTimeout(async () => {
      if (!printRef.current) return;

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `${invoice.invoice_no}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }, 250);
  }

  // Change 2: replace handleDelete with openDelete + confirmDelete
  function openDelete(invoice) {
    setDeleteInvoice(invoice);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteInvoice) return;

    setDeleting(true);

    try {
      await api.delete(`/manual-invoices/${deleteInvoice.id}`);
      await fetchInvoices();

      if (selectedInvoice?.id === deleteInvoice.id) {
        setSelectedInvoice(null);
      }

      setDeleteOpen(false);
      setDeleteInvoice(null);
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    const cleared = {
      search: "",
      payment_status: "",
      payment_method: "",
      from_date: "",
      to_date: "",
    };
    setFilters(cleared);
    fetchInvoices(cleared);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 pb-24 text-slate-950 dark:bg-[#070b18] dark:text-white md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === "create" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <CreateInvoiceLayout
              form={form}
              setForm={setForm}
              paymentStatus={paymentStatus}
              totalAmount={totalAmount}
              paidAmount={paidAmount}
              balanceAmount={balanceAmount}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
              onPaidChange={(value) => setForm({ ...form, paid_amount: value })}
              onReset={resetForm}
              loading={loading}
            />
          </form>
        )}

        {activeTab === "list" && (
          <div className="space-y-5">
            <FilterCard
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              refresh={() => fetchInvoices(filters)}
              loading={listLoading}
              count={invoices.length}
            />

            {/* Change 3: handleDelete={openDelete} */}
            <InvoiceList
              invoices={invoices}
              listLoading={listLoading}
              openPayment={openPayment}
              openEdit={openEdit}
              handlePrint={handlePrint}
              handleDownloadImage={handleDownloadImage}
              handleDelete={openDelete}
              visibleCount={visibleCount}
              setVisibleCount={setVisibleCount}
            />
          </div>
        )}

        {editOpen && (
          <Modal title="កែវិក្កយបត្រ" onClose={() => setEditOpen(false)}>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <InvoiceInfoCard
                form={editForm}
                setForm={setEditForm}
                paymentStatus={editInvoice?.payment_status || "unpaid"}
                inModal={true}
              />

              <ItemsCard
                items={editForm.items}
                updateItem={updateEditItem}
                addItem={addEditItem}
                removeItem={removeEditItem}
                inModal={true}
              />

              <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                <p className="text-sm font-black text-slate-500">សរុបថ្មី</p>
                <p className="text-xl font-black">{formatRiel(editTotalAmount)}</p>
              </div>

              <ModalActions
                loading={loading}
                onCancel={() => setEditOpen(false)}
                submitLabel="រក្សាទុក"
              />
            </form>
          </Modal>
        )}

        {paymentOpen && paymentInvoice && (
          <Modal title="បន្ថែមការបង់ប្រាក់" onClose={() => setPaymentOpen(false)} maxWidth="max-w-3xl">
            <form onSubmit={handlePaymentSubmit} className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <StatBox label="សរុប" value={formatRiel(paymentInvoice.total_amount)} />
                <StatBox label="បានបង់" value={formatRiel(paymentInvoice.paid_amount)} />
                <StatBox
                  label="នៅសល់"
                  value={formatRiel(paymentInvoice.balance_amount)}
                  danger
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <InputBlock label="ចំនួនបង់">
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    className="input-ui"
                    required
                  />
                </InputBlock>

                <InputBlock label="វិធីបង់ប្រាក់">
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method: e.target.value,
                      })
                    }
                    className="input-ui"
                  >
                    <option value="">មិនកំណត់</option>
                    <option value="cash">សាច់ប្រាក់</option>
                    <option value="qr">QR</option>
                  </select>
                </InputBlock>

                <InputBlock label="ថ្ងៃបង់">
                  <input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paid_at: e.target.value })
                    }
                    className="input-ui"
                  />
                </InputBlock>
              </div>

              <InputBlock label="ចំណាំ">
                <input
                  value={paymentForm.note}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, note: e.target.value })
                  }
                  className="input-ui"
                  placeholder="ចំណាំ"
                />
              </InputBlock>

              <PaymentHistory payments={paymentInvoice.payments || []} />

              <ModalActions
                loading={loading}
                onCancel={() => setPaymentOpen(false)}
                submitLabel="រក្សាទុកការបង់ប្រាក់"
              />
            </form>
          </Modal>
        )}

        {/* Delete confirmation modal — minimal yes / no */}
        {deleteOpen && deleteInvoice && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={() => setDeleteOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={e=>e.stopPropagation()}>
              <p className="mb-1 text-center text-lg font-black text-slate-950 dark:text-white">
                {deleteInvoice.invoice_no}
              </p>
              <p className="mb-6 text-center text-sm font-bold text-slate-500">
                លុបវិក្កយបត្រនេះ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-2xl bg-slate-100 py-3 font-black text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-100"
                >
                  ទេ
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="rounded-2xl bg-red-600 py-3 font-black text-white transition active:scale-95 disabled:opacity-50"
                >
                  {deleting ? "..." : "បាទ/ចាស"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .input-ui {
            width: 100%;
            border-radius: 1rem;
            border: 1px solid rgb(203 213 225);
            background: white;
            padding: 0.8rem 1rem;
            font-weight: 800;
            outline: none;
            transition: 0.15s ease;
            min-height: 52px;
          }

          .dark .input-ui {
            border-color: rgb(51 65 85);
            background: rgb(2 6 23);
            color: white;
          }

          .input-ui:focus {
            border-color: rgb(34 197 94);
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
          }
        `}</style>

        <PrintInvoice
          ref={printRef}
          invoice={selectedInvoice}
          captureMode={true}
        />
        <PrintInvoice invoice={selectedInvoice} />
      </div>
    </div>
  );
}

function Header({ activeTab, setActiveTab }) {
  return (
    <div className="rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
            Heng Huy POS
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
            វិក្កយបត្រដៃ
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            បង្កើត និងគ្រប់គ្រងវិក្កយបត្រដែលមិនប៉ះពាល់ស្តុក
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 lg:w-[360px]">
          <TabButton active={activeTab === "create"} onClick={() => setActiveTab("create")}>
            បង្កើតថ្មី
          </TabButton>
          <TabButton active={activeTab === "list"} onClick={() => setActiveTab("list")}>
            បញ្ជីវិក្កយបត្រ
          </TabButton>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-black transition active:scale-95 ${active
        ? "bg-green-600 text-white shadow-sm"
        : "text-slate-600 hover:text-green-700 dark:text-slate-300 dark:hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}

function CreateInvoiceLayout({
  form,
  setForm,
  paymentStatus,
  totalAmount,
  paidAmount,
  balanceAmount,
  updateItem,
  addItem,
  removeItem,
  onPaidChange,
  onReset,
  loading,
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <SectionTitle
              title="ព័ត៌មានអតិថិជន"
              subtitle="លេខវិក្កយបត្រនឹងបង្កើតដោយប្រព័ន្ធក្រោយពេលរក្សាទុក"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <InputBlock label="ឈ្មោះអតិថិជន">
                <input
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({ ...form, customer_name: e.target.value })
                  }
                  placeholder="បញ្ចូលឈ្មោះអតិថិជន"
                  className="input-ui"
                />
              </InputBlock>

              <InputBlock label="លេខទូរស័ព្ទ">
                <input
                  value={form.customer_phone}
                  onChange={(e) =>
                    setForm({ ...form, customer_phone: e.target.value })
                  }
                  placeholder="បញ្ចូលលេខទូរស័ព្ទ"
                  className="input-ui"
                />
              </InputBlock>

              <InputBlock label="កាលបរិច្ឆេទលក់">
                <input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) =>
                    setForm({ ...form, invoice_date: e.target.value })
                  }
                  className="input-ui"
                />
              </InputBlock>

              <InputBlock label="វិធីបង់ប្រាក់">
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({ ...form, payment_method: e.target.value })
                  }
                  className="input-ui"
                >
                  <option value="">មិនកំណត់</option>
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="qr">QR</option>
                </select>
              </InputBlock>
            </div>
          </div>

          <ItemsCard
            items={form.items}
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
          />

          <div className="rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <MobileSummary
              total={totalAmount}
              paid={form.paid_amount}
              balance={balanceAmount}
              status={paymentStatus}
              onPaidChange={onPaidChange}
              onReset={onReset}
              loading={loading}
            />
          </div>
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-6 rounded-[28px] border border-green-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <PreviewSummary
              form={form}
              total={totalAmount}
              paid={paidAmount}
              balance={balanceAmount}
              status={paymentStatus}
              onPaidChange={onPaidChange}
              onReset={onReset}
              loading={loading}
            />
          </div>
        </div>

        <div className="hidden md:block xl:hidden">
          <div className="rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <MobileSummary
              total={totalAmount}
              paid={form.paid_amount}
              balance={balanceAmount}
              status={paymentStatus}
              onPaidChange={onPaidChange}
              onReset={onReset}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSummary({ form, total, paid, balance, status, onPaidChange, onReset, loading }) {
  const cleanItems = form.items.filter((item) => item.name.trim());

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-950 dark:text-white">
            សង្ខេបវិក្កយបត្រ
          </h3>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            ពិនិត្យមុនរក្សាទុក
          </p>
        </div>
        <Badge className={statusClass(status)}>{statusLabel(status)}</Badge>
      </div>

      <div className="space-y-4">
        <SummaryLine label="អតិថិជន" value={form.customer_name || "-"} />
        <SummaryLine label="ទូរស័ព្ទ" value={form.customer_phone || "-"} />
        <SummaryLine label="កាលបរិច្ឆេទ" value={form.invoice_date || "-"} />
        <SummaryLine label="វិធីបង់ប្រាក់" value={paymentMethodLabel(form.payment_method)} />
      </div>

      <div className="my-5 border-t border-slate-200 dark:border-slate-700" />

      <div>
        <p className="mb-3 font-black text-slate-950 dark:text-white">
          ទំនិញក្នុងវិក្កយបត្រ
        </p>

        {cleanItems.length === 0 ? (
          <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-500 dark:bg-slate-800">
            មិនទាន់មានទំនិញទេ
          </div>
        ) : (
          <div className="space-y-2">
            {cleanItems.map((item, index) => {
              const subtotal = Number(item.quantity_kg || 0) * Number(item.price_per_kg || 0);

              return (
                <div
                  key={`${item.name}-${index}`}
                  className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-black text-slate-950 dark:text-white">
                      {index + 1}. {item.name}
                    </p>
                    <p className="font-black text-green-600 dark:text-green-400">
                      {formatRiel(subtotal)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {Number(item.quantity_kg || 0).toLocaleString()} KG × {formatRiel(item.price_per_kg)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="my-5 border-t border-slate-200 dark:border-slate-700" />

      <div className="space-y-4">
        <SummaryLine label="សរុប" value={formatRiel(total)} strong />

        <InputBlock label="បានបង់">
          <div className="grid gap-2">
            <input
              type="number"
              value={form.paid_amount}
              onChange={(e) => onPaidChange(e.target.value)}
              className="input-ui"
              placeholder="0"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPaidChange(String(total))}
                className="rounded-xl bg-green-100 px-3 py-3 text-sm font-black text-green-700 transition active:scale-95 dark:bg-green-950/50 dark:text-green-300"
              >
                បង់គ្រប់
              </button>
              <button
                type="button"
                onClick={() => onPaidChange("")}
                className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-100"
              >
                កក់ប្រាក់
              </button>
            </div>
          </div>
        </InputBlock>

        <SummaryLine label="នៅសល់" value={formatRiel(balance)} danger />
      </div>

      <div className="mt-6 grid gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-green-600 px-6 py-4 font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "កំពុងរក្សាទុក..." : "រក្សាទុកវិក្កយបត្រ"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl bg-slate-100 px-6 py-4 font-black text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-100"
        >
          សម្អាត
        </button>
      </div>
    </div>
  );
}

function MobileSummary({ total, paid, balance, status, onPaidChange, onReset, loading }) {
  return (
    <div>
      <SectionTitle title="សរុបការលក់" subtitle="បញ្ចូលប្រាក់បានបង់ រួចរក្សាទុក" />

      <div className="grid gap-3 md:grid-cols-2">
        <StatBox label="សរុប" value={formatRiel(total)} />
        <StatBox label="នៅសល់" value={formatRiel(balance)} danger={balance > 0} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InputBlock label="បានបង់">
          <div className="grid gap-2">
            <input
              type="number"
              value={paid}
              onChange={(e) => onPaidChange(e.target.value)}
              className="input-ui"
              placeholder="0"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPaidChange(String(total))}
                className="rounded-xl bg-green-100 px-3 py-3 text-sm font-black text-green-700 transition active:scale-95 dark:bg-green-950/50 dark:text-green-300"
              >
                បង់គ្រប់
              </button>
              <button
                type="button"
                onClick={() => onPaidChange("")}
                className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-100"
              >
                កក់ប្រាក់
              </button>
            </div>
          </div>
        </InputBlock>

        <div className={`rounded-2xl p-4 ${statusClass(status)}`}>
          <p className="text-sm font-black opacity-80">ស្ថានភាព</p>
          <p className="mt-1 text-xl font-black">{statusLabel(status)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl bg-slate-100 px-6 py-4 font-black text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-100"
        >
          សម្អាត
        </button>

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-green-600 px-8 py-4 font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "កំពុងរក្សាទុក..." : "រក្សាទុកវិក្កយបត្រ"}
        </button>
      </div>
    </div>
  );
}

function FilterCard({ filters, setFilters, clearFilters, refresh, loading, count }) {
  return (
    <div className="rounded-[28px] border border-green-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white">
            ស្វែងរកវិក្កយបត្រ
          </h2>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            លទ្ធផលបង្ហាញដោយស្វ័យប្រវត្តិពេលអ្នកវាយ · សរុប {count} វិក្កយបត្រ
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-100"
          >
            សម្អាត
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95 dark:bg-white dark:text-slate-950"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="relative lg:col-span-4">
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="ស្វែងរកលេខវិក្កយបត្រ ឈ្មោះ ឬលេខទូរស័ព្ទ..."
            className="input-ui pr-10"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500 dark:bg-slate-800"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={filters.payment_status}
          onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
          className="input-ui lg:col-span-2"
        >
          <option value="">ស្ថានភាពទាំងអស់</option>
          <option value="paid">បានទូទាត់</option>
          <option value="debt">ជំពាក់</option>
          <option value="unpaid">មិនទាន់ទូទាត់</option>
        </select>

        <select
          value={filters.payment_method}
          onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
          className="input-ui lg:col-span-2"
        >
          <option value="">វិធីបង់ទាំងអស់</option>
          <option value="cash">សាច់ប្រាក់</option>
          <option value="qr">QR</option>
        </select>

        <input
          type="date"
          value={filters.from_date}
          onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
          className="input-ui lg:col-span-2"
        />

        <input
          type="date"
          value={filters.to_date}
          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
          className="input-ui lg:col-span-2"
        />
      </div>
    </div>
  );
}

function InvoiceList({
  invoices,
  listLoading,
  openPayment,
  openEdit,
  handlePrint,
  handleDownloadImage,
  handleDelete,
  visibleCount,
  setVisibleCount,
}) {
  const tableRef = useRef(null);

  function scrollLeft() {
    tableRef.current?.scrollBy({ left: -320, behavior: "smooth" });
  }
  function scrollRight() {
    tableRef.current?.scrollBy({ left: 320, behavior: "smooth" });
  }

  const visible = invoices.slice(0, visibleCount);
  const hasMore = visibleCount < invoices.length;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            បញ្ជីវិក្កយបត្រដៃ
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            ថ្មីទៅចាស់ · ស្វែងរក និងគ្រប់គ្រងវិក្កយបត្រទាំងអស់
          </p>
        </div>

        <div className="flex items-center gap-3">
          {listLoading && (
            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              កំពុងទាញ...
            </span>
          )}
        </div>
      </div>
      <div className="hidden justify-center gap-3 bg-slate-50 py-4 dark:bg-[#070b18] xl:flex">
        <button
          type="button"
          onClick={scrollLeft}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 font-black text-white transition hover:bg-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-100"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={scrollRight}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 font-black text-white transition hover:bg-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-100"
        >
          ›
        </button>
      </div>
      {/* Desktop table */}
      <div className="hidden xl:block">
        <div
          ref={tableRef}
          className="overflow-x-auto"
          style={{ scrollBehavior: "smooth" }}
        >
          <table className="w-full min-w-[1500px] border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                <TableHead>លេខវិក្កយបត្រ</TableHead>
                <TableHead>អតិថិជន</TableHead>
                <TableHead>ទូរស័ព្ទ</TableHead>
                <TableHead align="right">សរុប</TableHead>
                <TableHead align="right">បានបង់</TableHead>
                <TableHead align="right">នៅសល់</TableHead>
                <TableHead>វិធីបង់ប្រាក់</TableHead>
                <TableHead>ស្ថានភាព</TableHead>
                <TableHead>កាលបរិច្ឆេទ</TableHead>
                <TableHead align="right">សកម្មភាព</TableHead>
              </tr>
            </thead>

            <tbody>
              {visible.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-slate-200 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/45"
                >
                  <TableCell strong>
                    <span className="block max-w-[210px] whitespace-normal leading-5">
                      {invoice.invoice_no}
                    </span>
                  </TableCell>
                  <TableCell strong>{invoice.customer_name || "-"}</TableCell>
                  <TableCell>{invoice.customer_phone || "-"}</TableCell>
                  <TableCell align="right" strong>{formatRiel(invoice.total_amount)}</TableCell>
                  <TableCell align="right" strong>{formatRiel(invoice.paid_amount)}</TableCell>
                  <TableCell align="right" strong>{formatRiel(invoice.balance_amount)}</TableCell>
                  <TableCell>{paymentMethodLabel(invoice.payment_method)}</TableCell>
                  <TableCell>
                    <Badge className={statusClass(invoice.payment_status)}>
                      {statusLabel(invoice.payment_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(invoice.created_at || invoice.invoice_date)}</TableCell>
                  <TableCell align="right">
                    <ActionGroup
                      invoice={invoice}
                      openPayment={openPayment}
                      openEdit={openEdit}
                      handlePrint={handlePrint}
                      handleDownloadImage={handleDownloadImage}
                      handleDelete={handleDelete}
                      desktop
                    />
                  </TableCell>
                </tr>
              ))}

              {invoices.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-10 text-center font-bold text-slate-500">
                    មិនមានលទ្ធផលទេ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 xl:hidden">
        {visible.map((invoice) => (
          <div
            key={invoice.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950 dark:text-white">
                  {invoice.invoice_no}
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  {formatDate(invoice.created_at || invoice.invoice_date)}
                </p>
              </div>

              <Badge className={statusClass(invoice.payment_status)}>
                {statusLabel(invoice.payment_status)}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm font-bold">
              <InfoRow label="អតិថិជន" value={invoice.customer_name || "-"} />
              <InfoRow label="ទូរស័ព្ទ" value={invoice.customer_phone || "-"} />
              <InfoRow label="សរុប" value={formatRiel(invoice.total_amount)} />
              <InfoRow label="បានបង់" value={formatRiel(invoice.paid_amount)} />
              <InfoRow label="នៅសល់" value={formatRiel(invoice.balance_amount)} />
              <InfoRow label="វិធីបង់" value={paymentMethodLabel(invoice.payment_method)} />
            </div>

            <ActionGroup
              invoice={invoice}
              openPayment={openPayment}
              openEdit={openEdit}
              handlePrint={handlePrint}
              handleDownloadImage={handleDownloadImage}
              handleDelete={handleDelete}
              mobile
            />
          </div>
        ))}

        {invoices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center font-bold text-slate-500 dark:border-slate-700">
            មិនមានលទ្ធផលទេ
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="border-t border-slate-200 p-4 text-center dark:border-slate-800">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 10)}
            className="rounded-2xl bg-slate-100 px-8 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            មើលបន្ថែម {Math.min(10, invoices.length - visibleCount)} វិក្កយបត្រ
            <span className="ml-2 text-slate-400">
              ({visibleCount}/{invoices.length})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function TableHead({ children, align }) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-4 text-sm font-black ${align === "right" ? "text-right" : "text-left"
        }`}
    >
      {children}
    </th>
  );
}

function TableCell({ children, align, strong }) {
  return (
    <td
      className={`whitespace-nowrap px-5 py-5 align-middle ${align === "right" ? "text-right" : "text-left"
        } ${strong
          ? "font-black text-slate-950 dark:text-white"
          : "font-bold text-slate-700 dark:text-slate-300"
        }`}
    >
      {children}
    </td>
  );
}

function AmountBox({ label, value, danger }) {
  return (
    <div className="border-r border-slate-200 p-3 last:border-r-0 dark:border-slate-700">
      <p className="text-xs font-black text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-black ${danger ? "text-red-600 dark:text-red-300" : "text-slate-950 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function InvoiceInfoCard({ form, setForm, paymentStatus, inModal }) {
  const wrapperClass = inModal
    ? ""
    : "rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className={wrapperClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950 dark:text-white">
          ព័ត៌មានវិក្កយបត្រ
        </h2>
        <Badge className={statusClass(paymentStatus)}>{statusLabel(paymentStatus)}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InputBlock label="ថ្ងៃទី">
          <input
            type="date"
            value={form.invoice_date}
            onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
            className="input-ui"
          />
        </InputBlock>

        <InputBlock label="ឈ្មោះអតិថិជន">
          <input
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="ឈ្មោះអតិថិជន"
            className="input-ui"
          />
        </InputBlock>

        <InputBlock label="លេខទូរស័ព្ទ">
          <input
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            placeholder="លេខទូរស័ព្ទ"
            className="input-ui"
          />
        </InputBlock>

        <InputBlock label="វិធីបង់ប្រាក់">
          <select
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            className="input-ui"
          >
            <option value="">មិនកំណត់</option>
            <option value="cash">សាច់ប្រាក់</option>
            <option value="qr">QR</option>
          </select>
        </InputBlock>
      </div>
    </div>
  );
}

function ItemsCard({ items, updateItem, addItem, removeItem, inModal }) {
  const desktopNameRefs = useRef([]);
  const mobileNameRefs = useRef([]);
  const pendingFocusRef = useRef(false);
  const prevLengthRef = useRef(items.length);

  useEffect(() => {
    if (pendingFocusRef.current && items.length > prevLengthRef.current) {
      pendingFocusRef.current = false;

      setTimeout(() => {
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        const target = isDesktop
          ? desktopNameRefs.current[items.length - 1]
          : mobileNameRefs.current[items.length - 1];

        target?.focus();
        target?.select();
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }

    prevLengthRef.current = items.length;
  }, [items.length]);

  function isItemComplete(item) {
    return (
      item.name.trim() &&
      Number(item.quantity_kg || 0) > 0 &&
      Number(item.price_per_kg || 0) > 0
    );
  }

  function handleItemEnter(e, index) {
    if (e.key !== "Enter") return;

    e.preventDefault();
    e.stopPropagation();

    if (!isItemComplete(items[index])) return;
    if (items.length >= 10) return;

    pendingFocusRef.current = true;
    addItem();
  }

  const wrapperClass = inModal
    ? ""
    : "rounded-[28px] border border-green-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6";

  return (
    <div className={wrapperClass}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle title="មុខទំនិញ" subtitle="អាចបន្ថែមបានច្រើនបំផុត 10 មុខ" />

        <button
          type="button"
          onClick={() => {
            pendingFocusRef.current = true;
            addItem();
          }}
          disabled={items.length >= 10}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-40 dark:bg-white dark:text-slate-950"
        >
          + បន្ថែមមុខទំនិញ
        </button>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 md:block">
        <table className="w-full table-fixed">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="w-[7%] p-3 text-left text-sm font-black">ល.រ</th>
              <th className="w-[35%] p-3 text-left text-sm font-black">ឈ្មោះទំនិញ</th>
              <th className="w-[17%] p-3 text-right text-sm font-black">ចំនួន KG</th>
              <th className="w-[19%] p-3 text-right text-sm font-black">តម្លៃ / KG</th>
              <th className="w-[17%] p-3 text-right text-sm font-black">សរុប</th>
              <th className="w-[10%] p-3 text-center text-sm font-black">លុប</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const subtotal =
                Number(item.quantity_kg || 0) * Number(item.price_per_kg || 0);

              return (
                <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-3 text-sm font-black">{index + 1}</td>

                  <td className="p-3">
                    <input
                      ref={(el) => {
                        desktopNameRefs.current[index] = el;
                      }}
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      onKeyDownCapture={(e) => handleItemEnter(e, index)}
                      placeholder="ឈ្មោះទំនិញ"
                      className="input-ui"
                    />
                  </td>

                  <td className="p-3">
                    <input
                      type="number"
                      value={item.quantity_kg}
                      onChange={(e) => updateItem(index, "quantity_kg", e.target.value)}
                      onKeyDownCapture={(e) => handleItemEnter(e, index)}
                      className="input-ui text-right"
                    />
                  </td>

                  <td className="p-3">
                    <input
                      type="number"
                      value={item.price_per_kg}
                      onChange={(e) => updateItem(index, "price_per_kg", e.target.value)}
                      onKeyDownCapture={(e) => handleItemEnter(e, index)}
                      className="input-ui text-right"
                    />
                  </td>

                  <td className="p-3 text-right font-black">{formatRiel(subtotal)}</td>

                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 active:scale-95 disabled:opacity-40 dark:bg-red-950/50 dark:text-red-300"
                    >
                      លុប
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item, index) => {
          const subtotal =
            Number(item.quantity_kg || 0) * Number(item.price_per_kg || 0);

          return (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-black">មុខទំនិញ #{index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="rounded-xl bg-red-100 px-3 py-2 text-sm font-black text-red-700 disabled:opacity-40 dark:bg-red-950/50 dark:text-red-300"
                >
                  លុប
                </button>
              </div>

              <div className="grid gap-3">
                <InputBlock label="ឈ្មោះទំនិញ">
                  <input
                    ref={(el) => {
                      mobileNameRefs.current[index] = el;
                    }}
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    onKeyDownCapture={(e) => handleItemEnter(e, index)}
                    className="input-ui"
                    placeholder="ឈ្មោះទំនិញ"
                  />
                </InputBlock>

                <div className="grid grid-cols-2 gap-3">
                  <InputBlock label="ចំនួន KG">
                    <input
                      type="number"
                      value={item.quantity_kg}
                      onChange={(e) => updateItem(index, "quantity_kg", e.target.value)}
                      onKeyDownCapture={(e) => handleItemEnter(e, index)}
                      className="input-ui"
                    />
                  </InputBlock>

                  <InputBlock label="តម្លៃ / KG">
                    <input
                      type="number"
                      value={item.price_per_kg}
                      onChange={(e) => updateItem(index, "price_per_kg", e.target.value)}
                      onKeyDownCapture={(e) => handleItemEnter(e, index)}
                      className="input-ui"
                    />
                  </InputBlock>
                </div>

                <div className="rounded-xl bg-white p-3 text-right font-black dark:bg-slate-900">
                  {formatRiel(subtotal)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function PaymentHistory({ payments }) {
  return (
    <div>
      <h3 className="mb-3 font-black">ប្រវត្តិបង់ប្រាក់</h3>

      <div className="space-y-2">
        {payments.length === 0 && (
          <div className="rounded-2xl bg-slate-100 p-4 text-center font-bold text-slate-500 dark:bg-slate-800">
            មិនទាន់មានប្រវត្តិបង់ប្រាក់ទេ
          </div>
        )}

        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-2 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-black">{formatRiel(payment.amount)}</p>
              <p className="text-sm font-semibold text-slate-500">
                {formatDateTime(payment.paid_at)} · {paymentMethodLabel(payment.payment_method)}
              </p>
            </div>
            <p className="text-sm font-bold text-slate-500">{payment.note || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function StatBox({ label, value, danger }) {
  return (
    <div
      className={`rounded-2xl p-4 ${danger
        ? "bg-red-50 dark:bg-red-950/30"
        : "bg-slate-100 dark:bg-slate-800"
        }`}
    >
      <p className={`text-sm font-black ${danger ? "text-red-500" : "text-slate-500"}`}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-black ${danger ? "text-red-600 dark:text-red-300" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryLine({ label, value, strong, danger }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`text-right font-black ${danger
          ? "text-red-600 dark:text-red-300"
          : strong
            ? "text-green-600 dark:text-green-400"
            : "text-slate-950 dark:text-white"
          }`}
      >
        {value}
      </span>
    </div>
  );
}

function InputBlock({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Badge({ className, children }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function Modal({ title, children, onClose, maxWidth = "max-w-5xl" }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className={`relative z-10 w-full ${maxWidth} rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto`} onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 z-10 mb-5 flex items-center justify-between bg-white pb-3 dark:bg-slate-900">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ loading, onCancel, submitLabel }) {
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-2xl bg-slate-100 px-6 py-3 font-black text-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        បោះបង់
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-green-600 px-6 py-3 font-black text-white disabled:opacity-50"
      >
        {loading ? "កំពុងរក្សាទុក..." : submitLabel}
      </button>
    </div>
  );
}

// Change 5: Delete button always shown (removed !desktop condition)
function ActionGroup({
  invoice,
  openPayment,
  openEdit,
  handlePrint,
  handleDownloadImage,
  handleDelete,
  mobile,
  desktop,
}) {
  return (
    <div
      className={`gap-2 ${mobile
        ? "mt-4 grid grid-cols-2"
        : desktop
          ? "flex justify-end"
          : "flex flex-wrap"
        }`}
    >
      <ActionButton
        label="បង់ប្រាក់"
        tone="green"
        onClick={() => openPayment(invoice)}
        disabled={invoice.payment_status === "paid"}
      />
      <ActionButton label="កែ" tone="slate" onClick={() => openEdit(invoice)} />
      <ActionButton label="មើល / បោះពុម្ព" tone="blue" onClick={() => handlePrint(invoice)} />
      <ActionButton
        label="រក្សាទុករូបភាព"
        tone="emerald"
        onClick={() => handleDownloadImage(invoice)}
      />
      <ActionButton
        label="លុប"
        tone="red"
        onClick={() => handleDelete(invoice)}
        wide={mobile}
      />
    </div>
  );
}

function ActionButton({ label, tone, onClick, disabled, wide }) {
  const classes = {
    green: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${wide ? "col-span-2" : ""
        } ${classes[tone] || classes.slate}`}
    >
      {label}
    </button>
  );
}