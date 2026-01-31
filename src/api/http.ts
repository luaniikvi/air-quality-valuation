import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export const http = axios.create({
  baseURL,
  timeout: 8000
});

export function isMockEnabled(): boolean {
  return String(import.meta.env.VITE_USE_MOCK || '').toLowerCase() === 'true';
}
