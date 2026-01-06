import { Hono } from 'hono';
import type { Env, SmsTemplate, Subscription } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId } from '../lib/utils';
import { callAI } from '../services/ai';

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

async function isPro(db: D1Database, adminId: string): Promise<boolean> {
  const sub = await db.prepare('SELECT type FROM subscriptions WHERE admin_id = ?')
    .bind(adminId)
    .first<Pick<Subscription, 'type'>>();
  return sub?.type === 'pro';
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

    if (!template) {
      return c.json({
        success: true,
        data: { template: null },
      });
    }

    const userIsPro = await isPro(c.env.DB, adminId);

    return c.json({
      success: true,
      data: {
        template: {
          ...template,
          use_ai: userIsPro ? template.use_ai : 0,
        },
        isPro: userIsPro,
      },
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
    const { name, content, useAi, isDefault } = await c.req.json<{
      name: string;
      content: string;
      useAi?: boolean;
      isDefault?: boolean;
    }>();

    if (!name || !content) {
      return c.json({ success: false, error: 'Name and content are required' }, 400);
    }

    const userIsPro = await isPro(c.env.DB, admin.sub);
    const finalUseAi = userIsPro && useAi ? 1 : 0;

    if (isDefault) {
      await c.env.DB.prepare(
        'UPDATE sms_templates SET is_default = 0 WHERE admin_id = ?'
      )
        .bind(admin.sub)
        .run();
    }

    const id = generateId();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO sms_templates (id, admin_id, name, content, use_ai, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, admin.sub, name, content, finalUseAi, isDefault ? 1 : 0, now, now)
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

    const { name, content, useAi, isDefault } = await c.req.json<{
      name?: string;
      content?: string;
      useAi?: boolean;
      isDefault?: boolean;
    }>();

    const userIsPro = await isPro(c.env.DB, admin.sub);

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
    if (useAi !== undefined) {
      updates.push('use_ai = ?');
      values.push(userIsPro && useAi ? 1 : 0);
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

smsTemplate.post('/generate', async (c) => {
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

  const userIsPro = await isPro(c.env.DB, adminId);
  if (!userIsPro) {
    return c.json({ success: false, error: 'PRO subscription required' }, 403);
  }

  try {
    const { templateContent, variables } = await c.req.json<{
      templateContent: string;
      variables: Record<string, string>;
    }>();

    if (!templateContent || !variables) {
      return c.json({ success: false, error: 'Template content and variables are required' }, 400);
    }

    const systemPrompt = `당신은 배송 완료 SMS 메시지를 작성하는 전문가입니다.
주어진 가이드라인과 배송 정보를 바탕으로 친근하고 감동적인 SMS 메시지를 작성해주세요.

규칙:
- 메시지는 80자 이내로 짧고 간결하게
- 이모지는 1-2개만 적절히 사용
- 매번 다른 표현을 사용하여 신선함 유지
- 수신자의 이름과 상품명은 반드시 포함
- 배송 완료 알림임을 명확히

JSON 형식으로 응답: {"message": "생성된 메시지"}`;

    const userMessage = `가이드라인: ${templateContent}

배송 정보:
- 수령인: ${variables.recipientName || '고객'}
- 상품명: ${variables.productName || '상품'}
- 수량: ${variables.quantity || '1'}
- 배송담당자: ${variables.staffName || '담당자'}`;

    const result = await callAI(c.env, systemPrompt, userMessage, { maxTokens: 200 });

    try {
      const parsed = JSON.parse(result.text);
      return c.json({
        success: true,
        data: { message: parsed.message },
      });
    } catch {
      const messageMatch = result.text.match(/"message"\s*:\s*"([^"]+)"/);
      if (messageMatch) {
        return c.json({
          success: true,
          data: { message: messageMatch[1] },
        });
      }
      return c.json({
        success: true,
        data: { message: result.text.trim() },
      });
    }
  } catch (error) {
    console.error('SMS generate error:', error);
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
