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

// Magic Link 이메일 템플릿
export function getMagicLinkEmailTemplate(
  magicLinkUrl: string,
  baseUrl: string
): { subject: string; html: string } {
  const appIconUrl = `${baseUrl}/app-icon.png`;

  return {
    subject: '[배매니저] 로그인 링크',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding: 48px 40px; text-align: center;">
        <!-- Logo -->
        <img src="${appIconUrl}" alt="배매니저" width="64" height="64" style="display: block; margin: 0 auto 24px; border-radius: 16px;" />

        <!-- Title -->
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px;">
          배매니저 로그인
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
          아래 버튼을 클릭하여 로그인하세요.<br>
          링크는 15분 후 만료됩니다.
        </p>

        <!-- Button -->
        <a href="${magicLinkUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; text-decoration: none; font-size: 17px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);">
          로그인하기
        </a>

        <!-- Footer -->
        <p style="margin: 32px 0 0; font-size: 13px; color: #94a3b8;">
          이 요청을 하지 않으셨다면 이 이메일을 무시하세요.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          © 2025 try-dabble.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}
