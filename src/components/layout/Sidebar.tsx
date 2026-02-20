import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const items = [
  { to: '/', label: 'Dashboard' },
  { to: '/history', label: 'History & Charts' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/devices', label: 'Devices' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' }
];

export default function Sidebar() {
  const { pathname } = useLocation();

  const activeLabel = useMemo(() => {
    if (pathname === '/') return items[0].label;
    const found = items
      .filter((it) => it.to !== '/')
      .sort((a, b) => b.to.length - a.to.length)
      .find((it) => pathname.startsWith(it.to));
    return found?.label || items[0].label;
  }, [pathname]);

  return (
    <aside className="sticky top-0 self-start flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
      <div className="rounded-2xl bg-slate-900 px-3 py-3 text-white">
        <div className="text-sm opacity-80">Air Quality Monitor</div>
        <div className="text-lg font-semibold">{activeLabel}</div>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
            end={it.to === '/'}
          >
            {it.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 text-xs text-slate-500">
        <div>v3.1.8</div>
        <div className="mt-1">ESP32 • MQTT • MySQL</div>
      </div>
    </aside>
  );
}
