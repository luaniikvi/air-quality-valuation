import type { ReactNode } from 'react';

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  empty
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((c, idx) => (
              <th key={idx} className={`px-4 py-3 text-left font-semibold ${c.className || ''}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                {empty || 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columns.map((c, j) => (
                  <td key={j} className={`px-4 py-3 ${c.className || ''}`}>{c.cell(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
