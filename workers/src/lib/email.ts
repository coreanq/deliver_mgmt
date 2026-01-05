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

// Magic Link 이메일 템플릿 - 앱 아이콘 이미지 사용
export function getMagicLinkEmailTemplate(
  magicLinkUrl: string,
  baseUrl: string
): { subject: string; html: string } {
  const iconUrl = `${baseUrl}/r2/deliver-mgmt/assets/icon.png`;

  return {
    subject: '[배매니저] 로그인 링크',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 400px; background: #ffffff; border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center">
              <!-- App Icon -->
              <img src="${iconUrl}" alt="배매니저" width="72" height="72" style="border-radius: 16px; display: block;" />

              <!-- Title -->
              <h1 style="margin: 24px 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a;">
                배매니저 로그인
              </h1>

              <!-- Button -->
              <a href="${magicLinkUrl}" style="display: inline-block; margin: 16px 0 24px; padding: 14px 32px; background: #6366F1; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 10px;">
                로그인하기
              </a>

              <!-- Link -->
              <p style="margin: 0; font-size: 12px; color: #888; word-break: break-all;">
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
