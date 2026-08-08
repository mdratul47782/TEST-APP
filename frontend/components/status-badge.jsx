const STATUS_STYLES = {
  Pending: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    label: 'text-amber-700',
  },
  Passed: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    label: 'text-emerald-700',
  },
  Failed: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    label: 'text-rose-700',
  },
};

export default function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
