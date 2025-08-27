// API Configuration for different environments
export const getApiBaseUrl = (): string => {
  // Check if we're in development
  if (import.meta.env.DEV) {
    return 'http://localhost:5001';
  }
  
  // Check for custom API URL in environment
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  
  // Default production API URL (Cloudflare Workers)
  // Replace 'your-worker-name' with your actual worker name
  return 'https://delivery-management-backend.your-username.workers.dev';
};

export const API_BASE_URL = getApiBaseUrl();