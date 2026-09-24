function formatDateValue(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export default function DatePickerInput({
  value = "",
  onChange,
  label,
  ariaLabel,
  placeholder = "ជ្រើសកាលបរិច្ឆេទ",
  className = "",
  controlClassName = "",
  style,
  disabled = false,
  ...inputProps
}) {
  const resolvedAriaLabel = ariaLabel || (label ? `${label}កាលបរិច្ឆេទ` : "កាលបរិច្ឆេទ");

  return (
    <span className={`block min-w-0 ${className}`} style={style}>
      {label && (
        <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-200">
          {label}
        </span>
      )}
      <span className="relative block min-w-0">
        <input
          {...inputProps}
          type="date"
          aria-label={resolvedAriaLabel}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer text-base opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 peer-focus:border-green-500 peer-focus:ring-2 peer-focus:ring-green-100 peer-disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:peer-focus:ring-green-950 ${controlClassName}`}
        >
          <span className="min-w-0 truncate">{formatDateValue(value) || placeholder}</span>
          <span className="shrink-0 text-base">📅</span>
        </span>
      </span>
    </span>
  );
}
