import type { Env, Subscription } from '../types';
import { getDaysAgo } from '../lib/utils';

// 만료 데이터 정리 (매일 00:00 실행)
export async function cleanupExpiredData(env: Env): Promise<void> {
  console.log('Starting cleanup job...');

  try {
    // 1. 사진 파일 정리 (7일 이상 된 사진)
    const photoExpiryDate = getDaysAgo(7);

    // 완료된 배송 중 사진이 있고 7일 이상 된 것 조회
    const oldPhotos = await env.DB.prepare(
      `SELECT id, photo_url FROM deliveries
       WHERE photo_url IS NOT NULL AND completed_at < ?`
    )
      .bind(photoExpiryDate)
      .all<{ id: string; photo_url: string }>();

    // R2에서 사진 삭제
    for (const row of oldPhotos.results || []) {
      if (row.photo_url) {
        // URL에서 키 추출
        const key = row.photo_url.split('/').slice(3).join('/');
        try {
          await env.STORAGE.delete(key);
          console.log(`Deleted photo: ${key}`);
        } catch (e) {
          console.error(`Failed to delete photo: ${key}`, e);
        }
      }
    }

    // 사진 URL 제거
    if ((oldPhotos.results?.length || 0) > 0) {
      await env.DB.prepare(
        `UPDATE deliveries SET photo_url = NULL
         WHERE photo_url IS NOT NULL AND completed_at < ?`
      )
        .bind(photoExpiryDate)
        .run();

      console.log(`Cleared ${oldPhotos.results?.length} photo URLs`);
    }

    // 2. 배송 데이터 정리 (구독 타입별 보관 기간)
    // 모든 구독 정보 조회
    const subscriptions = await env.DB.prepare(
      'SELECT admin_id, retention_days FROM subscriptions'
    ).all<{ admin_id: string; retention_days: number }>();

    for (const sub of subscriptions.results || []) {
      const expiryDate = getDaysAgo(sub.retention_days);

      const deleted = await env.DB.prepare(
        `DELETE FROM deliveries
         WHERE admin_id = ? AND delivery_date < ?`
      )
        .bind(sub.admin_id, expiryDate)
        .run();

      if (deleted.meta.changes > 0) {
        console.log(
          `Deleted ${deleted.meta.changes} deliveries for admin ${sub.admin_id} (retention: ${sub.retention_days} days)`
        );
      }
    }

    // 3. 만료된 Magic Link 토큰 정리
    const deletedTokens = await env.DB.prepare(
      `DELETE FROM magic_link_tokens WHERE expires_at < datetime('now') OR used = 1`
    ).run();

    if (deletedTokens.meta.changes > 0) {
      console.log(`Deleted ${deletedTokens.meta.changes} expired magic link tokens`);
    }

    console.log('Cleanup job completed');
  } catch (error) {
    console.error('Cleanup job failed:', error);
    throw error;
  }
}
