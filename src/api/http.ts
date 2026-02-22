// import axios from 'axios';

// const baseURL = String(import.meta.env.VITE_API_BASE || '').trim() || 'http://localhost:3000/api';

// export const http = axios.create({
//     baseURL,
//     timeout: 8000,
// });

// export function isMockEnabled(): boolean {
//     return String(import.meta.env.VITE_USE_MOCK || '').trim().toLowerCase() === 'true';
// }
import axios from 'axios';

const baseURL = String(import.meta.env.VITE_API_BASE || '').trim() || 'http://localhost:3000/api';

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
                const timedOut = err.code === 'ECONNABORTED';
                const hint = timedOut
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
