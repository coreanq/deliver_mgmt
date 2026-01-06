export type PlanType = 'free' | 'basic' | 'pro';

export const UNLIMITED = -1;

export interface PlanConfig {
  dailyLimit: number;
  retentionDays: number;
  priceKRW: number;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    dailyLimit: 100,
    retentionDays: 3,
    priceKRW: 0,
  },
  basic: {
    dailyLimit: 500,
    retentionDays: 30,
    priceKRW: 1900,
  },
  pro: {
    dailyLimit: 1000,
    retentionDays: 90,
    priceKRW: 9900,
  },
} as const;

export function getPlanConfig(planType: string): PlanConfig {
  if (planType in PLANS) {
    return PLANS[planType as PlanType];
  }
  return PLANS.free;
}

export function isWithinDailyLimit(planType: string, currentCount: number): boolean {
  const config = getPlanConfig(planType);
  if (config.dailyLimit === UNLIMITED) return true;
  return currentCount < config.dailyLimit;
}

export function getRemainingLimit(planType: string, currentCount: number): number {
  const config = getPlanConfig(planType);
  if (config.dailyLimit === UNLIMITED) return UNLIMITED;
  return Math.max(0, config.dailyLimit - currentCount);
}
