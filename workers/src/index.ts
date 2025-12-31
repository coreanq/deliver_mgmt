import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';

// 라우트 임포트
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/delivery';
import uploadRoutes from './routes/upload';
import subscriptionRoutes from './routes/subscription';

// Cron 임포트
import { cleanupExpiredData } from './cron/cleanup';

const app = new Hono<{ Bindings: Env }>();

// 미들웨어
app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: [
      'http://localhost:8081',
      'http://localhost:3000',
      'https://try-dabble.com',
      'https://deliver-mgmt-backend.coreanq.workers.dev',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

// 헬스 체크 (API 전용)
app.get('/api/health', (c) => {
  return c.json({
    name: 'deliver-mgmt-backend',
    version: '1.0.0',
    buildDate: c.env.BUILD_DATE,
    status: 'healthy',
  });
});

// API 라우트
app.route('/api/auth', authRoutes);
app.route('/api/delivery', deliveryRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/subscription', subscriptionRoutes);

// 404 핸들러
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// 에러 핸들러
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

// Workers 내보내기
export default {
  fetch: app.fetch,

  // Cron Trigger 핸들러
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Cron triggered at ${new Date().toISOString()}`);
    ctx.waitUntil(cleanupExpiredData(env));
  },
};
