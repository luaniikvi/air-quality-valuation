import { Navigate, Route, Routes } from 'react-router-dom';
import { DeviceProvider } from './components/layout/DeviceProvider';
import AppShell from './components/layout/AppShell';

import Dashboard from './pages/Dashboard';
// import History from './pages/History';
// import Alerts from './pages/Alerts';
import Devices from './pages/Devices';
// import Settings from './pages/Settings';
import About from './pages/About';

export default function App() {
  return (
    <DeviceProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/realtime" element={<Navigate to="/" replace />} />
          {/* <Route path="/history" element={<History />} /> */}
          {/* <Route path="/alerts" element={<Alerts />} /> */}
          <Route path="/devices" element={<Devices />} />
          {/* <Route path="/settings" element={<Settings />} /> */}
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </DeviceProvider>
  );
}
