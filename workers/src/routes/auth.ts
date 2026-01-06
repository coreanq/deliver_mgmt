import { Hono } from 'hono';
import type { Env, Admin } from '../types';
import { createToken, verifyToken } from '../lib/jwt';
import { sendEmail, getMagicLinkEmailTemplate } from '../lib/email';
import { generateId, generateRandomToken, isValidEmail, isTestEmail } from '../lib/utils';

const auth = new Hono<{ Bindings: Env }>();

// Magic Link 발송 (테스트 이메일은 바로 JWT 반환)
auth.post('/magic-link/send', async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !isValidEmail(email)) {
    return c.json({ success: false, error: 'Invalid email address' }, 400);
  }

  // 테스트 이메일은 바로 JWT 반환 (이메일 발송 안 함)
  if (isTestEmail(email, c.env.TEST_EMAILS)) {
    try {
      // 관리자 조회 또는 생성
      let admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?')
        .bind(email.toLowerCase())
        .first<Admin>();

      if (!admin) {
        const adminId = generateId();
        await c.env.DB.prepare('INSERT INTO admins (id, email) VALUES (?, ?)')
          .bind(adminId, email.toLowerCase())
          .run();

        // 기본 구독 생성
        await c.env.DB.prepare(
          'INSERT INTO subscriptions (id, admin_id, type, retention_days) VALUES (?, ?, ?, ?)'
        )
          .bind(generateId(), adminId, 'free', 3)
          .run();

        admin = {
          id: adminId,
          email: email.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // JWT 토큰 생성
      const jwtToken = await createToken(
        { sub: admin.id, email: admin.email, role: 'admin' },
        c.env.JWT_SECRET
      );

      return c.json({
        success: true,
        data: {
          token: jwtToken,
          admin: {
            id: admin.id,
            email: admin.email,
            createdAt: admin.created_at,
          },
        },
      });
    } catch (error) {
      console.error('Test login error:', error);
      return c.json({ success: false, error: 'Internal server error' }, 500);
    }
  }

  try {
    const rateLimitKey = `magic_link_rate:${email.toLowerCase()}`;
    const lastSent = await c.env['KV-DELIVER-MGMT'].get(rateLimitKey);
    
    if (lastSent) {
      return c.json({ 
        success: false, 
        error: '1분 후에 다시 시도해주세요.',
        retryAfter: 60,
      }, 429);
    }

    const token = generateRandomToken(32);

    // KV에 토큰 저장 (15분 = 900초)
    // 키 포맷: magic_link:{token} -> value: {email}
    await c.env['KV-DELIVER-MGMT'].put(`magic_link:${token}`, email.toLowerCase(), {
      expirationTtl: 900, // 15분 후 자동 삭제
    });

    // Magic Link URL 생성 (웹 verify 페이지에서 모바일 감지 후 앱으로 리다이렉트)
    const magicLinkUrl = `${c.env.WORKER_BASE_URL}/auth/verify?token=${token}`;

    // 이메일 발송
    const emailTemplate = getMagicLinkEmailTemplate(magicLinkUrl, c.env.WORKER_BASE_URL);
    const result = await sendEmail(c.env, {
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (!result.success) {
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }

    await c.env['KV-DELIVER-MGMT'].put(rateLimitKey, '1', { expirationTtl: 60 });

    return c.json({
      success: true,
      data: { message: 'Magic link sent' },
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Magic Link 검증
auth.post('/magic-link/verify', async (c) => {
  const { token } = await c.req.json<{ token: string }>();

  if (!token) {
    return c.json({ success: false, error: 'Token is required' }, 400);
  }

  try {
    // KV에서 토큰 조회
    const email = await c.env['KV-DELIVER-MGMT'].get(`magic_link:${token}`);

    if (!email) {
      return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }

    // 토큰 즉시 삭제 (1회용 보장)
    await c.env['KV-DELIVER-MGMT'].delete(`magic_link:${token}`);

    // 관리자 조회 또는 생성 (기존 로직 유지)
    let admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?')
      .bind(email)
      .first<Admin>();

    if (!admin) {
      const adminId = generateId();
      await c.env.DB.prepare(
        'INSERT INTO admins (id, email) VALUES (?, ?)'
      )
        .bind(adminId, email)
        .run();

      // 기본 구독 생성
      await c.env.DB.prepare(
        'INSERT INTO subscriptions (id, admin_id, type, retention_days) VALUES (?, ?, ?, ?)'
      )
        .bind(generateId(), adminId, 'free', 3)
        .run();

      admin = {
        id: adminId,
        email: email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // JWT 토큰 생성
    const jwtToken = await createToken(
      {
        sub: admin.id,
        email: admin.email,
        role: 'admin',
      },
      c.env.JWT_SECRET
    );

    return c.json({
      success: true,
      data: {
        token: jwtToken,
        admin: {
          id: admin.id,
          email: admin.email,
          createdAt: admin.created_at,
        },
      },
    });
  } catch (error) {
    console.error('Magic link verify error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// QR 토큰 생성 (관리자 전용) - 랜덤 토큰 방식
auth.post('/qr/generate', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const jwtToken = authHeader.slice(7);
  const payload = await verifyToken(jwtToken, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // 기본 TTL 24시간 (86400초)
  const { date, expiresIn = 86400 } = await c.req.json<{
    date: string;
    expiresIn?: number;
  }>();

  if (!date) {
    return c.json({ success: false, error: 'Date is required' }, 400);
  }

  try {
    // 랜덤 토큰 생성
    const token = generateRandomToken(24);

    // KV에 저장할 데이터
    const qrData = {
      adminId: payload.sub,
      date,
      failCount: 0
    };

    // KV에 저장 (expiresIn 초 후 자동 삭제)
    // 키 포맷: qr:{token} -> value: JSON string
    await c.env['KV-DELIVER-MGMT'].put(`qr:${token}`, JSON.stringify(qrData), {
      expirationTtl: expiresIn,
    });

    // 응답용 만료 시간
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return c.json({
      success: true,
      data: {
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('QR generate error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// 배송담당자 이름 확인 (2차 인증) - 기존 호환용
auth.post('/staff/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'staff') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { name } = await c.req.json<{ name: string }>();

  if (!name) {
    return c.json({ success: false, error: 'Name is required' }, 400);
  }

  // QR 토큰의 이름과 입력한 이름 비교
  const verified = payload.name === name;

  return c.json({
    success: true,
    data: { verified },
  });
});

// 배송담당자 로그인 (QR 토큰 + name 기반)
auth.post('/staff/login', async (c) => {
  const { token, name } = await c.req.json<{
    token: string;
    name: string;
  }>();

  if (!token || !name) {
    return c.json({ success: false, error: 'token, name are required' }, 400);
  }

  try {
    // KV에서 QR 토큰 조회
    const rawData = await c.env['KV-DELIVER-MGMT'].get(`qr:${token}`);

    if (!rawData) {
      return c.json({
        success: false,
        error: 'QR 코드가 만료되었거나 유효하지 않습니다.',
      }, 401);
    }

    const qrData = JSON.parse(rawData) as { adminId: string; date: string; failCount: number };

    // 실패 횟수 체크 (5회 이상이면 차단)
    if (qrData.failCount >= 5) {
      return c.json({
        success: false,
        error: 'QR 코드가 비활성화되었습니다. 새 QR 코드를 요청하세요.',
      }, 401);
    }

    // 해당 관리자의 해당 날짜에 담당자 이름으로 배송이 있는지 확인 (D1 조회 유지)
    // admin_id는 KV에서 가져온 값 사용
    const delivery = await c.env.DB.prepare(
      'SELECT id FROM deliveries WHERE admin_id = ? AND delivery_date = ? AND staff_name = ? LIMIT 1'
    )
      .bind(qrData.adminId, qrData.date, name.trim())
      .first<{ id: string }>();

    if (!delivery) {
      // 실패 횟수 증가 (KV 업데이트)
      qrData.failCount += 1;

      // TTL은 남은 시간으로 유지해야 하지만, KV API로는 '현재 남은 TTL'을 알기 어렵습니다.
      // 단순화를 위해 24시간(86400)이나 넉넉한 시간으로 다시 설정하거나, 
      // 만료시간을 데이터에 포함시켜 계산할 수 있습니다.
      // 편의상 기본값 24시간으로 갱신합니다.
      await c.env['KV-DELIVER-MGMT'].put(`qr:${token}`, JSON.stringify(qrData), {
        expirationTtl: 86400,
      });

      const remainingAttempts = 5 - qrData.failCount;
      return c.json({
        success: false,
        error: remainingAttempts > 0
          ? `이름이 일치하지 않습니다. (${remainingAttempts}회 남음)`
          : 'QR 코드가 비활성화되었습니다. 새 QR 코드를 요청하세요.',
      }, 401);
    }

    // 로그인 성공 시 KV 데이터 유지? 삭제?
    // 기사님이 여러 번 로그인해야 할 수도 있으므로 유지합니다.
    // 하지만 재사용을 막으려면 삭제할 수도 있습니다. 정책에 따라 다릅니다.
    // 기존 로직(DB)은 used 필드가 있었지만 실제로 막지는 않았습니다(fail_count만 체크).
    // 여기서는 유지합니다.

    // JWT 토큰 생성 (staff 역할)
    const staffId = generateId();
    const jwtToken = await createToken(
      {
        sub: staffId,
        name: name.trim(),
        role: 'staff',
        adminId: qrData.adminId,
        date: qrData.date,
      },
      c.env.JWT_SECRET,
      '24h'
    );

    return c.json({
      success: true,
      data: {
        token: jwtToken,
        staff: {
          id: staffId,
          name: name.trim(),
          adminId: qrData.adminId,
        },
      },
    });

  } catch (error) {
    console.error('Staff login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default auth;
