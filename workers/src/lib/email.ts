import type { Env } from '../types';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Resend API를 통한 이메일 발송
export async function sendEmail(
  env: Env,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html } = params;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email send failed:', error);
      return { success: false, error: 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Email service error' };
  }
}

// Magic Link 이메일 템플릿 - Luxury Minimal Style
export function getMagicLinkEmailTemplate(
  magicLinkUrl: string,
  baseUrl: string
): { subject: string; html: string } {
  // Luxury Minimal 색상 팔레트
  const colors = {
    background: '#0C0F14',
    surface: '#151921',
    surfaceLight: '#1E2430',
    primary: '#6366F1',    // Indigo
    accent: '#F97066',     // Coral
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: 'rgba(255,255,255,0.08)',
  };

  return {
    subject: '[배매니저] 로그인 링크가 도착했습니다',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>배매니저 로그인</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Background pattern -->
  <div style="position: absolute; width: 100%; height: 100%; overflow: hidden; pointer-events: none;">
    <div style="position: absolute; top: -50px; left: -50px; width: 200px; height: 200px; background: ${colors.accent}; opacity: 0.15; border-radius: 50%; filter: blur(80px);"></div>
    <div style="position: absolute; top: 100px; right: -30px; width: 150px; height: 150px; background: ${colors.primary}; opacity: 0.12; border-radius: 50%; filter: blur(60px);"></div>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 48px 20px;">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(180deg, ${colors.surface} 0%, ${colors.background} 100%); border-radius: 24px; border: 1px solid ${colors.border}; overflow: hidden;">

          <!-- Header with gradient accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${colors.accent}, ${colors.primary});"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px 40px;">

              <!-- Logo Mark -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 6px; background: ${colors.surfaceLight}; border-radius: 20px;">
                      <div style="width: 56px; height: 56px; background: linear-gradient(135deg, ${colors.primary}, ${colors.accent}); border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                        <table cellpadding="0" cellspacing="0" style="width: 56px; height: 56px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size: 24px; font-weight: 800; color: #FFFFFF;">관</td>
                          </tr>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin: 28px 0 0; text-align: center; font-size: 26px; font-weight: 700; color: ${colors.text}; letter-spacing: -0.5px;">
                관리자 로그인
              </h1>

              <!-- Subtitle -->
              <p style="margin: 12px 0 0; text-align: center; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.6;">
                아래 버튼을 클릭하여 배매니저에 로그인하세요
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, ${colors.primary}, ${colors.accent}); color: #FFFFFF; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 14px; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35); letter-spacing: -0.2px;">
                      로그인하기
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Timer Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 10px 18px; background: ${colors.surfaceLight}; border-radius: 100px; border: 1px solid ${colors.border};">
                      <span style="font-size: 13px; color: ${colors.textMuted};">⏱ 링크는 </span>
                      <span style="font-size: 13px; color: ${colors.accent}; font-weight: 600;">15분</span>
                      <span style="font-size: 13px; color: ${colors.textMuted};"> 후 만료됩니다</span>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: ${colors.border};"></div>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 16px; background: rgba(249, 112, 102, 0.08); border-radius: 12px; border: 1px solid rgba(249, 112, 102, 0.15);">
                    <p style="margin: 0; font-size: 13px; color: ${colors.textSecondary}; line-height: 1.6; text-align: center;">
                      🔒 이 요청을 하지 않으셨다면<br>
                      <span style="color: ${colors.textMuted};">이 이메일을 무시하세요. 계정은 안전합니다.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background: ${colors.background}; border-top: 1px solid ${colors.border};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: ${colors.textMuted};">
                      배매니저
                    </p>
                    <p style="margin: 0; font-size: 12px; color: ${colors.textMuted}; opacity: 0.7;">
                      © 2025 try-dabble.com
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Help Text -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: ${colors.textMuted};">
                버튼이 작동하지 않으면 아래 링크를 복사하세요
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: ${colors.textMuted}; word-break: break-all; opacity: 0.7;">
                ${magicLinkUrl}
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}
