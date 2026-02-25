import { Link } from 'react-router-dom';

export default function NoDeviceState() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">Chưa có thiết bị</div>
      <div className="mt-1 text-sm text-slate-600">
        Danh sách thiết bị đang rỗng. Hãy vào mục <b>Devices</b> để thêm thiết bị trước khi xem dữ liệu.
      </div>
      <div className="mt-4">
        <Link
          to="/devices"
          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Quản lí thiết bị
        </Link>
      </div>
    </div>
  );
}
