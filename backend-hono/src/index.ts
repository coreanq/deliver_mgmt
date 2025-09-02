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
import automationRoutes from './routes/automation';
import migrationRoutes from './routes/migration';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin, c) => {
    // Allow development origins
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
    ];
    
    // Allow production origins from environment
    const prodOrigins = [
      c.env?.FRONTEND_URL,
      'https://deliver-mgmt.pages.dev',
    ].filter(Boolean);
    
    const allowedOrigins = [...devOrigins, ...prodOrigins];
    
    // Debug CORS
    console.log('CORS origin check:', { 
      origin, 
      allowedOrigins,
      userAgent: c.req.header('user-agent')?.substring(0, 50) + '...',
      referer: c.req.header('referer') 
    });
    
    // Allow Cloudflare Pages domains (.pages.dev)
    if (origin && origin.includes('.pages.dev')) {
      console.log('Allowing .pages.dev origin:', origin);
      return origin;
    }
    
    // Allow specific origins
    if (origin && allowedOrigins.includes(origin)) {
      console.log('Allowing specific origin:', origin);
      return origin;
    }
    
    // For OAuth redirects without origin header, check referer
    const referer = c.req.header('referer');
    if (!origin && referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (allowedOrigins.includes(refererOrigin) || refererOrigin.includes('.pages.dev')) {
          console.log('Allowing based on referer:', refererOrigin);
          return refererOrigin;
        }
      } catch (e) {
        console.log('Invalid referer URL:', referer);
      }
    }
    
    // Default to production frontend for OAuth callbacks
    if (!origin && c.env?.FRONTEND_URL) {
      console.log('No origin, defaulting to FRONTEND_URL:', c.env.FRONTEND_URL);
      return c.env.FRONTEND_URL;
    }
    
    console.log('Rejecting origin:', origin);
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Session-ID', 
    'Cookie'
  ],
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
app.route('/api/automation', automationRoutes);
app.route('/api/migration', migrationRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    message: '요청한 경로를 찾을 수 없습니다.',
  }, 404);
});

// Error handler
app.onError((err, c) => {
  const correlationId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  console.error(`[${correlationId}] Error:`, err);
  return c.json({
    success: false,
    code: 'INTERNAL_ERROR',
    correlationId,
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500);
});

export default app;
