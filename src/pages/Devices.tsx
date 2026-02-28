import { useMemo, useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import { useDeviceContext } from '../components/layout/DeviceProvider';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import { addDevice, disconnectDevice, updateDevice } from '../api/sensorApi';
import type { Device } from '../types';

export default function Devices() {
  const { devices, deviceId, setDeviceId, loading, error, refresh } = useDeviceContext();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ device_id: string; name: string }>({ device_id: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectErr, setDisconnectErr] = useState<string | null>(null);
  const [target, setTarget] = useState<Device | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<{ name: string }>({ name: '' });

  const noDevices = devices.length === 0;
  const canSubmit = useMemo(() => form.device_id.trim().length > 0 && !saving, [form.device_id, saving]);

  async function onAdd() {
    try {
      setLocalErr(null);
      setSaving(true);

      const created = await addDevice({
        device_id: form.device_id.trim(),
        name: form.name.trim() || undefined,
      });

      await refresh();
      setDeviceId(created.device_id);
      setOpen(false);
      setForm({ device_id: '', name: '' });
    } catch (e: any) {
      setLocalErr(e?.message || 'Không thêm được thiết bị');
    } finally {
      setSaving(false);
    }
  }

  async function onEditConfirm() {
    if (!editTarget) return;
    try {
      setEditErr(null);
      setEditing(true);

      await updateDevice(editTarget.device_id, {
        name: editForm.name.trim() || undefined,
      });

      await refresh();
      setEditOpen(false);
      setEditTarget(null);
    } catch (e: any) {
      setEditErr(e?.message || 'Không thể cập nhật thiết bị');
    } finally {
      setEditing(false);
    }
  }

  async function onDisconnectConfirm() {
    if (!target) return;
    try {
      setDisconnectErr(null);
      setDisconnecting(true);
      await disconnectDevice(target.device_id);
      await refresh();
      setDisconnectOpen(false);
      setTarget(null);
    } catch (e: any) {
      setDisconnectErr(e?.message || 'Không thể ngắt kết nối thiết bị');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <PageContainer title="Devices (Thiết bị)">
      {error ? <ErrorState message={error} /> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">Quản lý danh sách thiết bị. Chọn 1 thiết bị để xem dữ liệu.</div>

        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => setOpen(true)}
        >
          Thêm thiết bị
        </button>
      </div>

      {loading && devices.length === 0 ? (
        <div className="mt-6">
          <Loading />
        </div>
      ) : null}

      {noDevices && !loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Danh sách thiết bị đang rỗng</div>
          <div className="mt-1 text-sm text-slate-600">
            Nhấn <b>Thêm thiết bị</b> để tạo thiết bị mới.
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3">
        {devices.map((d) => {
          const active = d.device_id === deviceId;
          return (
            <div
              key={d.device_id}
              onClick={() => setDeviceId(d.device_id)}
              className={`rounded-2xl border p-4 shadow-sm bg-white transition-colors cursor-pointer hover:bg-slate-50 ${
                active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 text-left rounded-xl px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{d.name || d.device_id}</div>
                    {d.status ? (
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${
                          d.status === 'online'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">ID: {d.device_id}</div>
                  {d.last_seen ? <div className="mt-1 text-xs text-slate-500">Cập nhật: {d.last_seen}</div> : null}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTarget(d);
                      setEditErr(null);
                      setEditForm({ name: d.name || '' });
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </button>

                  <button
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTarget(d);
                      setDisconnectErr(null);
                      setDisconnectOpen(true);
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {active ? <div className="mt-3 text-xs text-slate-600">Đang được chọn</div> : null}
            </div>
          );
        })}
      </div>

      {/* Modal: Add device */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Thêm thiết bị</div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (saving) return;
                  setOpen(false);
                  setLocalErr(null);
                }}
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-600">device_id *</div>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="vd: esp32-001"
                  value={form.device_id}
                  onChange={(e) => setForm({ ...form, device_id: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-600">Tên hiển thị</div>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="vd: ESP32 Phòng bếp"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>

            {localErr ? <div className="mt-3 text-sm text-rose-700">{localErr}</div> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={onAdd}
                disabled={!canSubmit}
              >
                {saving ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Backend - hỗ trợ <code>POST /devices</code> để lưu thiết bị.
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Edit device */}
      {editOpen && editTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Chỉnh sửa thiết bị</div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (editing) return;
                  setEditOpen(false);
                  setEditErr(null);
                  setEditTarget(null);
                }}
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Thiết bị: <b>{editTarget.name || editTarget.device_id}</b>
              </div>
              <div className="mt-1 text-xs text-slate-500">ID: {editTarget.device_id}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-600">Tên hiển thị</div>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="vd: ESP32 Phòng bếp"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ name: e.target.value })}
                />
              </div>
            </div>

            {editErr ? <div className="mt-3 text-sm text-rose-700">{editErr}</div> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (editing) return;
                  setEditOpen(false);
                  setEditErr(null);
                  setEditTarget(null);
                }}
                disabled={editing}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={onEditConfirm}
                disabled={editing}
              >
                {editing ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">Backend thật nên hỗ trợ <code>PATCH /devices/:device_id</code>.</div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm disconnect */}
      {disconnectOpen && target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Xác nhận ngắt kết nối</div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (disconnecting) return;
                  setDisconnectOpen(false);
                  setDisconnectErr(null);
                  setTarget(null);
                }}
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Bạn có chắc muốn ngắt kết nối thiết bị này không?</div>
              <div className="mt-1 text-sm text-slate-700">Thiết bị: <b>{target.name || target.device_id}</b></div>
              <div className="mt-1 text-xs text-slate-500">ID: {target.device_id}</div>
            </div>

            {disconnectErr ? <div className="mt-3 text-sm text-rose-700">{disconnectErr}</div> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (disconnecting) return;
                  setDisconnectOpen(false);
                  setDisconnectErr(null);
                  setTarget(null);
                }}
                disabled={disconnecting}
              >
                Hủy
              </button>
              <button
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                onClick={onDisconnectConfirm}
                disabled={disconnecting}
              >
                {disconnecting ? 'Đang ngắt...' : 'Ngắt kết nối'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">Backend - hỗ trợ <code>DELETE /devices/:device_id</code>.</div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
