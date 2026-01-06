import type { Env } from '../types';
import { getPlanConfig, isWithinDailyLimit, getRemainingLimit, UNLIMITED } from './plans';

export interface UsageInfo {
  planType: string;
  dailyLimit: number;
  todayUsage: number;
  remaining: number;
  canCreate: boolean;
}

export async function getTodayUsage(db: D1Database, adminId: string): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM deliveries 
     WHERE admin_id = ? AND DATE(created_at) = DATE('now')`
  )
    .bind(adminId)
    .first<{ count: number }>();
  
  return result?.count ?? 0;
}

export async function getUsageInfo(db: D1Database, adminId: string, planType: string): Promise<UsageInfo> {
  const todayUsage = await getTodayUsage(db, adminId);
  const config = getPlanConfig(planType);
  
  return {
    planType,
    dailyLimit: config.dailyLimit,
    todayUsage,
    remaining: getRemainingLimit(planType, todayUsage),
    canCreate: isWithinDailyLimit(planType, todayUsage),
  };
}

export async function checkCanCreateDelivery(
  db: D1Database,
  adminId: string,
  planType: string,
  count: number = 1
): Promise<{ allowed: boolean; message?: string }> {
  const config = getPlanConfig(planType);
  
  if (config.dailyLimit === UNLIMITED) {
    return { allowed: true };
  }
  
  const todayUsage = await getTodayUsage(db, adminId);
  const remaining = config.dailyLimit - todayUsage;
  
  if (remaining < count) {
    return {
      allowed: false,
      message: `일일 한도를 초과했습니다. (${todayUsage}/${config.dailyLimit})`,
    };
  }
  
  return { allowed: true };
}
