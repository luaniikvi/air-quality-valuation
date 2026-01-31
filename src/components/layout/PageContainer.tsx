import type { ReactNode } from 'react';

export default function PageContainer({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      </div>
      {children}
    </div>
  );
}
