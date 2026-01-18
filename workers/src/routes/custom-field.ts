import { Hono } from 'hono';
import type { Env, CustomFieldDefinition } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId } from '../lib/utils';

const customField = new Hono<{ Bindings: Env }>();

// 최대 커스텀 필드 개수
const MAX_CUSTOM_FIELDS = 5;

// 관리자 인증 헬퍼
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

// 커스텀 필드 목록 조회 (관리자용)
customField.get('/', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const fields = await c.env.DB.prepare(
      'SELECT * FROM custom_field_definitions WHERE admin_id = ? ORDER BY field_order ASC, created_at ASC'
    )
      .bind(admin.sub)
      .all<CustomFieldDefinition>();

    return c.json({
      success: true,
      data: { fields: fields.results || [] },
    });
  } catch (error) {
    console.error('Custom field list error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 커스텀 필드 목록 조회 (배송담당자용 - 편집권한 정보 포함)
customField.get('/staff', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // 관리자 또는 배송담당자 모두 조회 가능
  const adminId = payload.role === 'admin' ? payload.sub : payload.adminId;
  if (!adminId) {
    return c.json({ success: false, error: 'Admin ID not found' }, 400);
  }

  try {
    const fields = await c.env.DB.prepare(
      'SELECT * FROM custom_field_definitions WHERE admin_id = ? ORDER BY field_order ASC, created_at ASC'
    )
      .bind(adminId)
      .all<CustomFieldDefinition>();

    return c.json({
      success: true,
      data: { fields: fields.results || [] },
    });
  } catch (error) {
    console.error('Custom field staff list error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 커스텀 필드 생성
customField.post('/', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    // 현재 필드 개수 확인
    const existingCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM custom_field_definitions WHERE admin_id = ?'
    )
      .bind(admin.sub)
      .first<{ count: number }>();

    if ((existingCount?.count || 0) >= MAX_CUSTOM_FIELDS) {
      return c.json({
        success: false,
        error: `커스텀 필드는 최대 ${MAX_CUSTOM_FIELDS}개까지만 생성할 수 있습니다.`,
      }, 400);
    }

    const { fieldKey, fieldName, isEditableByStaff } = await c.req.json<{
      fieldKey: string;
      fieldName: string;
      isEditableByStaff?: boolean;
    }>();

    if (!fieldKey || !fieldName) {
      return c.json({ success: false, error: '필드키와 필드명은 필수입니다.' }, 400);
    }

    // fieldKey 유효성 검사 (영문, 숫자, 언더스코어만 허용)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
      return c.json({
        success: false,
        error: '필드키는 영문으로 시작하고, 영문/숫자/언더스코어만 사용할 수 있습니다.',
      }, 400);
    }

    // 중복 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM custom_field_definitions WHERE admin_id = ? AND field_key = ?'
    )
      .bind(admin.sub, fieldKey)
      .first();

    if (existing) {
      return c.json({
        success: false,
        error: '이미 동일한 필드키가 존재합니다.',
      }, 400);
    }

    const id = generateId();
    const now = new Date().toISOString();
    const fieldOrder = (existingCount?.count || 0) + 1;

    await c.env.DB.prepare(
      `INSERT INTO custom_field_definitions (id, admin_id, field_key, field_name, field_order, is_editable_by_staff, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, admin.sub, fieldKey, fieldName, fieldOrder, isEditableByStaff ? 1 : 0, now, now)
      .run();

    return c.json({
      success: true,
      data: { id, fieldKey, fieldName, fieldOrder, isEditableByStaff: isEditableByStaff || false },
    });
  } catch (error) {
    console.error('Custom field create error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 커스텀 필드 수정
customField.put('/:id', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM custom_field_definitions WHERE id = ? AND admin_id = ?'
    )
      .bind(id, admin.sub)
      .first<CustomFieldDefinition>();

    if (!existing) {
      return c.json({ success: false, error: '필드를 찾을 수 없습니다.' }, 404);
    }

    const { fieldName, isEditableByStaff, fieldOrder } = await c.req.json<{
      fieldName?: string;
      isEditableByStaff?: boolean;
      fieldOrder?: number;
    }>();

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (fieldName !== undefined) {
      updates.push('field_name = ?');
      values.push(fieldName);
    }
    if (isEditableByStaff !== undefined) {
      updates.push('is_editable_by_staff = ?');
      values.push(isEditableByStaff ? 1 : 0);
    }
    if (fieldOrder !== undefined) {
      updates.push('field_order = ?');
      values.push(fieldOrder);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: '수정할 필드가 없습니다.' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id, admin.sub);

    await c.env.DB.prepare(
      `UPDATE custom_field_definitions SET ${updates.join(', ')} WHERE id = ? AND admin_id = ?`
    )
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Custom field update error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 커스텀 필드 삭제
customField.delete('/:id', async (c) => {
  const admin = await getAdminFromToken(c);
  if (!admin) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM custom_field_definitions WHERE id = ? AND admin_id = ?'
    )
      .bind(id, admin.sub)
      .run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: '필드를 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Custom field delete error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default customField;
