import { Hono } from 'hono';
import type { Env, SmsTemplate, Subscription } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId } from '../lib/utils';
import { getPlanConfig } from '../lib/plans';

const smsTemplate = new Hono<{ Bindings: Env }>();

const SMS_VARIABLE_MAP: Record<string, string> = {
  '수령인': 'recipientName',
  '연락처': 'recipientPhone',
  '주소': 'recipientAddress',
  '상품명': 'productName',
  '수량': 'quantity',
  '배송담당자': 'staffName',
  '배송일': 'deliveryDate',
  '메모': 'memo',
};

async function getAdminFromToken(c: { req: { header: (name: string) => string | undefined }; env: Env }) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return null;
  }

  return payload;
}

smsTemplate.get('/', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const templates = await c.env.DB.prepare(
      'SELECT * FROM sms_templates WHERE admin_id = ? ORDER BY is_default DESC, created_at DESC'
    )
      .bind(admin.sub)
      .all<SmsTemplate>();

    return c.json({
      success: true,
      data: { templates: templates.results || [] },
    });
  } catch (error) {
    console.error('SMS template list error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

smsTemplate.get('/default', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const adminId = payload.role === 'admin' ? payload.sub : payload.adminId;
  if (!adminId) {
    return c.json({ success: false, error: 'Admin ID not found' }, 400);
  }

  try {
    const template = await c.env.DB.prepare(
      'SELECT * FROM sms_templates WHERE admin_id = ? AND is_default = 1 LIMIT 1'
    )
      .bind(adminId)
      .first<SmsTemplate>();

    return c.json({
      success: true,
      data: { template },
    });
  } catch (error) {
    console.error('SMS template default error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

smsTemplate.post('/', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const sub = await c.env.DB.prepare('SELECT type FROM subscriptions WHERE admin_id = ?')
      .bind(admin.sub)
      .first<Pick<Subscription, 'type'>>();
    const planConfig = getPlanConfig(sub?.type || 'free');

    const existingCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM sms_templates WHERE admin_id = ?'
    )
      .bind(admin.sub)
      .first<{ count: number }>();

    if ((existingCount?.count || 0) >= planConfig.smsTemplateLimit) {
      return c.json({
        success: false,
        error: `템플릿은 ${planConfig.smsTemplateLimit}개만 저장할 수 있습니다. 기존 템플릿을 수정해주세요.`
      }, 400);
    }

    const { name, content } = await c.req.json<{
      name: string;
      content: string;
    }>();

    if (!name || !content) {
      return c.json({ success: false, error: 'Name and content are required' }, 400);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO sms_templates (id, admin_id, name, content, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(id, admin.sub, name, content, now, now)
      .run();

    return c.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('SMS template create error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

smsTemplate.put('/:id', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM sms_templates WHERE id = ? AND admin_id = ?'
    )
      .bind(id, admin.sub)
      .first<SmsTemplate>();

    if (!existing) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const { name, content, isDefault } = await c.req.json<{
      name?: string;
      content?: string;
      isDefault?: boolean;
    }>();

    if (isDefault) {
      await c.env.DB.prepare(
        'UPDATE sms_templates SET is_default = 0 WHERE admin_id = ?'
      )
        .bind(admin.sub)
        .run();
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(isDefault ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id, admin.sub);

    await c.env.DB.prepare(
      `UPDATE sms_templates SET ${updates.join(', ')} WHERE id = ? AND admin_id = ?`
    )
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('SMS template update error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

smsTemplate.delete('/:id', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM sms_templates WHERE id = ? AND admin_id = ?'
    )
      .bind(id, admin.sub)
      .run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('SMS template delete error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

smsTemplate.get('/variables', (c) => {
  return c.json({
    success: true,
    data: {
      variables: Object.entries(SMS_VARIABLE_MAP).map(([label, key]) => ({
        label,
        key,
        placeholder: `\${${label}}`,
      })),
    },
  });
});

export default smsTemplate;
