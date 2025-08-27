import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env, Variables } from './types';

// Import routes
import authRoutes from './routes/auth';
import sheetsRoutes from './routes/sheets';
import solapiRoutes from './routes/solapi';
import deliveryRoutes from './routes/delivery';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin, c) => {
    // Allow development origins
    const devOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
    
    // Allow production origins from environment
    const prodOrigins = [
      c.env?.FRONTEND_URL,
      // Add your actual Cloudflare Pages domain here
      'https://deliver-mgmt.pages.dev',
      // Allow any *.pages.dev domain for Cloudflare Pages
    ].filter(Boolean);
    
    const allowedOrigins = [...devOrigins, ...prodOrigins];
    
    // Debug CORS
    console.log('CORS origin check:', { origin, allowedOrigins });
    
    // Allow Cloudflare Pages domains
    if (origin && origin.includes('.pages.dev')) {
      console.log('Allowing .pages.dev origin:', origin);
      return origin;
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      console.log('Allowing origin:', origin);
      return origin || allowedOrigins[0]; // Return specific origin instead of '*'
    }
    console.log('Rejecting origin:', origin);
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Session-ID', 
    'Cookie',
    'Set-Cookie'
  ],
  exposeHeaders: ['Set-Cookie'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    success: true,
    message: '서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/sheets', sheetsRoutes);
app.route('/api/solapi', solapiRoutes);
app.route('/api/delivery', deliveryRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    message: '요청한 경로를 찾을 수 없습니다.',
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500);
});

export default app;