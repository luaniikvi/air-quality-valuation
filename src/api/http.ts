import axios from 'axios';

// Prefer a relative base URL so the app can be deployed behind a reverse proxy
// without changing any code (same-origin: https://your-domain.com/api).
// For local dev you can either:
// - set VITE_API_BASE=http://localhost:8080/api, or
// - rely on Vite proxy (/api -> localhost:8080)
const baseURL = String(import.meta.env.VITE_API_BASE || '').trim() || '/api';

export const http = axios.create({
    baseURL,
    timeout: 8000,
});

// Normalize Axios errors so Ctx.error is more useful than just "Network Error".
http.interceptors.response.use(
    (res) => res,
    (err: unknown) => {
        if (axios.isAxiosError(err)) {
            // No response => DNS/connection/CORS/mixed-content/timeout...
            if (!err.response) {
                const timedOut: boolean = err.code === 'ECONNABORTED';
                const hint: string = timedOut
                    ? 'Request bị timeout'
                    : 'Không kết nối được tới backend (backend chưa chạy / sai URL / bị CORS / mixed-content)';
                return Promise.reject(new Error(`${hint}. API_BASE=${baseURL}`));
            }

            const status = err.response.status;
            const data: any = err.response.data;
            const msg = typeof data?.message === 'string' ? data.message : err.message;
            return Promise.reject(new Error(`[HTTP ${status}] ${msg}`));
        }

        return Promise.reject(err);
    }
);

export function isMockEnabled(): boolean {
    return String(import.meta.env.VITE_USE_MOCK || '').trim().toLowerCase() === 'true';
}