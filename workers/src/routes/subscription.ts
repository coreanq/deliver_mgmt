import { Hono } from 'hono';
import type { Env, Subscription } from '../types';
import { verifyToken } from '../lib/jwt';
import { getUsageForDate } from '../lib/usage';
import { getTodayKST } from '../lib/utils';
import { getPlanConfig, UNLIMITED } from '../lib/plans';

const subscription = new Hono<{ Bindings: Env }>();

// 구독 상태 조회
subscription.get('/status', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const admin = await c.env.DB.prepare(
      'SELECT email FROM admins WHERE id = ?'
    )
      .bind(payload.sub)
      .first<{ email: string }>();

    if (!admin) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const testEmails = (c.env.TEST_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const isTestAccount = testEmails.includes(admin.email.toLowerCase());

    let sub = await c.env.DB.prepare(
      'SELECT * FROM subscriptions WHERE admin_id = ?'
    )
      .bind(payload.sub)
      .first<Subscription>();

    // 구독 정보가 없으면 기본 무료 구독 생성
    if (!sub) {
      const { generateId } = await import('../lib/utils');
      await c.env.DB.prepare(
        'INSERT INTO subscriptions (id, admin_id, type, retention_days) VALUES (?, ?, ?, ?)'
      )
        .bind(generateId(), payload.sub, 'free', 3)
        .run();

      sub = {
        id: '',
        admin_id: payload.sub,
        type: 'free',
        retention_days: 3,
        expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const isPro = isTestAccount || sub.type !== 'free';
    const planConfig = getPlanConfig(sub.type);
    
    const deliveryDate = c.req.query('date') || getTodayKST();
    const currentUsage = await getUsageForDate(c.env.DB, payload.sub, deliveryDate);
    const remaining = planConfig.dailyLimit === UNLIMITED 
      ? UNLIMITED 
      : Math.max(0, planConfig.dailyLimit - currentUsage);

    return c.json({
      success: true,
      data: {
        type: sub.type,
        retentionDays: sub.retention_days,
        expiresAt: sub.expires_at,
        isPro,
        dailyLimit: planConfig.dailyLimit,
        currentUsage,
        remaining,
        deliveryDate,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 구독 업그레이드 (추후 결제 시스템 연동)
subscription.post('/upgrade', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { type } = await c.req.json<{ type: 'basic' | 'pro' }>();

  if (!['basic', 'pro'].includes(type)) {
    return c.json({ success: false, error: 'Invalid subscription type' }, 400);
  }

  // TODO: 결제 시스템 연동 후 구현
  // 현재는 에러 반환
  return c.json({
    success: false,
    error: 'Payment system not implemented yet',
  }, 501);
});

export default subscription;
