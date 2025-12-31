import { Hono } from 'hono';
import type { Env, Admin, MagicLinkToken } from '../types';
import { createToken, verifyToken, createQRToken, createMagicLinkToken } from '../lib/jwt';
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
          .bind(generateId(), adminId, 'free', 7)
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
    // 1분 재전송 제한 체크
    const recentToken = await c.env.DB.prepare(
      'SELECT created_at FROM magic_link_tokens WHERE email = ? AND created_at > datetime("now", "-1 minute") ORDER BY created_at DESC LIMIT 1'
    )
      .bind(email.toLowerCase())
      .first<{ created_at: string }>();

    if (recentToken) {
      return c.json({ success: false, error: '1분 후에 다시 시도해주세요.' }, 429);
    }

    // Magic Link 토큰 생성
    const token = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15분

    // DB에 토큰 저장
    await c.env.DB.prepare(
      'INSERT INTO magic_link_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)'
    )
      .bind(generateId(), email.toLowerCase(), token, expiresAt)
      .run();

    // Magic Link URL 생성 (웹 verify 페이지에서 모바일 감지 후 앱으로 리다이렉트)
    const magicLinkUrl = `${c.env.MAGIC_LINK_BASE_URL}/auth/verify?token=${token}`;

    // 이메일 발송
    const emailTemplate = getMagicLinkEmailTemplate(magicLinkUrl);
    const result = await sendEmail(c.env, {
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (!result.success) {
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }

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
    // 토큰 조회
    const tokenRecord = await c.env.DB.prepare(
      'SELECT * FROM magic_link_tokens WHERE token = ? AND used = 0 AND expires_at > datetime("now")'
    )
      .bind(token)
      .first<MagicLinkToken>();

    if (!tokenRecord) {
      return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }

    // 토큰 사용 처리
    await c.env.DB.prepare('UPDATE magic_link_tokens SET used = 1 WHERE id = ?')
      .bind(tokenRecord.id)
      .run();

    // 관리자 조회 또는 생성
    let admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?')
      .bind(tokenRecord.email)
      .first<Admin>();

    if (!admin) {
      const adminId = generateId();
      await c.env.DB.prepare(
        'INSERT INTO admins (id, email) VALUES (?, ?)'
      )
        .bind(adminId, tokenRecord.email)
        .run();

      // 기본 구독 생성
      await c.env.DB.prepare(
        'INSERT INTO subscriptions (id, admin_id, type, retention_days) VALUES (?, ?, ?, ?)'
      )
        .bind(generateId(), adminId, 'free', 7)
        .run();

      admin = {
        id: adminId,
        email: tokenRecord.email,
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

// QR 토큰 생성 (관리자 전용)
auth.post('/qr/generate', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { staffName, expiresIn = 86400 } = await c.req.json<{
    staffName: string;
    expiresIn?: number;
  }>();

  if (!staffName) {
    return c.json({ success: false, error: 'Staff name is required' }, 400);
  }

  try {
    // QR 토큰 생성
    const qrToken = await createQRToken(
      payload.sub,
      staffName,
      c.env.JWT_SECRET,
      `${expiresIn}s`
    );

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return c.json({
      success: true,
      data: {
        qrData: qrToken,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('QR generate error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// QR 토큰 검증 (배송담당자)
auth.post('/qr/verify', async (c) => {
  const { qrData } = await c.req.json<{ qrData: string }>();

  if (!qrData) {
    return c.json({ success: false, error: 'QR data is required' }, 400);
  }

  try {
    const payload = await verifyToken(qrData, c.env.JWT_SECRET);

    if (!payload || payload.role !== 'staff') {
      return c.json({ success: false, error: 'Invalid QR code' }, 401);
    }

    return c.json({
      success: true,
      data: {
        token: qrData,
        staff: {
          id: payload.sub,
          name: payload.name,
          adminId: payload.adminId,
          createdAt: new Date(payload.iat * 1000).toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('QR verify error:', error);
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

// 배송담당자 로그인 (adminId + date + name 기반)
auth.post('/staff/login', async (c) => {
  const { adminId, date, name } = await c.req.json<{
    adminId: string;
    date: string;
    name: string;
  }>();

  if (!adminId || !date || !name) {
    return c.json({ success: false, error: 'adminId, date, name are required' }, 400);
  }

  try {
    // 해당 관리자의 해당 날짜에 담당자 이름으로 배송이 있는지 확인
    const delivery = await c.env.DB.prepare(
      'SELECT id FROM deliveries WHERE admin_id = ? AND delivery_date = ? AND staff_name = ? LIMIT 1'
    )
      .bind(adminId, date, name.trim())
      .first<{ id: string }>();

    if (!delivery) {
      return c.json({
        success: false,
        error: '해당 날짜에 배정된 배송이 없습니다.',
      }, 404);
    }

    // JWT 토큰 생성 (staff 역할)
    const staffId = generateId();
    const jwtToken = await createToken(
      {
        sub: staffId,
        name: name.trim(),
        role: 'staff',
        adminId,
        date, // 날짜도 토큰에 포함
      },
      c.env.JWT_SECRET,
      '24h' // 24시간 유효
    );

    return c.json({
      success: true,
      data: {
        token: jwtToken,
        staff: {
          id: staffId,
          name: name.trim(),
          adminId,
        },
      },
    });
  } catch (error) {
    console.error('Staff login error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default auth;
