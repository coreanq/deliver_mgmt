import { Hono } from 'hono';
import type { Env, FieldMapping, Subscription } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId, getTodayKST } from '../lib/utils';
import { callAI } from '../services/ai';
import { getUsageForDate } from '../lib/usage';
import { getPlanConfig } from '../lib/plans';

const upload = new Hono<{ Bindings: Env }>();

// 엑셀 파싱 (클라이언트에서 파싱 후 데이터만 전송)
upload.post('/parse', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { headers, rows } = await c.req.json<{
    headers: string[];
    rows: Record<string, string>[];
  }>();

  if (!headers || !rows || rows.length === 0) {
    return c.json({ success: false, error: 'Invalid data' }, 400);
  }

  return c.json({
    success: true,
    data: {
      headers,
      rows,
      totalRows: rows.length,
    },
  });
});

// AI 매핑 추천
upload.post('/mapping/suggest', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { headers, sampleRows } = await c.req.json<{
    headers: string[];
    sampleRows: Record<string, string>[];
  }>();

  if (!headers || headers.length === 0) {
    return c.json({ success: false, error: 'Headers are required' }, 400);
  }

  try {
    // DB 기반 패턴 추천 제거 (로컬 스토리지 사용 권장)
    // 바로 AI 추천으로 넘어갑니다.

    // AI 매핑 추천 요청 (Grok 4.1 Fast Reasoning 사용)
    const systemPrompt = `You are a data mapping assistant for a delivery management system.
Given Excel headers and sample data, suggest the best mapping to the target fields.
Response ONLY in valid JSON format, no markdown or code blocks.

Target fields:
- recipientName: 수령인 이름 (required)
- recipientPhone: 수령인 전화번호 (required)
- recipientAddress: 배송 주소 (required)
- productName: 상품명 (required)
- staffName: 배송담당자 이름 (required)
- quantity: 수량 (optional, default 1)
- memo: 메모 (optional)
- deliveryDate: 배송 날짜 (optional, YYYY-MM-DD format)

Consider Korean variations:
- 이름, 성명, 수령인 → recipientName
- 연락처, 전화, 휴대폰, 핸드폰 → recipientPhone
- 주소, 배송지 → recipientAddress
- 상품, 품목, 제품 → productName
- 수량, 개수 → quantity
- 비고, 메모, 요청사항 → memo
- 담당자, 배송자 → staffName
- 날짜, 배송일 → deliveryDate`;

    const userMessage = `Excel headers: ${JSON.stringify(headers)}
Sample data: ${JSON.stringify(sampleRows?.slice(0, 3) || [])}

Response format:
{"mappings":[{"sourceColumn":"header","targetField":"field","confidence":0.9}]}`;

    const aiResult = await callAI(c.env, systemPrompt, userMessage, { provider: 'grok', maxTokens: 500 });

    // JSON 파싱 (마크다운 코드블록 제거)
    let content = aiResult.text.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(content) as {
      mappings: Array<{ sourceColumn: string; targetField: string; confidence: number }>;
    };

    return c.json({
      success: true,
      data: {
        suggestions: parsed.mappings,
        fromCache: false,
        cacheHit: aiResult.cacheHit,
      },
    });
  } catch (error) {
    console.error('Mapping suggest error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 매핑 확정 + DB 저장
upload.post('/save', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { rows, mapping, deliveryDate, overwrite } = await c.req.json<{
    rows: Record<string, string>[];
    mapping: FieldMapping;
    deliveryDate?: string;
    overwrite?: boolean;
  }>();

  if (!rows || rows.length === 0 || !mapping) {
    return c.json({ success: false, error: 'Invalid data' }, 400);
  }

  // 필수 필드 확인 (배송담당자 포함)
  if (!mapping.recipientName || !mapping.recipientPhone || !mapping.recipientAddress || !mapping.productName || !mapping.staffName) {
    return c.json({ success: false, error: 'Required fields missing in mapping (recipientName, recipientPhone, recipientAddress, productName, staffName)' }, 400);
  }

  const targetDate = deliveryDate || getTodayKST();

  try {
    const subscription = await c.env.DB.prepare(
      'SELECT type FROM subscriptions WHERE admin_id = ?'
    )
      .bind(payload.sub)
      .first<Pick<Subscription, 'type'>>();

    const planType = subscription?.type || 'free';
    const planConfig = getPlanConfig(planType);
    const requestCount = rows.length;

    // 해당 날짜에 기존 데이터 확인
    const existingData = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM deliveries WHERE admin_id = ? AND delivery_date = ?'
    )
      .bind(payload.sub, targetDate)
      .first<{ count: number }>();

    const existingCount = existingData?.count || 0;

    // 기존 데이터가 있고 덮어쓰기 확인을 받지 않은 경우
    if (existingCount > 0 && !overwrite) {
      return c.json({
        success: false,
        needsConfirmation: true,
        existingCount,
        deliveryDate: targetDate,
        error: `해당 날짜(${targetDate})에 ${existingCount}건의 기존 데이터가 있습니다. 기존 데이터를 삭제하고 새로 등록하시겠습니까?`,
      });
    }

    // 신규 등록 건수만 한도 체크 (기존 데이터는 삭제될 예정이므로 무시)
    if (planConfig.dailyLimit !== -1 && requestCount > planConfig.dailyLimit) {
      return c.json({
        success: false,
        error: `등록 가능 건수를 초과했습니다. 요청: ${requestCount}건, 일일 한도: ${planConfig.dailyLimit}건`,
        limitExceeded: true,
        usage: {
          limit: planConfig.dailyLimit,
          requested: requestCount,
          planType,
          deliveryDate: targetDate,
        },
      }, 429);
    }

    // 덮어쓰기 확인된 경우 기존 데이터 삭제
    if (existingCount > 0 && overwrite) {
      await c.env.DB.prepare(
        'DELETE FROM deliveries WHERE admin_id = ? AND delivery_date = ?'
      )
        .bind(payload.sub, targetDate)
        .run();
    }

    // 매핑 패턴 저장은 로컬(브라우저)에서 처리하므로 서버 로직 제거
    // 클라이언트가 직접 로컬 스토리지에 저장해야 함

    // 배송 데이터 준비 (배치 저장용)
    const statements: ReturnType<typeof c.env.DB.prepare>[] = [];
    let validRowCount = 0;

    for (const row of rows) {
      const recipientName = row[mapping.recipientName];
      const recipientPhone = row[mapping.recipientPhone];
      const recipientAddress = row[mapping.recipientAddress];
      const productName = row[mapping.productName];
      const staffName = row[mapping.staffName];

      // 필수 필드가 없으면 스킵 (배송담당자 포함)
      if (!recipientName || !recipientPhone || !recipientAddress || !productName || !staffName) {
        continue;
      }

      const quantity = mapping.quantity ? parseInt(row[mapping.quantity], 10) || 1 : 1;
      const memo = mapping.memo ? row[mapping.memo] || null : null;
      const rowDate = mapping.deliveryDate ? row[mapping.deliveryDate] || targetDate : targetDate;

      statements.push(
        c.env.DB.prepare(
          `INSERT INTO deliveries (id, admin_id, staff_name, recipient_name, recipient_phone, recipient_address, product_name, quantity, memo, delivery_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          payload.sub,
          staffName,
          recipientName,
          recipientPhone,
          recipientAddress,
          productName,
          quantity,
          memo,
          rowDate
        )
      );
      validRowCount++;
    }

    // 유효한 데이터가 없으면 에러
    if (statements.length === 0) {
      return c.json({ success: false, error: '저장할 유효한 데이터가 없습니다.' }, 400);
    }

    // 배치로 한번에 저장 (원자성 보장 - 하나라도 실패하면 전체 롤백)
    await c.env.DB.batch(statements);

    return c.json({
      success: true,
      data: {
        insertedCount: validRowCount,
        totalRows: rows.length,
        deliveryDate: targetDate,
      },
    });
  } catch (error) {
    console.error('Save error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default upload;
