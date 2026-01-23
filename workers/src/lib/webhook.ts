import type { Env } from '../types';

export async function triggerWebhook(
  env: Env,
  adminId: string,
  event: string,
  payload: any
): Promise<boolean> {
  try {
    // 웹훅 설정 조회
    const settings = await env.DB.prepare(
      'SELECT * FROM webhook_settings WHERE admin_id = ? AND enabled = 1'
    )
      .bind(adminId)
      .first<{ url: string }>();

    if (!settings || !settings.url) {
      return false;
    }

    // 웹훅 전송
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Delivery-Event': event,
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook trigger error:', error);
    return false;
  }
}
