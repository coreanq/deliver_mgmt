// API base URL resolution with clear precedence:
// 1) VITE_API_BASE_URL (explicit override)
// 2) Build from VITE_API_BASE_PROTOCOL/HOST/PORT (defaults: http/localhost/5001)
// 3) Production default (Workers)
export const getApiBaseUrl = (): string => {
  const explicit = (import.meta.env.VITE_API_BASE_URL as string) || '';
  if (explicit) return explicit;

  const protocol = (import.meta.env.VITE_API_BASE_PROTOCOL as string) || 'http';
  const host = (import.meta.env.VITE_API_BASE_HOST as string) || 'localhost';
  const port = (import.meta.env.VITE_API_BASE_PORT as string) || '5001';

  // In development, prefer localhost with configured port
  if (import.meta.env.DEV) {
    return `${protocol}://${host}:${port}`;
  }

  // Fallback for production if no explicit URL is provided
  return 'https://deliver-mgmt-backend.coreanq.workers.dev';
};

export const API_BASE_URL = getApiBaseUrl();
