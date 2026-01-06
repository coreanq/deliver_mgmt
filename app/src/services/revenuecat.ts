import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import type { PlanType } from '../types';

const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_API_KEY';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_API_KEY';

const PRODUCT_IDS: Record<Exclude<PlanType, 'free'>, string> = {
  basic: 'deliver_mgmt_basic_monthly',
  pro: 'deliver_mgmt_pro_monthly',
};

const FEATURE_ENABLED = false;

let isInitialized = false;

export const revenueCatService = {
  async initialize(userId?: string): Promise<boolean> {
    if (!FEATURE_ENABLED) return false;
    if (isInitialized) return true;

    try {
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_API_KEY_IOS 
        : REVENUECAT_API_KEY_ANDROID;

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey, appUserID: userId });
      isInitialized = true;
      return true;
    } catch (error) {
      console.error('RevenueCat init error:', error);
      return false;
    }
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!FEATURE_ENABLED || !isInitialized) return null;

    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('RevenueCat getCustomerInfo error:', error);
      return null;
    }
  },

  async getOfferings(): Promise<PurchasesPackage[]> {
    if (!FEATURE_ENABLED || !isInitialized) return [];

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages ?? [];
    } catch (error) {
      console.error('RevenueCat getOfferings error:', error);
      return [];
    }
  },

  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
    if (!FEATURE_ENABLED || !isInitialized) return null;

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    } catch (error) {
      console.error('RevenueCat purchase error:', error);
      return null;
    }
  },

  async restorePurchases(): Promise<CustomerInfo | null> {
    if (!FEATURE_ENABLED || !isInitialized) return null;

    try {
      return await Purchases.restorePurchases();
    } catch (error) {
      console.error('RevenueCat restore error:', error);
      return null;
    }
  },

  async login(userId: string): Promise<CustomerInfo | null> {
    if (!FEATURE_ENABLED || !isInitialized) return null;

    try {
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    } catch (error) {
      console.error('RevenueCat login error:', error);
      return null;
    }
  },

  async logout(): Promise<void> {
    if (!FEATURE_ENABLED || !isInitialized) return;

    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('RevenueCat logout error:', error);
    }
  },

  isActive(customerInfo: CustomerInfo | null, planType: Exclude<PlanType, 'free'>): boolean {
    if (!customerInfo) return false;
    const productId = PRODUCT_IDS[planType];
    return productId in (customerInfo.entitlements.active ?? {});
  },

  getCurrentPlan(customerInfo: CustomerInfo | null): PlanType {
    if (!customerInfo) return 'free';
    
    if (this.isActive(customerInfo, 'pro')) return 'pro';
    if (this.isActive(customerInfo, 'basic')) return 'basic';
    return 'free';
  },

  isFeatureEnabled(): boolean {
    return FEATURE_ENABLED;
  },
};
