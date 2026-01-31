import './chartSetup';
import { Line } from 'react-chartjs-2';
import type { Point } from './LineChart';

export default function MiniChart({ points }: { points: Point[] }) {
  const data = {
    labels: points.map((p) => p.label),
    datasets: [
      {
        label: 'mini',
        data: points.map((p) => p.value),
        tension: 0.3,
        pointRadius: 0
      }
    ]
  };

  return (
    <div className="h-24 w-full">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }}
      />
    </div>
  );
}
