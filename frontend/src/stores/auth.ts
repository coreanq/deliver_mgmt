import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { GoogleSheetsConfig, SolapiConfig } from '../types';

export const useAuthStore = defineStore('auth', () => {
  // Google OAuth state
  const isGoogleAuthenticated = ref(false);
  const googleConfig = ref<GoogleSheetsConfig | null>(null);
  
  // SOLAPI OAuth state
  const isSolapiAuthenticated = ref(false);
  const solapiConfig = ref<SolapiConfig | null>(null);
  
  // Admin authentication state
  const isAdminAuthenticated = ref(false);
  
  // Delivery staff authentication state
  const isDeliveryAuthenticated = ref(false);
  const currentStaffName = ref<string>('');

  // Google OAuth actions
  const setGoogleAuth = (config: GoogleSheetsConfig): void => {
    googleConfig.value = config;
    isGoogleAuthenticated.value = true;
  };

  const clearGoogleAuth = (): void => {
    googleConfig.value = null;
    isGoogleAuthenticated.value = false;
  };

  // SOLAPI OAuth actions
  const setSolapiAuth = (config: SolapiConfig): void => {
    solapiConfig.value = config;
    isSolapiAuthenticated.value = true;
  };

  const clearSolapiAuth = (): void => {
    solapiConfig.value = null;
    isSolapiAuthenticated.value = false;
  };

  // Admin authentication actions
  const setAdminAuth = (authenticated: boolean): void => {
    isAdminAuthenticated.value = authenticated;
  };

  // Delivery staff authentication actions
  const setDeliveryAuth = (staffName: string): void => {
    currentStaffName.value = staffName;
    isDeliveryAuthenticated.value = true;
  };

  const clearDeliveryAuth = (): void => {
    currentStaffName.value = '';
    isDeliveryAuthenticated.value = false;
  };

  return {
    // State
    isGoogleAuthenticated,
    googleConfig,
    isSolapiAuthenticated,
    solapiConfig,
    isAdminAuthenticated,
    isDeliveryAuthenticated,
    currentStaffName,
    
    // Actions
    setGoogleAuth,
    clearGoogleAuth,
    setSolapiAuth,
    clearSolapiAuth,
    setAdminAuth,
    setDeliveryAuth,
    clearDeliveryAuth,
  };
});