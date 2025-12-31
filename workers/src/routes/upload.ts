import { Hono } from 'hono';
import type { Env, FieldMapping, MappingPattern } from '../types';
import { verifyToken } from '../lib/jwt';
import { generateId, getDateString, getTodayKST } from '../lib/utils';

const upload = new Hono<{ Bindings: Env }>();

// AI Gateway 엔드포인트
const AI_GATEWAY_HOST = 'https://gateway.ai.cloudflare.com';
const AI_GATEWAY_ENDPOINT = '/v1/37820b7e32b164918dd5bcb58e628ff1/soulcro-gateway/compat';

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
    // 기존 매핑 패턴 조회
    const existingPattern = await c.env.DB.prepare(
      'SELECT * FROM mapping_patterns WHERE admin_id = ? ORDER BY use_count DESC LIMIT 1'
    )
      .bind(payload.sub)
      .first<MappingPattern>();

    // 기존 패턴이 있고 헤더가 일치하면 해당 매핑 사용
    if (existingPattern) {
      const storedHeaders = JSON.parse(existingPattern.source_headers) as string[];
      if (
        storedHeaders.length === headers.length &&
        storedHeaders.every((h, i) => h === headers[i])
      ) {
        const mapping = JSON.parse(existingPattern.field_mapping) as FieldMapping;

        // 사용 횟수 증가
        await c.env.DB.prepare(
          'UPDATE mapping_patterns SET use_count = use_count + 1, updated_at = datetime("now") WHERE id = ?'
        )
          .bind(existingPattern.id)
          .run();

        return c.json({
          success: true,
          data: {
            suggestions: Object.entries(mapping).map(([targetField, sourceColumn]) => ({
              sourceColumn,
              targetField,
              confidence: 1.0,
            })),
            fromCache: true,
          },
        });
      }
    }

    // AI 매핑 추천 요청
    const prompt = `You are a data mapping assistant for a delivery management system.
Given the following Excel headers and sample data, suggest the best mapping to the target fields.

Target fields:
- recipientName: 수령인 이름 (required)
- recipientPhone: 수령인 전화번호 (required)
- recipientAddress: 배송 주소 (required)
- productName: 상품명 (required)
- quantity: 수량 (optional, default 1)
- memo: 메모 (optional)
- staffName: 배송담당자 이름 (optional)
- deliveryDate: 배송 날짜 (optional, YYYY-MM-DD format)

Excel headers: ${JSON.stringify(headers)}
Sample data: ${JSON.stringify(sampleRows?.slice(0, 3) || [])}

Response in JSON format:
{
  "mappings": [
    { "sourceColumn": "excel header name", "targetField": "target field name", "confidence": 0.0-1.0 }
  ]
}

Only include mappings you are confident about. Consider Korean variations like:
- 이름, 성명, 수령인 → recipientName
- 연락처, 전화, 휴대폰, 핸드폰 → recipientPhone
- 주소, 배송지 → recipientAddress
- 상품, 품목, 제품 → productName
- 수량, 개수 → quantity
- 비고, 메모, 요청사항 → memo
- 담당자, 배송자 → staffName
- 날짜, 배송일 → deliveryDate`;

    const response = await fetch(`${AI_GATEWAY_HOST}${AI_GATEWAY_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-aig-authorization': `Bearer ${c.env.AI_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway error:', await response.text());
      return c.json({ success: false, error: 'AI service error' }, 500);
    }

    const aiResult = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = aiResult.choices[0]?.message?.content;

    if (!content) {
      return c.json({ success: false, error: 'AI response error' }, 500);
    }

    const parsed = JSON.parse(content) as {
      mappings: Array<{ sourceColumn: string; targetField: string; confidence: number }>;
    };

    return c.json({
      success: true,
      data: {
        suggestions: parsed.mappings,
        fromCache: false,
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

  const { headers, rows, mapping, deliveryDate } = await c.req.json<{
    headers: string[];
    rows: Record<string, string>[];
    mapping: FieldMapping;
    deliveryDate?: string;
  }>();

  if (!rows || rows.length === 0 || !mapping) {
    return c.json({ success: false, error: 'Invalid data' }, 400);
  }

  // 필수 필드 확인
  if (!mapping.recipientName || !mapping.recipientPhone || !mapping.recipientAddress || !mapping.productName) {
    return c.json({ success: false, error: 'Required fields missing in mapping' }, 400);
  }

  const targetDate = deliveryDate || getTodayKST();

  try {
    // 매핑 패턴 저장
    await c.env.DB.prepare(
      `INSERT INTO mapping_patterns (id, admin_id, source_headers, field_mapping)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(admin_id) DO UPDATE SET
       source_headers = excluded.source_headers,
       field_mapping = excluded.field_mapping,
       use_count = use_count + 1,
       updated_at = datetime("now")`
    )
      .bind(
        generateId(),
        payload.sub,
        JSON.stringify(headers),
        JSON.stringify(mapping)
      )
      .run();

    // 배송 데이터 삽입
    let insertedCount = 0;
    for (const row of rows) {
      const recipientName = row[mapping.recipientName];
      const recipientPhone = row[mapping.recipientPhone];
      const recipientAddress = row[mapping.recipientAddress];
      const productName = row[mapping.productName];

      // 필수 필드가 없으면 스킵
      if (!recipientName || !recipientPhone || !recipientAddress || !productName) {
        continue;
      }

      const quantity = mapping.quantity ? parseInt(row[mapping.quantity], 10) || 1 : 1;
      const memo = mapping.memo ? row[mapping.memo] || null : null;
      const staffName = mapping.staffName ? row[mapping.staffName] || null : null;
      const rowDate = mapping.deliveryDate ? row[mapping.deliveryDate] || targetDate : targetDate;

      await c.env.DB.prepare(
        `INSERT INTO deliveries (id, admin_id, staff_name, recipient_name, recipient_phone, recipient_address, product_name, quantity, memo, delivery_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
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
        .run();

      insertedCount++;
    }

    return c.json({
      success: true,
      data: {
        insertedCount,
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
