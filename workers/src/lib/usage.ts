import { getPlanConfig, UNLIMITED } from './plans';

export interface UsageInfo {
  planType: string;
  dailyLimit: number;
  currentUsage: number;
  remaining: number;
  canCreate: boolean;
  deliveryDate: string;
}

export async function getUsageForDate(
  db: D1Database,
  adminId: string,
  deliveryDate: string
): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM deliveries 
     WHERE admin_id = ? AND delivery_date = ?`
  )
    .bind(adminId, deliveryDate)
    .first<{ count: number }>();
  
  return result?.count ?? 0;
}

export async function getUsageInfo(
  db: D1Database,
  adminId: string,
  planType: string,
  deliveryDate: string
): Promise<UsageInfo> {
  const currentUsage = await getUsageForDate(db, adminId, deliveryDate);
  const config = getPlanConfig(planType);
  const remaining = config.dailyLimit === UNLIMITED 
    ? UNLIMITED 
    : Math.max(0, config.dailyLimit - currentUsage);
  
  return {
    planType,
    dailyLimit: config.dailyLimit,
    currentUsage,
    remaining,
    canCreate: config.dailyLimit === UNLIMITED || currentUsage < config.dailyLimit,
    deliveryDate,
  };
}

export async function checkCanCreateDelivery(
  db: D1Database,
  adminId: string,
  planType: string,
  deliveryDate: string,
  count: number = 1
): Promise<{ allowed: boolean; remaining: number; message?: string }> {
  const config = getPlanConfig(planType);
  
  if (config.dailyLimit === UNLIMITED) {
    return { allowed: true, remaining: UNLIMITED };
  }
  
  const currentUsage = await getUsageForDate(db, adminId, deliveryDate);
  const remaining = config.dailyLimit - currentUsage;
  
  if (remaining < count) {
    return {
      allowed: false,
      remaining: Math.max(0, remaining),
      message: `${deliveryDate} 등록 한도를 초과했습니다. (${currentUsage}/${config.dailyLimit})`,
    };
  }
  
  return { allowed: true, remaining };
}
