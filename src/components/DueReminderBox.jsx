import { useEffect, useRef, useState } from "react";

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

function formatDate(value) {
  const date = normalizeDate(value);
  if (!date) return "-";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export default function DueReminderBox({ tasks, onClose, onEnough, onOpen }) {
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