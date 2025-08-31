import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import app from './index';

// Load environment variables from .env file
config();

// In-memory storage for local development
const inMemoryKV = new Map<string, string>();

// Mock environment for local development
const mockEnv = {
  SESSIONS: {
    get: async (key: string) => {
      const value = inMemoryKV.get(key);
      console.log(`KV GET: ${key} => ${value ? 'found' : 'not found'}`);
      return value || null;
    },
    put: async (key: string, value: string, options?: any) => {
      inMemoryKV.set(key, value);
      console.log(`KV PUT: ${key} => stored`);
      return undefined;
    },
    delete: async (key: string) => {
      const deleted = inMemoryKV.delete(key);
      console.log(`KV DELETE: ${key} => ${deleted ? 'deleted' : 'not found'}`);
      return undefined;
    },
    list: async (options?: any) => {
      const keys = Array.from(inMemoryKV.keys()).map(name => ({ name }));
      console.log(`KV LIST: ${keys.length} keys found`);
      return {
        keys,
        list_complete: true,
        cursor: undefined
      };
    },
    getWithMetadata: async (key: string) => {
      const value = inMemoryKV.get(key);
      console.log(`KV GET_WITH_METADATA: ${key} => ${value ? 'found' : 'not found'}`);
      return {
        value: value || null,
        metadata: null
      };
    }
  } as unknown as KVNamespace,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URL: process.env.GOOGLE_REDIRECT_URL || 'http://localhost:5001/api/auth/google/callback',
  SOLAPI_CLIENT_ID: process.env.SOLAPI_CLIENT_ID || '',
  SOLAPI_CLIENT_SECRET: process.env.SOLAPI_CLIENT_SECRET || '',
  SOLAPI_REDIRECT_URL: process.env.SOLAPI_REDIRECT_URL || 'http://localhost:5001/api/solapi/auth/callback',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  EMAIL_HASH_SALT: process.env.EMAIL_HASH_SALT || 'test-email-hash-salt-change-in-production-123456789',
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-development',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Create a mock context function
function createMockContext() {
  return {
    env: mockEnv,
  };
}

const port = 5001;
console.log(`Hono server is running on port ${port}`);

serve({
  fetch: (req) => {
    // Add mock env to the request context
    return app.fetch(req, mockEnv);
  },
  port,
});