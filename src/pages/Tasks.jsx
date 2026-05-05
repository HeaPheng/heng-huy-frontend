import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { useSearchParams } from "react-router-dom";

const TABS = {
    todo: "todo",
    note: "note",
    debt: "debt",
};

function normalizeDate(value) {
    if (!value) return "";

    const str = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    const date = new Date(str);

    if (Number.isNaN(date.getTime())) {
        return str.slice(0, 10);
    }

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

export default function Tasks() {
    const [searchParams] = useSearchParams();
    const [tasks, setTasks] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [salesLoading, setSalesLoading] = useState(true);
    const [tab, setTab] = useState(TABS.todo);
    const [search, setSearch] = useState("");

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [debtTarget, setDebtTarget] = useState(null);
    const [showDueBox, setShowDueBox] = useState(true);

    const [form, setForm] = useState({
        title: "",
        description: "",
    });

    const [debtForm, setDebtForm] = useState({
        due_date: "",
        due_time: "",
        note: "",
    });

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = await api.get("/tasks");
            setTasks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load tasks", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSales = async () => {
        try {
            setSalesLoading(true);
            const res = await api.get("/sales");
            setSales(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load sales", err);
        } finally {
            setSalesLoading(false);
        }
    };
    useEffect(() => {
        const tabParam = searchParams.get("tab");
        const qParam = searchParams.get("q");

        if (tabParam === "debt") {
            setTab(TABS.debt);
        }

        if (qParam) {
            setSearch(qParam);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchTasks();
        fetchSales();
    }, []);

    const isDueNow = (task) => {
        if (task.status === "done" || !task.due_date) return false;

        const dueDate = normalizeDate(task.due_date);
        const today = todayDate();

        if (dueDate < today) return true;

        if (dueDate === today && task.due_time) {
            const nowTime = new Date().toTimeString().slice(0, 5);
            return String(task.due_time).slice(0, 5) <= nowTime;
        }

        return dueDate === today;
    };

    const todoTasks = useMemo(
        () => tasks.filter((task) => task.type === "todo"),
        [tasks]
    );

    const notes = useMemo(
        () => tasks.filter((task) => task.type === "note"),
        [tasks]
    );

    const debtTasks = useMemo(
        () => tasks.filter((task) => task.type === "payment"),
        [tasks]
    );

    const dueTasks = useMemo(
        () => tasks.filter((task) => isDueNow(task)),
        [tasks]
    );

    const debtSales = useMemo(() => {
        const q = search.trim().toLowerCase();

        return sales
            .filter((sale) => {
                const balance = Number(sale.balance_amount || 0);
                const status = sale.payment_status || "";
                // Exclude fully paid invoices
                if (status === "paid" || status === "completed") return false;
                if (balance <= 0) return false;
                return true;
            })
            .filter((sale) => {
                if (!q) return true;

                const customerName = sale.customer?.name || sale.customer_name || "";
                const phone = sale.customer?.phone || sale.customer_phone || "";
                const invoice = sale.invoice_no || "";

                return (
                    customerName.toLowerCase().includes(q) ||
                    phone.toLowerCase().includes(q) ||
                    invoice.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => Number(b.balance_amount || 0) - Number(a.balance_amount || 0));
    }, [sales, search]);

    const hasDebtReminder = (sale) => {
        return debtTasks.some(
            (task) =>
                String(task.sale_id || task.sale?.id || "") === String(sale.id) &&
                task.status !== "done"
        );
    };

    const stats = useMemo(() => {
        return {
            todoPending: todoTasks.filter((task) => task.status !== "done").length,
            notes: notes.length,
            debtCount: debtSales.length,
            debtTotal: debtSales.reduce(
                (sum, sale) => sum + Number(sale.balance_amount || 0),
                0
            ),
        };
    }, [todoTasks, notes, debtSales]);

    const currentList = tab === TABS.note ? notes : todoTasks;

    const createTask = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;

        const payload = {
            title: form.title,
            description: form.description || null,
            type: tab === TABS.note ? "note" : "todo",
            priority: "normal",
            status: "pending",
        };

        const tempTask = {
            ...payload,
            id: `temp-${Date.now()}`,
            created_at: new Date().toISOString(),
        };

        setTasks((prev) => [tempTask, ...prev]);
        setForm({ title: "", description: "" });

        try {
            const res = await api.post("/tasks", payload);
            setTasks((prev) =>
                prev.map((task) => (task.id === tempTask.id ? res.data : task))
            );
        } catch (err) {
            console.error("Failed to create task", err);
            setTasks((prev) => prev.filter((task) => task.id !== tempTask.id));
        }
    };

    const openDebtModal = (sale) => {
        if (hasDebtReminder(sale)) return;

        setDebtTarget(sale);
        setDebtForm({
            due_date: "",
            due_time: "",
            note: "",
        });
    };

    const createDebtReminder = async (e) => {
        e.preventDefault();
        if (!debtTarget || hasDebtReminder(debtTarget)) {
            setDebtTarget(null);
            return;
        }

        const customerName =
            debtTarget.customer?.name || debtTarget.customer_name || "អតិថិជន";
        const invoiceNo = debtTarget.invoice_no || `#${debtTarget.id}`;
        const balance = Number(debtTarget.balance_amount || 0);

        const payload = {
            title: `${customerName} ជំពាក់ ${formatMoney(balance)}`,
            description:
                debtForm.note ||
                `រំលឹកបំណុលពីវិក្កយបត្រ ${invoiceNo}. នៅសល់ ${formatMoney(balance)}`,
            type: "payment",
            priority: "high",
            status: "pending",
            due_date: debtForm.due_date || null,
            due_time: debtForm.due_time || null,
            customer_id: debtTarget.customer_id || debtTarget.customer?.id || null,
            sale_id: debtTarget.id,
        };

        const tempTask = {
            ...payload,
            id: `temp-${Date.now()}`,
            sale: debtTarget,
            customer: debtTarget.customer,
            created_at: new Date().toISOString(),
        };

        setTasks((prev) => [tempTask, ...prev]);
        setDebtTarget(null);

        try {
            const res = await api.post("/tasks", payload);
            setTasks((prev) =>
                prev.map((task) => (task.id === tempTask.id ? res.data : task))
            );
        } catch (err) {
            console.error("Failed to create debt reminder", err);
            setTasks((prev) => prev.filter((task) => task.id !== tempTask.id));
        }
    };

    const toggleTask = async (task) => {
        if (String(task.id).startsWith("temp-")) return;

        const nextStatus = task.status === "done" ? "pending" : "done";

        setTasks((prev) =>
            prev.map((item) =>
                item.id === task.id ? { ...item, status: nextStatus } : item
            )
        );

        try {
            await api.patch(`/tasks/${task.id}/toggle`);
        } catch (err) {
            console.error("Failed to toggle task", err);
            fetchTasks();
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        const target = deleteTarget;
        setDeleteTarget(null);
        setTasks((prev) => prev.filter((task) => task.id !== target.id));

        if (String(target.id).startsWith("temp-")) return;

        try {
            await api.delete(`/tasks/${target.id}`);
        } catch (err) {
            console.error("Failed to delete task", err);
            fetchTasks();
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 text-white md:p-6">
            {showDueBox && dueTasks.length > 0 && (
                <DueReminderBox
                    tasks={dueTasks}
                    onClose={() => setShowDueBox(false)}
                    onEnough={() => setShowDueBox(false)}
                    onOpen={(task) => {
                        if (task.type === "payment") {
                            setTab(TABS.debt);
                            setSearch(task.sale?.invoice_no || task.customer?.name || task.title);
                        } else if (task.type === "note") {
                            setTab(TABS.note);
                        } else {
                            setTab(TABS.todo);
                        }
                        setShowDueBox(false);
                    }}
                />
            )}

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-black md:text-3xl">
                        កំណត់ចំណាំ និងការងារ
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        ចំណាំ ការងារត្រូវធ្វើ និងរំលឹកបំណុលអតិថិជន
                    </p>
                </div>

                <button
                    onClick={() => {
                        fetchTasks();
                        fetchSales();
                        setShowDueBox(true);
                    }}
                    className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-100 hover:bg-slate-700"
                >
                    ផ្ទុកឡើងវិញ
                </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="ការងារមិនទាន់រួច" value={stats.todoPending} icon="✅" />
                <StatCard title="ចំណាំ" value={stats.notes} icon="📝" />
                <StatCard title="វិក្កយបត្រជំពាក់" value={stats.debtCount} icon="💰" danger />
                <StatCard title="បំណុលសរុប" value={formatMoney(stats.debtTotal)} icon="៛" danger />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
                <TabButton active={tab === TABS.todo} onClick={() => setTab(TABS.todo)}>
                    ✅ ការងារ
                </TabButton>
                <TabButton active={tab === TABS.note} onClick={() => setTab(TABS.note)}>
                    📝 ចំណាំ
                </TabButton>
                <TabButton active={tab === TABS.debt} onClick={() => setTab(TABS.debt)}>
                    💰 បំណុល
                </TabButton>
            </div>

            {tab === TABS.debt ? (
                <DebtSection
                    salesLoading={salesLoading}
                    debtSales={debtSales}
                    search={search}
                    setSearch={setSearch}
                    debtTasks={debtTasks}
                    openDebtModal={openDebtModal}
                    toggleTask={toggleTask}
                    setDeleteTarget={setDeleteTarget}
                    hasDebtReminder={hasDebtReminder}
                />
            ) : (
                <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                    <form
                        onSubmit={createTask}
                        className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl"
                    >
                        <div className="mb-4">
                            <h2 className="text-lg font-black">
                                {tab === TABS.note ? "បន្ថែមចំណាំ" : "បន្ថែមការងារ"}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {tab === TABS.note
                                    ? "សរសេរចំណាំសំខាន់ៗសម្រាប់ចងចាំ"
                                    : "បង្កើតបញ្ជីការងារដែលអាចធីកថារួចរាល់"}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <Field label="ចំណងជើង">
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder={
                                        tab === TABS.note
                                            ? "ឧទាហរណ៍៖ កត់ត្រារឿងត្រូវចាំ"
                                            : "ឧទាហរណ៍៖ ទូរស័ព្ទទៅអតិថិជន"
                                    }
                                    className="input-dark"
                                />
                            </Field>

                            <Field label="ពិពណ៌នា">
                                <textarea
                                    value={form.description}
                                    onChange={(e) =>
                                        setForm({ ...form, description: e.target.value })
                                    }
                                    placeholder="សរសេរព័ត៌មានលម្អិត..."
                                    rows="5"
                                    className="input-dark resize-none"
                                />
                            </Field>

                            <button
                                type="submit"
                                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-700 active:scale-[0.98]"
                            >
                                បន្ថែម
                            </button>
                        </div>
                    </form>

                    <TaskListPanel
                        loading={loading}
                        tab={tab}
                        tasks={currentList}
                        toggleTask={toggleTask}
                        setDeleteTarget={setDeleteTarget}
                    />
                </div>
            )}

            {deleteTarget && (
                <DeleteModal
                    task={deleteTarget}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            )}

            {debtTarget && (
                <DebtReminderModal
                    sale={debtTarget}
                    form={debtForm}
                    setForm={setDebtForm}
                    onCancel={() => setDebtTarget(null)}
                    onSubmit={createDebtReminder}
                />
            )}

            <style>{`
        .input-dark {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(30 41 59);
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
        }

        .input-dark::placeholder {
          color: rgb(148 163 184);
        }

        .input-dark:focus {
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
        }
      `}</style>
        </div>
    );
}

function TaskListPanel({ loading, tab, tasks, toggleTask, setDeleteTarget }) {
    return (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="border-b border-slate-800 p-4">
                <h2 className="text-lg font-black">
                    {tab === TABS.note ? "បញ្ជីចំណាំ" : "បញ្ជីការងារ"}
                </h2>
                <p className="text-sm text-slate-400">
                    {tab === TABS.note ? "ចំណាំទាំងអស់របស់អ្នក" : "ធីកនៅពេលការងាររួចរាល់"}
                </p>
            </div>

            {loading ? (
                <div className="p-6 text-slate-400">កំពុងផ្ទុក...</div>
            ) : tasks.length === 0 ? (
                <EmptyState text="មិនទាន់មានទិន្នន័យ" />
            ) : (
                <div className="divide-y divide-slate-800">
                    {tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            showCheckbox={task.type !== "note"}
                            onToggle={() => toggleTask(task)}
                            onDelete={() => setDeleteTarget(task)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

const DEBT_PAGE_SIZE = 10;

function DebtSection({
    salesLoading,
    debtSales,
    search,
    setSearch,
    debtTasks,
    openDebtModal,
    toggleTask,
    setDeleteTarget,
    hasDebtReminder,
}) {
    const [visibleCount, setVisibleCount] = useState(DEBT_PAGE_SIZE);

    // Reset pagination when search changes
    useEffect(() => {
        setVisibleCount(DEBT_PAGE_SIZE);
    }, [search]);

    const visibleSales = debtSales.slice(0, visibleCount);
    const hasMore = debtSales.length > visibleCount;
    const remaining = debtSales.length - visibleCount;

    return (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
                <div className="border-b border-slate-800 p-4">
                    <h2 className="text-lg font-black">វិក្កយបត្រដែលនៅជំពាក់</h2>
                    <p className="text-sm text-slate-400">
                        ស្វែងរកអតិថិជន ឬវិក្កយបត្រ រួចបង្កើតរំលឹកបំណុល
                    </p>

                    <div className="relative mt-4">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ ឬលេខវិក្កយបត្រ..."
                            className="input-dark pr-10"
                        />

                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-700 px-2 py-0.5 text-xs font-black text-white hover:bg-red-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {salesLoading ? (
                    <div className="p-6 text-slate-400">កំពុងផ្ទុកវិក្កយបត្រ...</div>
                ) : debtSales.length === 0 ? (
                    <EmptyState text="មិនមានវិក្កយបត្រជំពាក់" />
                ) : (
                    <>
                        <div className="divide-y divide-slate-800">
                            {visibleSales.map((sale) => (
                                <DebtInvoiceCard
                                    key={sale.id}
                                    sale={sale}
                                    hasReminder={hasDebtReminder(sale)}
                                    onCreateReminder={() => openDebtModal(sale)}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="border-t border-slate-800 p-4">
                                <button
                                    onClick={() => setVisibleCount((c) => c + DEBT_PAGE_SIZE)}
                                    className="w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-slate-200 hover:bg-slate-700 active:scale-[0.98]"
                                >
                                    បង្ហាញបន្ថែម ({remaining} វិក្កយបត្រទៀត)
                                </button>
                            </div>
                        )}

                        {!hasMore && debtSales.length > DEBT_PAGE_SIZE && (
                            <div className="border-t border-slate-800 p-4">
                                <button
                                    onClick={() => setVisibleCount(DEBT_PAGE_SIZE)}
                                    className="w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-slate-400 hover:bg-slate-700 active:scale-[0.98]"
                                >
                                    បង្រួម
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
                <div className="border-b border-slate-800 p-4">
                    <h2 className="text-lg font-black">រំលឹកបំណុល</h2>
                    <p className="text-sm text-slate-400">
                        រំលឹកដែលបានបង្កើតពីបំណុលអតិថិជន
                    </p>
                </div>

                {(() => {
                    const pendingDebtTasks = debtTasks.filter((t) => t.status !== "done");
                    return pendingDebtTasks.length === 0 ? (
                        <EmptyState text="មិនទាន់មានរំលឹកបំណុល" />
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {pendingDebtTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    showCheckbox
                                    onToggle={() => toggleTask(task)}
                                    onDelete={() => setDeleteTarget(task)}
                                />
                            ))}
                        </div>
                    );
                })()}
            </section>
        </div>
    );
}

function DebtInvoiceCard({ sale, hasReminder, onCreateReminder }) {
    const customerName = sale.customer?.name || sale.customer_name || "មិនមានឈ្មោះ";
    const phone = sale.customer?.phone || sale.customer_phone || "";
    const invoiceNo = sale.invoice_no || `#${sale.id}`;
    const invoiceDate = formatDate(sale.created_at);
    const total = Number(sale.total_amount || 0);
    const paid = Number(sale.paid_amount || 0);
    const balance = Number(sale.balance_amount || 0);

    return (
        <div className="p-4 hover:bg-slate-800/40">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-xl bg-red-950/60 px-2 py-1 text-xs font-black text-red-300">
                            ជំពាក់
                        </span>
                        <span className="rounded-xl bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">
                            🧾 {invoiceNo}
                        </span>
                        <span className="rounded-xl bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">
                            📅 {invoiceDate}
                        </span>
                    </div>

                    <h3 className="mt-2 text-lg font-black text-white">{customerName}</h3>
                    {phone && <p className="text-sm text-slate-400">☎ {phone}</p>}
                </div>

                <div className="text-left md:text-right">
                    <p className="text-sm text-slate-400">នៅជំពាក់</p>
                    <p className="text-2xl font-black text-red-300">{formatMoney(balance)}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <MoneyBox label="សរុប" value={total} />
                <MoneyBox label="បានបង់" value={paid} />
                <MoneyBox label="នៅសល់" value={balance} danger />
            </div>

            <button
                onClick={onCreateReminder}
                disabled={hasReminder}
                className={`mt-4 w-full rounded-2xl px-4 py-3 font-black text-white active:scale-[0.98] ${hasReminder
                    ? "cursor-not-allowed bg-slate-700 text-slate-300"
                    : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
            >
                {hasReminder ? "បានបង្កើតរំលឹករួចហើយ" : "បង្កើតរំលឹកបំណុល"}
            </button>
        </div>
    );
}

function DebtReminderModal({ sale, form, setForm, onCancel, onSubmit }) {
    const customerName = sale.customer?.name || sale.customer_name || "អតិថិជន";
    const invoiceNo = sale.invoice_no || `#${sale.id}`;
    const balance = Number(sale.balance_amount || 0);

    return (
        <Modal>
            <form
                onSubmit={onSubmit}
                className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            >
                <h2 className="text-xl font-black text-white">បង្កើតរំលឹកបំណុល</h2>
                <p className="mt-1 text-sm text-slate-400">
                    {customerName} · {invoiceNo} · នៅសល់ {formatMoney(balance)}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="ថ្ងៃត្រូវរំលឹក">
                        <input
                            type="date"
                            value={form.due_date}
                            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                            className="input-dark"
                        />
                    </Field>

                    <Field label="ម៉ោង">
                        <input
                            type="time"
                            value={form.due_time}
                            onChange={(e) => setForm({ ...form, due_time: e.target.value })}
                            className="input-dark"
                        />
                    </Field>
                </div>

                <div className="mt-4">
                    <Field label="មូលហេតុ / ចំណាំ">
                        <textarea
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            placeholder="ឧទាហរណ៍៖ អតិថិជនសន្យាបង់ថ្ងៃស្អែក..."
                            rows="4"
                            className="input-dark resize-none"
                        />
                    </Field>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 font-black text-slate-200 hover:bg-slate-700"
                    >
                        បោះបង់
                    </button>
                    <button
                        type="submit"
                        className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-700"
                    >
                        បង្កើត
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function DeleteModal({ task, onCancel, onConfirm }) {
    return (
        <Modal>
            <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                <h2 className="text-xl font-black text-white">លុបទិន្នន័យ?</h2>
                <p className="mt-2 text-sm text-slate-400">
                    តើអ្នកប្រាកដថាចង់លុប “{task.title}” មែនទេ?
                </p>

                <div className="mt-5 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 font-black text-slate-200 hover:bg-slate-700"
                    >
                        បោះបង់
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700"
                    >
                        លុប
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function DueReminderBox({ tasks, onClose, onEnough, onOpen }) {
    const [hovering, setHovering] = useState(false);
    const timeoutPassedRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            timeoutPassedRef.current = true;

            if (!hovering) {
                onClose();
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [hovering, onClose]);

    const handleMouseLeave = () => {
        setHovering(false);

        if (timeoutPassedRef.current) {
            onClose();
        }
    };

    return (
        <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={handleMouseLeave}
            className="fixed right-5 top-24 z-[90] w-[380px] max-w-[calc(100vw-2rem)] rounded-3xl border border-amber-700/70 bg-slate-900 p-4 shadow-2xl"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-amber-300">
                        🔔 រំលឹកដល់ពេលហើយ
                    </h3>
                    <p className="text-xs text-slate-400">
                        ចុចលើរំលឹកដើម្បីទៅមើលព័ត៌មានលម្អិត
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="rounded-xl bg-slate-800 px-3 py-1 text-sm font-black text-slate-300 hover:bg-slate-700"
                >
                    ✕
                </button>
            </div>

            <div className="mt-3 space-y-2">
                {tasks.slice(0, 4).map((task) => (
                    <button
                        key={task.id}
                        onClick={() => onOpen(task)}
                        className="w-full rounded-2xl bg-slate-800 p-3 text-left hover:bg-slate-700"
                    >
                        <p className="text-sm font-black text-white">{task.title}</p>
                        {task.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                                {task.description}
                            </p>
                        )}
                        <p className="mt-2 text-xs font-bold text-amber-300">
                            📅 {formatDate(task.due_date)}{" "}
                            {task.due_time ? `⏰ ${String(task.due_time).slice(0, 5)}` : ""}
                        </p>
                    </button>
                ))}
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={onEnough}
                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                >
                    បានគ្រប់គ្រាន់
                </button>

                <button
                    onClick={onClose}
                    className="flex-1 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-700"
                >
                    បិទ
                </button>
            </div>
        </div>
    );
}

function Modal({ children }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            {children}
        </div>
    );
}

function TaskCard({ task, showCheckbox, onToggle, onDelete }) {
    return (
        <div className="flex gap-3 p-4 hover:bg-slate-800/40">
            {showCheckbox && (
                <button
                    onClick={onToggle}
                    className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-sm font-black transition active:scale-90 ${task.status === "done"
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-600 bg-slate-900 text-transparent hover:border-emerald-500"
                        }`}
                >
                    ✓
                </button>
            )}

            <div className="min-w-0 flex-1">
                <h3
                    className={`font-black ${task.status === "done" ? "text-slate-500 line-through" : "text-white"
                        }`}
                >
                    {task.title}
                </h3>

                {task.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                        {task.description}
                    </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
                    {task.due_date && <Pill>📅 {formatDate(task.due_date)}</Pill>}
                    {task.due_time && <Pill>⏰ {String(task.due_time).slice(0, 5)}</Pill>}
                    {task.customer && (
                        <Pill>👤 {task.customer.name || task.customer.customer_name}</Pill>
                    )}
                    {task.sale && (
                        <Pill>🧾 {task.sale.invoice_no || `#${task.sale.id}`}</Pill>
                    )}
                </div>
            </div>

            <button
                onClick={onDelete}
                className="h-9 rounded-xl px-3 text-sm font-black text-red-300 hover:bg-red-950/50"
            >
                លុប
            </button>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-black text-slate-200">
                {label}
            </span>
            {children}
        </label>
    );
}

function TabButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-2xl px-4 py-2 text-sm font-black transition active:scale-95 ${active
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
        >
            {children}
        </button>
    );
}

function StatCard({ title, value, icon, danger }) {
    return (
        <div
            className={`rounded-3xl border p-4 shadow-lg ${danger
                ? "border-red-900/60 bg-red-950/30"
                : "border-slate-800 bg-slate-900/80"
                }`}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-400">{title}</p>
                <span className="text-xl">{icon}</span>
            </div>
            <p className="mt-3 text-2xl font-black">{value}</p>
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-800 text-2xl">
                📝
            </div>
            <p className="font-bold text-slate-300">{text}</p>
        </div>
    );
}

function MoneyBox({ label, value, danger }) {
    return (
        <div className="rounded-2xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`mt-1 font-black ${danger ? "text-red-300" : "text-white"}`}>
                {formatMoney(value)}
            </p>
        </div>
    );
}

function Pill({ children }) {
    return <span className="rounded-xl bg-slate-800 px-2 py-1">{children}</span>;
}

function formatMoney(value) {
    return `${Number(value || 0).toLocaleString()}៛`;
}

function formatDate(value) {
    const date = normalizeDate(value);
    if (!date) return "-";

    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
}