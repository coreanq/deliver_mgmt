import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';

// 라우트 임포트
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/delivery';
import uploadRoutes from './routes/upload';
import subscriptionRoutes from './routes/subscription';
import smsTemplateRoutes from './routes/sms-template';
import customFieldRoutes from './routes/custom-field';
import r2Routes from './routes/r2';

// Cron 임포트
import { cleanupExpiredData } from './cron/cleanup';

const app = new Hono<{ Bindings: Env }>();

// 미들웨어
app.use('*', logger());
app.use('/api/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.WORKER_BASE_URL,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// 헬스 체크 (API 전용) - ApiResponse 형식으로 반환
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      name: 'deliver-mgmt-worker',
      version: '1.0.0',
      buildDate: c.env.BUILD_DATE,
      status: 'healthy',
    },
  });
});

// 앱 디버그 로그 (wrangler tail로 확인)
app.post('/api/log', async (c) => {
  const body = await c.req.json();
  console.log('[APP_LOG]', JSON.stringify(body));
  return c.json({ ok: true });
});

// API 라우트
app.route('/api/auth', authRoutes);
app.route('/api/delivery', deliveryRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/subscription', subscriptionRoutes);
app.route('/api/sms-template', smsTemplateRoutes);
app.route('/api/custom-field', customFieldRoutes);

// R2 파일 서빙 (Public Access 대신 Worker에서 처리)
app.route('/r2', r2Routes);

// Magic Link 검증 - 모바일은 앱으로, PC는 웹으로
app.get('/auth/verify', (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.text('Invalid link', 400);
  }

  const userAgent = c.req.header('User-Agent') || '';
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    const deepLink = `deliver-mgmt://auth/verify?token=${token}`;
    return c.redirect(deepLink, 302);
  } else {
    return c.redirect(`/login?token=${token}`, 302);
  }
});

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
