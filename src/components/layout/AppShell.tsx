import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="min-h-screen flex-1">
        <Topbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
