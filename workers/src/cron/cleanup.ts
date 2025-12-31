import type { Env, Subscription } from '../types';
import { getDaysAgo } from '../lib/utils';

// 만료 데이터 정리 (매일 00:00 실행)
export async function cleanupExpiredData(env: Env): Promise<void> {
  console.log('Starting cleanup job...');

  try {
    // 1. 사진 파일 및 배송 데이터 정리 (구독별 retention_days 기준)
    // 모든 구독 정보 조회
    const subscriptions = await env.DB.prepare(
      'SELECT admin_id, retention_days FROM subscriptions'
    ).all<{ admin_id: string; retention_days: number }>();

    for (const sub of subscriptions.results || []) {
      const expiryDate = getDaysAgo(sub.retention_days);

      // 사진 파일 삭제 (R2)
      const oldPhotos = await env.DB.prepare(
        `SELECT id, photo_url FROM deliveries
         WHERE admin_id = ? AND photo_url IS NOT NULL AND completed_at < ?`
      )
        .bind(sub.admin_id, expiryDate)
        .all<{ id: string; photo_url: string }>();

      for (const row of oldPhotos.results || []) {
        if (row.photo_url) {
          const key = row.photo_url.split('/').slice(3).join('/');
          try {
            await env.STORAGE.delete(key);
          } catch (e) {
            console.error(`Failed to delete photo: ${key}`, e);
          }
        }
      }

      if ((oldPhotos.results?.length || 0) > 0) {
        console.log(`Deleted ${oldPhotos.results?.length} photos for admin ${sub.admin_id}`);
      }

      // 배송 데이터 삭제
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
