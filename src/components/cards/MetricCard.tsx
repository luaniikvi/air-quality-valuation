import type { CSSProperties } from 'react';

export default function MetricCard({
  title,
  value,
  unit,
  sub,
  className,
  style,
  valueClassName,
  accentColor,
  strongBorder
}: {
  title: string;
  value: string | number | null | undefined;
  unit?: string;
  sub?: string;
  className?: string;
  style?: CSSProperties;
  valueClassName?: string;
  /** Optional vertical accent bar on the left (CSS color string). */
  accentColor?: string;
  /** Make border a bit thicker when you want extra emphasis. */
  strongBorder?: boolean;
}) {
  const base =
    'rounded-2xl bg-white p-4 shadow-sm border border-slate-200 relative overflow-hidden';
  const borderClass = strongBorder ? 'border-2' : 'border';
  const paddingClass = accentColor ? 'pl-6' : '';
  return (
    <div className={`${base} ${borderClass} ${paddingClass} ${className || ''}`} style={style}>
      {accentColor ? (
        <div
          className="absolute left-0 top-0 h-full w-2"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
      ) : null}

      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className={`text-3xl font-semibold tracking-tight ${valueClassName || ''}`}>
          {value ?? '...'}
        </div>
        {unit ? <div className="pb-1 text-sm text-slate-500">{unit}</div> : null}
      </div>
      {sub ? <div className="mt-2 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
