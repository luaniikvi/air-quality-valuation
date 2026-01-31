import PageContainer from '../components/layout/PageContainer';

export default function About() {
  return (
    <PageContainer title="About (Giới thiệu)">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-700">
          <div className="text-lg font-semibold">Air Quality Monitor with Clock & Warning</div>
          <div className="mt-2">
            Website hiển thị dữ liệu từ ESP32 (MQTT → Backend → MySQL) và biểu đồ theo thời gian.
          </div>

          <div className="mt-4 text-sm font-semibold">Environment</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>
              <code>VITE_API_BASE</code>: base URL cho API (mặc định <code>http://localhost:3000/api</code>)
            </li>
            <li>
              <code>VITE_USE_MOCK=true</code>: bật dữ liệu giả để demo UI không cần backend
            </li>
          </ul>

          <div className="mt-4 text-sm font-semibold">Endpoints tối thiểu</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>GET /devices</li>
            <li>POST /devices</li>
            <li>GET /latest?device_id=...</li>
            <li>GET /history?device_id=...&amp;from=...&amp;to=...&amp;interval=...</li>
            <li>GET /alerts?device_id=...&amp;from=...&amp;to=...</li>
            <li>GET /settings?device_id=...</li>
            <li>POST /settings</li>
          </ul>
        </div>
      </div>
    </PageContainer>
  );
}
