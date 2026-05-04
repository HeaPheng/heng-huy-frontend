import { useCallback, useEffect, useState } from "react";
import api from "../api";

const TYPE_LABELS = {
  auto_deposit: "ប្រាក់ខែ", day_off: "ថ្ងៃឈប់",
  manual_add: "បន្ថែម", manual_deduct: "ដក", advance: "ដកជាមុន",
};
const TYPE_COLORS = {
  auto_deposit: { bg: "#dcfce7", color: "#15803d" },
  day_off:      { bg: "#ffedd5", color: "#c2410c" },
  manual_add:   { bg: "#dbeafe", color: "#1d4ed8" },
  manual_deduct:{ bg: "#fee2e2", color: "#b91c1c" },
  advance:      { bg: "#f3e8ff", color: "#7e22ce" },
};

function formatRiel(v) {
  return new Intl.NumberFormat("km-KH").format(Number(v || 0)) + " ៛";
}
function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function initials(name) {
  return (name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
}
function avatarColor(name) {
  const c=["#16a34a","#0891b2","#7c3aed","#db2777","#ea580c","#ca8a04"];
  let h=0; for(let i=0;i<(name||"").length;i++) h=(h*31+name.charCodeAt(i))%c.length;
  return c[h];
}

const INPUT = "w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const LABEL = "block text-base font-black text-slate-700 dark:text-slate-300 mb-1.5";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dayOffOpen, setDayOffOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [historyTxns, setHistoryTxns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch { setError("មិនអាចទាញយកទិន្នន័យបុគ្គលិកបានទេ");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openHistory(s) {
    setSelected(s); setHistoryOpen(true); setHistoryLoading(true); setHistoryTxns([]);
    try { const res = await api.get(`/staff/${s.id}/transactions`);
      setHistoryTxns(Array.isArray(res.data) ? res.data : []);
    } catch {} finally { setHistoryLoading(false); }
  }

  async function handleDelete(s) {
    if (!window.confirm(`លុប ${s.name} មែនទេ?`)) return;
    await api.delete(`/staff/${s.id}`); load();
  }

  const totalPos = staff.filter(s=>s.balance>=0).reduce((a,s)=>a+s.balance,0);
  const totalDebt = staff.filter(s=>s.balance<0).reduce((a,s)=>a+Math.abs(s.balance),0);

  return (
    <main className="min-h-screen bg-[#fbfdf8] p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50 md:p-7">
      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-4xl">ប្រាក់ខែបុគ្គលិក</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400 md:text-base">គ្រប់គ្រងប្រាក់ខែ ថ្ងៃឈប់ និងការដកប្រាក់</p>
        </div>
        <button onClick={() => { setEditing(null); setCreateOpen(true); }}
          className="w-full rounded-2xl bg-green-600 px-6 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-green-700 active:scale-95 sm:w-auto">
          + បន្ថែមបុគ្គលិក
        </button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "បុគ្គលិកសរុប", value: staff.length + " នាក់", cls: "" },
          { label: "ប្រាក់ជំពាក់សរុប", value: formatRiel(totalPos), cls: "text-green-600 dark:text-green-400" },
          { label: "បំណុលសរុប", value: formatRiel(totalDebt), cls: "text-red-500 dark:text-red-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-2xl border border-green-200 bg-[#f8fff8] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex sm:block items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`text-xl font-black break-words sm:mt-2 ${cls || "text-slate-950 dark:text-white"}`}>{value}</p>
          </div>
        ))}
      </section>

      {loading ? <div className="py-16 text-center text-lg font-bold text-slate-400">កំពុងទាញយក...</div>
        : error ? <div className="py-16 text-center text-lg font-bold text-red-500">{error}</div>
        : staff.length === 0 ? <div className="py-16 text-center text-lg font-bold text-slate-400">មិនទាន់មានបុគ្គលិកទេ</div>
        : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {staff.map(s => (
              <StaffCard key={s.id} s={s}
                onEdit={() => { setEditing(s); setCreateOpen(true); }}
                onDelete={() => handleDelete(s)}
                onDayOff={() => { setSelected(s); setDayOffOpen(true); }}
                onAdjust={() => { setSelected(s); setAdjustOpen(true); }}
                onHistory={() => openHistory(s)}
              />
            ))}
          </div>
        )}

      {createOpen && <CreateModal editing={editing} onClose={() => { setCreateOpen(false); setEditing(null); }} onDone={load} />}
      {dayOffOpen && selected && <DayOffModal staff={selected} onClose={() => { setDayOffOpen(false); setSelected(null); }} onDone={() => { setDayOffOpen(false); setSelected(null); load(); }} />}
      {adjustOpen && selected && <AdjustModal staff={selected} onClose={() => { setAdjustOpen(false); setSelected(null); }} onDone={() => { setAdjustOpen(false); setSelected(null); load(); }} />}
      {historyOpen && selected && <HistoryModal staff={selected} txns={historyTxns} loading={historyLoading} onClose={() => { setHistoryOpen(false); setSelected(null); setHistoryTxns([]); }} />}
    </main>
  );
}

function StaffCard({ s, onEdit, onDelete, onDayOff, onAdjust, onHistory }) {
  const isNeg = s.balance < 0;
  return (
    <div className="flex flex-col rounded-2xl border border-green-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white md:h-14 md:w-14 md:text-xl"
            style={{ background: avatarColor(s.name) }}>
            {initials(s.name)}
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 dark:text-white">{s.name}</p>
            <p className="text-base font-semibold text-slate-500 dark:text-slate-400">{s.phone || "—"}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded-xl p-2 text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✏️</button>
          <button onClick={onDelete} className="rounded-xl p-2 text-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40">🗑️</button>
        </div>
      </div>

      <div className={`mt-4 rounded-2xl p-4 ${isNeg ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
        <p className="text-sm font-black text-slate-500 dark:text-slate-400">សមតុល្យបច្ចុប្បន្ន</p>
        <p className={`mt-1 text-3xl font-black ${isNeg ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {isNeg ? "−" : ""}{formatRiel(Math.abs(s.balance))}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "ប្រាក់ខែ", value: formatRiel(s.salary_per_month) },
          { label: "ក្នុងមួយថ្ងៃ", value: formatRiel(s.daily_rate) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-sm font-black text-slate-400">{label}</p>
            <p className="mt-0.5 text-base font-black text-slate-800 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        📅 ទទួលប្រាក់ថ្ងៃទី {s.pay_day} រៀងរាល់ខែ · ចាប់ {formatDate(s.start_date)}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { emoji: "📅", label: "ថ្ងៃឈប់", cls: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300", fn: onDayOff },
          { emoji: "💰", label: "កែប្រាក់", cls: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/40 dark:text-blue-300", fn: onAdjust },
          { emoji: "📋", label: "ប្រវត្តិ", cls: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300", fn: onHistory },
        ].map(({ emoji, label, cls, fn }) => (
          <button key={label} onClick={fn}
            className={`rounded-xl py-3 text-sm font-black transition active:scale-95 ${cls}`}>
            <div className="text-xl">{emoji}</div>
            <div className="mt-0.5">{label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Helper: parse DD, MM, YYYY → "YYYY-MM-DD"
function buildISODate(d, m, y) {
  if (!d || !m || !y) return "";
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
// Helper: "YYYY-MM-DD" → {d, m, y}
function splitISODate(iso) {
  if (!iso) return { d:"", m:"", y:"" };
  const [y,m,d] = String(iso).slice(0,10).split("-");
  return { d: d||"", m: m||"", y: y||"" };
}

function CreateModal({ editing, onClose, onDone }) {
  const init = splitISODate(editing?.start_date);
  const [name, setName] = useState(editing?.name || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [day, setDay] = useState(init.d);
  const [month, setMonth] = useState(init.m);
  const [year, setYear] = useState(init.y);
  const [salary, setSalary] = useState(editing?.salary_per_month || 800000);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const startDate = buildISODate(day, month, year);
    if (!startDate) { setErr("សូមបញ្ចូលថ្ងៃចាប់ផ្ដើម"); return; }
    setSaving(true); setErr("");
    try {
      const data = { name, phone: phone||null, start_date: startDate, salary_per_month: Number(salary) };
      if (editing) await api.put(`/staff/${editing.id}`, data);
      else await api.post("/staff", data);
      onDone(); onClose();
    } catch (ex) { setErr(ex.response?.data?.message || "កំហុស");
    } finally { setSaving(false); }
  }

  const numInput = "rounded-2xl border border-green-200 bg-white px-3 py-3 text-base font-bold text-slate-800 outline-none text-center focus:border-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <Modal title={editing ? "កែបុគ្គលិក" : "បន្ថែមបុគ្គលិក"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className={LABEL}>ឈ្មោះ *</label>
          <input required value={name} onChange={e=>setName(e.target.value)} className={INPUT} />
        </div>
        <div><label className={LABEL}>លេខទូរស័ព្ទ</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>ថ្ងៃចាប់ផ្ដើមធ្វើការ * <span className="text-sm font-semibold text-slate-400">(ថ្ងៃ / ខែ / ឆ្នាំ)</span></label>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min="1" max="31" placeholder="ថ្ងៃ" value={day} onChange={e=>setDay(e.target.value)} className={numInput} />
            <input type="number" min="1" max="12" placeholder="ខែ" value={month} onChange={e=>setMonth(e.target.value)} className={numInput} />
            <input type="number" min="2000" max="2100" placeholder="ឆ្នាំ" value={year} onChange={e=>setYear(e.target.value)} className={numInput} />
          </div>
        </div>
        <div><label className={LABEL}>ប្រាក់ខែ (៛) *</label>
          <input required type="number" min="0" value={salary} onChange={e=>setSalary(e.target.value)} className={INPUT} />
          {salary && <p className="mt-1 text-sm font-semibold text-slate-500">ក្នុងមួយថ្ងៃ: {formatRiel(Math.round(Number(salary)/30))}</p>}
        </div>
        {err && <p className="text-base font-bold text-red-500">{err}</p>}
        <button disabled={saving} className="w-full rounded-2xl bg-green-600 py-3.5 text-base font-black text-white transition hover:bg-green-700 active:scale-95 disabled:opacity-60">
          {saving ? "កំពុងរក្សាទុក..." : editing ? "រក្សាទុក" : "បន្ថែម"}
        </button>
      </form>
    </Modal>
  );
}

function DayOffModal({ staff, onClose, onDone }) {
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const deduction = days ? Math.round((staff.salary_per_month/30)*Number(days)) : 0;

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setErr("");
    try { await api.post(`/staff/${staff.id}/day-off`, { days: Number(days), note: note||null }); onDone();
    } catch (ex) { setErr(ex.response?.data?.message || "កំហុស"); } finally { setSaving(false); }
  }

  return (
    <Modal title={`ថ្ងៃឈប់ — ${staff.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className={LABEL}>ចំនួនថ្ងៃឈប់ *</label>
          <input required type="number" min="0.5" step="0.5" value={days} onChange={e=>setDays(e.target.value)} placeholder="ឧ. 1, 1.5, 2" className={INPUT} />
        </div>
        {deduction > 0 && (
          <div className="rounded-2xl bg-orange-50 p-5 text-center dark:bg-orange-950/20">
            <p className="text-base font-black text-orange-600 dark:text-orange-400">នឹងដក</p>
            <p className="text-3xl font-black text-orange-700 dark:text-orange-300">− {formatRiel(deduction)}</p>
            <p className="mt-1 text-sm font-semibold text-orange-500">({days} ថ្ងៃ × {formatRiel(Math.round(staff.salary_per_month/30))} / ថ្ងៃ)</p>
          </div>
        )}
        <div><label className={LABEL}>ចំណាំ</label>
          <input value={note} onChange={e=>setNote(e.target.value)} className={INPUT} placeholder="ស្រេចចិត្ត" />
        </div>
        {err && <p className="text-base font-bold text-red-500">{err}</p>}
        <button disabled={saving||!days} className="w-full rounded-2xl bg-orange-600 py-3.5 text-base font-black text-white transition hover:bg-orange-700 active:scale-95 disabled:opacity-60">
          {saving ? "កំពុង..." : "បញ្ជាក់ការដក"}
        </button>
      </form>
    </Modal>
  );
}

function AdjustModal({ staff, onClose, onDone }) {
  const [direction, setDirection] = useState("debit");
  const [type, setType] = useState("advance");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function handleDir(d) { setDirection(d); setType(d==="credit"?"manual_add":"advance"); }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setErr("");
    try { await api.post(`/staff/${staff.id}/adjust`, { direction, type, amount: Number(amount), note }); onDone();
    } catch (ex) { setErr(ex.response?.data?.message || "កំហុស"); } finally { setSaving(false); }
  }

  return (
    <Modal title={`កែប្រាក់ — ${staff.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[["debit","− ដកប្រាក់"],["credit","+ បន្ថែមប្រាក់"]].map(([d,lbl])=>(
            <button key={d} type="button" onClick={()=>handleDir(d)}
              className={`rounded-2xl py-3.5 text-base font-black transition active:scale-95 ${direction===d
                ? d==="debit"?"bg-red-600 text-white":"bg-green-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
              {lbl}
            </button>
          ))}
        </div>
        {direction==="debit" && (
          <div><label className={LABEL}>ប្រភេទ</label>
            <select value={type} onChange={e=>setType(e.target.value)} className={INPUT}>
              <option value="advance">ដកប្រាក់ជាមុន (Advance)</option>
              <option value="manual_deduct">ដកប្រាក់ធម្មតា</option>
            </select>
          </div>
        )}
        <div><label className={LABEL}>ចំនួន (៛) *</label>
          <input required type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} className={INPUT} />
        </div>
        <div><label className={LABEL}>ចំណាំ *</label>
          <input required value={note} onChange={e=>setNote(e.target.value)} className={INPUT} placeholder="ឧ. ដកប្រាក់ជាមុន" />
        </div>
        {err && <p className="text-base font-bold text-red-500">{err}</p>}
        <button disabled={saving||!amount||!note}
          className={`w-full rounded-2xl py-3.5 text-base font-black text-white transition active:scale-95 disabled:opacity-60 ${direction==="debit"?"bg-red-600 hover:bg-red-700":"bg-green-600 hover:bg-green-700"}`}>
          {saving ? "កំពុង..." : "បញ្ជាក់"}
        </button>
      </form>
    </Modal>
  );
}

function HistoryModal({ staff, txns, loading, onClose }) {
  return (
    <Modal title={`ប្រវត្តិ — ${staff.name}`} onClose={onClose}>
      <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pr-1">
        {loading ? <p className="py-8 text-center text-base font-bold text-slate-400">កំពុងទាញ...</p>
          : txns.length===0 ? <p className="py-8 text-center text-base font-bold text-slate-400">មិនទាន់មានប្រវត្តិ</p>
          : txns.map(tx => {
            const c = TYPE_COLORS[tx.type] || TYPE_COLORS.manual_add;
            const isCredit = tx.direction==="credit";
            return (
              <div key={tx.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="min-w-0">
                  <span className="inline-block rounded-full px-3 py-1 text-sm font-black"
                    style={{ background: c.bg, color: c.color }}>
                    {TYPE_LABELS[tx.type]||tx.type}
                  </span>
                  {tx.days_off && <span className="ml-1 text-sm font-bold text-slate-400">({tx.days_off} ថ្ងៃ)</span>}
                  {tx.note && <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{tx.note}</p>}
                  <p className="mt-1 text-sm text-slate-400">{formatDate(tx.created_at)}</p>
                </div>
                <p className={`shrink-0 text-lg font-black ${isCredit?"text-green-600 dark:text-green-400":"text-red-600 dark:text-red-400"}`}>
                  {isCredit?"+":" −"}{formatRiel(tx.amount)}
                </p>
              </div>
            );
          })}
      </div>
    </Modal>
  );
}
