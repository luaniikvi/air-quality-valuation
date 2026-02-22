export default function StatusBadge({
  level,
}: {
  level: 'SAFE' | 'WARN' | 'DANGER' | '...';
}) {
  const cls =
    level === 'SAFE'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : level === 'WARN'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : level === 'DANGER'
          ? 'bg-rose-100 text-rose-800 border-rose-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {level}
    </span>
  );
}