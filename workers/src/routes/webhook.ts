import { Hono } from 'hono';
import type { Env, WebhookSettings } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId, getISOString } from '../lib/utils';

const webhook = new Hono<{ Bindings: Env }>();

// 인증 미들웨어
webhook.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  // @ts-expect-error
  c.payload = payload;
  await next();
});

// 설정 조회
webhook.get('/', async (c) => {
  // @ts-expect-error
  const adminId = c.payload.sub;
  
  try {
    const settings = await c.env.DB.prepare(
      'SELECT * FROM webhook_settings WHERE admin_id = ?'
    )
      .bind(adminId)
      .first<WebhookSettings>();

    return c.json({
      success: true,
      data: settings || { url: '', enabled: 1 },
    });
  } catch (error) {
    console.error('Webhook settings error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 설정 저장
webhook.post('/', async (c) => {
  // @ts-expect-error
  const adminId = c.payload.sub;
  const { url, enabled } = await c.req.json<{ url: string; enabled: boolean }>();

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM webhook_settings WHERE admin_id = ?'
    )
      .bind(adminId)
      .first<WebhookSettings>();

    const now = getISOString();

    if (existing) {
      await c.env.DB.prepare(
        'UPDATE webhook_settings SET url = ?, enabled = ?, updated_at = ? WHERE admin_id = ?'
      )
        .bind(url, enabled ? 1 : 0, now, adminId)
        .run();
    } else {
      const id = generateId();
      await c.env.DB.prepare(
        'INSERT INTO webhook_settings (id, admin_id, url, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(id, adminId, url, enabled ? 1 : 0, now, now)
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook save error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 테스트 발송
webhook.post('/test', async (c) => {
  // @ts-expect-error
  const adminId = c.payload.sub;
  const { url } = await c.req.json<{ url?: string }>();

  try {
    // URL이 제공되면 해당 URL로, 아니면 저장된 URL로 테스트
    let targetUrl = url;
    if (!targetUrl) {
      const settings = await c.env.DB.prepare(
        'SELECT url FROM webhook_settings WHERE admin_id = ?'
      )
        .bind(adminId)
        .first<{ url: string }>();
      targetUrl = settings?.url;
    }

    if (!targetUrl) {
      return c.json({ success: false, error: 'No webhook URL configured' }, 400);
    }

    const testPayload = {
      message: 'This is a test webhook from Delivery Management System',
      timestamp: new Date().toISOString(),
      test: true,
      sample_delivery: {
        id: 'test_delivery_id',
        recipient_name: '홍길동',
        recipient_phone: '010-1234-5678',
        recipient_address: '서울시 강남구 테헤란로 123',
        product_name: '테스트 상품',
        quantity: 1,
        status: 'completed',
        delivery_date: new Date().toISOString().split('T')[0],
        staff_name: '김배송',
        memo: '문 앞에 놓아주세요',
        custom_fields: {
          'custom_field_1': '추가 정보'
        }
      }
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Delivery-Event': 'test',
      },
      body: JSON.stringify({
        event: 'test',
        timestamp: new Date().toISOString(),
        data: testPayload,
      }),
    });

    if (response.ok) {
      return c.json({ success: true, message: 'Webhook sent successfully' });
    } else {
      return c.json({ success: false, error: `Webhook failed with status ${response.status}` }, 400);
    }
  } catch (error) {
    console.error('Webhook test error:', error);
    return c.json({ success: false, error: 'Failed to send webhook' }, 500);
  }
});

export default webhook;
