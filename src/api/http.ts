import axios from 'axios';

const baseURL = String(import.meta.env.VITE_API_BASE || '').trim() || 'http://localhost:3000/api';

export const http = axios.create({
    baseURL,
    timeout: 8000,
});

export function isMockEnabled(): boolean {
    return String(import.meta.env.VITE_USE_MOCK || '').trim().toLowerCase() === 'true';
}
