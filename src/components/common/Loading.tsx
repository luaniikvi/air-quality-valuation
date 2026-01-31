export default function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      <span>{label}</span>
    </div>
  );
}
