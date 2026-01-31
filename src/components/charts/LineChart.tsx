import './chartSetup';
import { Line } from 'react-chartjs-2';

export type Point = { label: string; value: number };

export default function LineChart({
  title,
  points,
  yLabel,
  height = 280,
  accent = '#0ea5e9'
}: {
  title?: string;
  points: Point[];
  yLabel?: string;
  height?: number;
  accent?: string;
}) {
  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace('#', '').trim();
    if (h.length !== 6) return hex;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const labels = points.map((p) => p.label);
  const data = {
    labels,
    datasets: [
      {
        label: yLabel || title || 'Value',
        data: points.map((p) => p.value),
        tension: 0.25,
        pointRadius: 2,
        borderColor: accent,
        backgroundColor: hexToRgba(accent, 0.15),
        borderWidth: 2,
        fill: true
      }
    ]
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
      {title ? <div className="text-sm font-semibold text-slate-700">{title}</div> : null}
      <div className="mt-3">
        <Line
          data={data}
          height={height}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true }
            },
            scales: {
              x: { ticks: { maxTicksLimit: 10 } },
              y: { title: yLabel ? { display: true, text: yLabel } : { display: false } }
            }
          }}
        />
      </div>
    </div>
  );
}
