# Air Quality Monitor Web (React + Tailwind + Chart.js)

> Repo này gồm 2 phần:
> - **Frontend** (Vite/React) ở thư mục gốc
> - **Backend** (Express + MQTT + MySQL + WS) trong `backend/`

## 1) Chạy nhanh (mock data)
```bash
npm install
cp .env.example .env
# đảm bảo VITE_USE_MOCK=true
npm run dev
```

## 2) Chạy với backend thật
Mở 2 terminal:

**Terminal 1 (backend):**
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

**Terminal 2 (frontend):**
```bash
cd ..
npm install
# (khuyến nghị) để trống VITE_API_BASE -> frontend gọi /api và dùng Vite proxy
cp .env.example .env
sed -i 's/VITE_USE_MOCK=true/VITE_USE_MOCK=false/' .env
npm run dev
```

## 3) API contract tối thiểu
- `GET /api/devices` → `Device[]`
- `GET /api/latest?device_id=...` → `Reading`
- `GET /api/history?device_id=...&from=ISO&to=ISO&interval=1m` → `{ points: Reading[] }`
- `GET /api/alerts?device_id=...&from=ISO&to=ISO` → `AlertItem[]`
- `GET /api/settings?device_id=...` → `ThresholdSettings`
- `POST /api/settings` body: `ThresholdSettings` → `{ ok: true }`

## 4) Luồng realtime
Hiện tại web dùng **polling** (2s) ở trang Realtime.
Nếu muốn nâng cấp: dùng WebSocket / Socket.IO để backend push dữ liệu.

---

## Deploy lên host server (VPS)

Mục tiêu: truy cập web qua 1 domain (HTTPS) và API/WS dùng cùng domain:
- API: `https://your-domain.com/api`
- WS: `wss://your-domain.com/ws`

### A) Deploy đơn giản (1 Node process serve luôn frontend)

1) Build frontend
```bash
npm ci
npm run build   # tạo thư mục dist/
```

2) Build backend
```bash
cd backend
npm ci
npm run build   # tạo backend/dist/
```

3) Tạo file `backend/.env` trên server (ví dụ)
```env
API_PORT=8080
WS_PATH=/ws
MQTT_URL=mqtt://broker.emqx.io:1883
TOPIC_SUB=hluan/aqm/+/telemetry

# MySQL (tuỳ chọn)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=air_quality_monitor
```

4) Chạy backend (nó sẽ tự serve `dist/` nếu tồn tại)
```bash
node dist/index.js
```

### B) Reverse proxy bằng Nginx (khuyên dùng)

- Nginx listen 80/443 và proxy về Node port 8080.
- File mẫu: `deploy/nginx.conf`.

### C) Chạy nền bằng PM2

- File mẫu: `deploy/ecosystem.config.cjs`.
