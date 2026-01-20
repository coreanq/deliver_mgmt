import { Hono } from 'hono';
import type { Env, Delivery, JWTPayload, CustomFieldDefinition } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId, getTodayKST, getISOString, transformKeys, transformArray } from '../lib/utils';

// 배송 데이터 변환 (custom_fields JSON 파싱 포함)
function transformDelivery(delivery: Delivery): Record<string, unknown> {
  const transformed = transformKeys(delivery);
  if (delivery.custom_fields) {
    try {
      transformed.customFields = JSON.parse(delivery.custom_fields);
    } catch {
      transformed.customFields = null;
    }
  } else {
    transformed.customFields = null;
  }
  return transformed;
}

// 배송 배열 변환
function transformDeliveries(deliveries: Delivery[]): Record<string, unknown>[] {
  return deliveries.map(transformDelivery);
}

const delivery = new Hono<{ Bindings: Env }>();

// 인증 미들웨어
async function authMiddleware(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
  next: () => Promise<void>
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // @ts-expect-error - Adding payload to context
  c.payload = payload;
  return next();
}

// 배송 목록 조회 (관리자)
delivery.get('/list', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const date = c.req.query('date') || getTodayKST();
  const staffName = c.req.query('staffName');

  try {
    let query = 'SELECT * FROM deliveries WHERE admin_id = ? AND delivery_date = ?';
    const params: string[] = [payload.sub, date];

    if (staffName) {
      query += ' AND staff_name = ?';
      params.push(staffName);
    }

    query += ' ORDER BY created_at ASC';

    const result = await c.env.DB.prepare(query).bind(...params).all<Delivery>();

    return c.json({
      success: true,
      data: {
        deliveries: transformDeliveries(result.results || []),
        total: result.results?.length || 0,
      },
    });
  } catch (error) {
    console.error('Delivery list error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송담당자 목록 조회 (관리자)
delivery.get('/staff-list', async (c) => {
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
    // 중복 제거된 배송담당자 이름 목록
    const result = await c.env.DB.prepare(
      'SELECT DISTINCT staff_name FROM deliveries WHERE admin_id = ? AND staff_name IS NOT NULL ORDER BY staff_name'
    )
      .bind(payload.sub)
      .all<{ staff_name: string }>();

    const staffList = (result.results || []).map((r) => r.staff_name);

    return c.json({
      success: true,
      data: { staff: staffList },
    });
  } catch (error) {
    console.error('Staff list error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송담당자별 배송 목록 (배송담당자)
delivery.get('/staff/:name', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'staff') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const name = c.req.param('name');
  // JWT에 date가 있으면 사용, 없으면 오늘 날짜 사용 (하위 호환)
  const targetDate = payload.date || getTodayKST();

  // 본인 배송만 조회 가능
  if (payload.name !== name) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM deliveries WHERE admin_id = ? AND staff_name = ? AND delivery_date = ? ORDER BY created_at ASC'
    )
      .bind(payload.adminId, name, targetDate)
      .all<Delivery>();

    return c.json({
      success: true,
      data: {
        deliveries: transformDeliveries(result.results || []),
        total: result.results?.length || 0,
      },
    });
  } catch (error) {
    console.error('Staff deliveries error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송 상태 변경
delivery.put('/:id/status', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const deliveryId = c.req.param('id');
  const { status } = await c.req.json<{ status: string }>();

  if (!['pending', 'in_transit', 'completed'].includes(status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }

  try {
    // 권한 확인
    const adminId = payload.role === 'admin' ? payload.sub : payload.adminId;

    const existing = await c.env.DB.prepare(
      'SELECT * FROM deliveries WHERE id = ? AND admin_id = ?'
    )
      .bind(deliveryId, adminId)
      .first<Delivery>();

    if (!existing) {
      return c.json({ success: false, error: 'Delivery not found' }, 404);
    }

    // 상태 업데이트
    const updatedAt = getISOString();
    await c.env.DB.prepare(
      'UPDATE deliveries SET status = ?, updated_at = ? WHERE id = ?'
    )
      .bind(status, updatedAt, deliveryId)
      .run();

    return c.json({
      success: true,
      data: transformKeys({ ...existing, status, updated_at: updatedAt }),
    });
  } catch (error) {
    console.error('Status update error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송담당자 수정 (관리자 전용)
delivery.put('/:id/staff', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const deliveryId = c.req.param('id');
  const { staffName } = await c.req.json<{ staffName: string }>();

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM deliveries WHERE id = ? AND admin_id = ?'
    )
      .bind(deliveryId, payload.sub)
      .first<Delivery>();

    if (!existing) {
      return c.json({ success: false, error: 'Delivery not found' }, 404);
    }

    const updatedAt = getISOString();
    await c.env.DB.prepare(
      'UPDATE deliveries SET staff_name = ?, updated_at = ? WHERE id = ?'
    )
      .bind(staffName || null, updatedAt, deliveryId)
      .run();

    return c.json({
      success: true,
      data: { staffName, updatedAt },
    });
  } catch (error) {
    console.error('Staff update error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송 완료 + 사진 업로드
delivery.post('/:id/complete', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'staff') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const deliveryId = c.req.param('id');
  const { photoBase64 } = await c.req.json<{ photoBase64: string }>();

  try {
    // 배송 확인
    const existing = await c.env.DB.prepare(
      'SELECT * FROM deliveries WHERE id = ? AND admin_id = ? AND staff_name = ?'
    )
      .bind(deliveryId, payload.adminId, payload.name)
      .first<Delivery>();

    if (!existing) {
      return c.json({ success: false, error: 'Delivery not found' }, 404);
    }

    let photoUrl: string | null = null;

    // 사진 업로드
    if (photoBase64) {
      // Base64 디코딩
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // R2에 업로드
      const photoKey = `deliveries/${deliveryId}/${Date.now()}.jpg`;
      await c.env.STORAGE.put(photoKey, binaryData, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      });

      // 공개 URL 생성 (환경변수로 도메인 설정)
      photoUrl = `${c.env.WORKER_BASE_URL}/r2/deliver-mgmt/${photoKey}`;
    }

    // 배송 완료 처리
    const completedAt = getISOString();
    await c.env.DB.prepare(
      'UPDATE deliveries SET status = ?, completed_at = ?, photo_url = ?, updated_at = ? WHERE id = ?'
    )
      .bind('completed', completedAt, photoUrl, completedAt, deliveryId)
      .run();

    return c.json({
      success: true,
      data: transformKeys({
        ...existing,
        status: 'completed',
        completed_at: completedAt,
        photo_url: photoUrl,
        updated_at: completedAt,
      }),
    });
  } catch (error) {
    console.error('Complete delivery error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 커스텀 필드 값 수정 (배송담당자용)
delivery.put('/:id/custom-fields', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const deliveryId = c.req.param('id');
  const { customFields } = await c.req.json<{ customFields: Record<string, string> }>();

  if (!customFields || typeof customFields !== 'object') {
    return c.json({ success: false, error: 'customFields is required' }, 400);
  }

  try {
    // 권한 확인
    const adminId = payload.role === 'admin' ? payload.sub : payload.adminId;

    // 배송 정보 조회
    const existing = await c.env.DB.prepare(
      'SELECT * FROM deliveries WHERE id = ? AND admin_id = ?'
    )
      .bind(deliveryId, adminId)
      .first<Delivery>();

    if (!existing) {
      return c.json({ success: false, error: 'Delivery not found' }, 404);
    }

    // 배송담당자인 경우 본인 배송만 수정 가능
    if (payload.role === 'staff' && existing.staff_name !== payload.name) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // 커스텀 필드 정의 조회
    const fieldDefs = await c.env.DB.prepare(
      'SELECT * FROM custom_field_definitions WHERE admin_id = ?'
    )
      .bind(adminId)
      .all<CustomFieldDefinition>();

    const allowedFields = fieldDefs.results || [];

    // 배송담당자인 경우 is_editable_by_staff=1인 필드만 수정 가능
    if (payload.role === 'staff') {
      const editableFieldIds = allowedFields
        .filter(f => f.is_editable_by_staff === 1)
        .map(f => f.id);

      // 편집 불가능한 필드는 제거하고 진행 (앱 업데이트 전 호환성)
      const filteredCustomFields: Record<string, string> = {};
      for (const key of Object.keys(customFields)) {
        if (editableFieldIds.includes(key)) {
          filteredCustomFields[key] = customFields[key];
        }
      }

      // 편집 가능한 필드가 없으면 에러
      if (Object.keys(filteredCustomFields).length === 0) {
        return c.json({
          success: false,
          error: '수정 가능한 필드가 없습니다.',
        }, 400);
      }

      // 필터링된 필드로 교체
      Object.keys(customFields).forEach(key => delete customFields[key]);
      Object.assign(customFields, filteredCustomFields);
    }

    // 기존 커스텀 필드 값과 병합
    let existingCustomFields: Record<string, string> = {};
    if (existing.custom_fields) {
      try {
        existingCustomFields = JSON.parse(existing.custom_fields);
      } catch {
        existingCustomFields = {};
      }
    }

    const mergedFields = { ...existingCustomFields, ...customFields };
    const customFieldsJson = JSON.stringify(mergedFields);

    // 업데이트
    const updatedAt = getISOString();
    await c.env.DB.prepare(
      'UPDATE deliveries SET custom_fields = ?, updated_at = ? WHERE id = ?'
    )
      .bind(customFieldsJson, updatedAt, deliveryId)
      .run();

    return c.json({
      success: true,
      data: {
        customFields: mergedFields,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('Custom fields update error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default delivery;
