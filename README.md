# Air Quality Monitor Web (React + Tailwind + Chart.js)

## 1) Chạy nhanh (mock data)
```bash
npm install
cp .env.example .env
# đảm bảo VITE_USE_MOCK=true
npm run dev
```

## 2) Chạy với backend thật
Trong `.env`:
```
VITE_API_BASE=http://localhost:3000/api
VITE_USE_MOCK=false
```
Sau đó:
```bash
npm run dev
```

## 3) API contract tối thiểu
- `GET /api/devices` → `Device[]`
- `GET /api/latest?device_id=...` → `Reading`
- `GET /api/history?device_id=...&from=ISO&to=ISO&interval=1m` → `{ points: Reading[] }`
- `GET /api/alerts?device_id=...&from=ISO&to=ISO` → `AlertItem[]`
- `GET /api/settings?device_id=...` → `ThresholdSettings`
- `POST /api/settings` body: `ThresholdSettings` → `{ ok: true }`

## 4) Gợi ý luồng realtime
Hiện tại web dùng **polling** (2s) ở trang Realtime.
Nếu muốn nâng cấp: dùng WebSocket / Socket.IO để backend push dữ liệu.
