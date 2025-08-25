import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import type { GoogleSheetsConfig, SolapiConfig } from '../types';

const API_BASE_URL = 'http://localhost:5001';

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
    googleSpreadsheets.value = [];
    googleConnectedAt.value = '';
    connectedSpreadsheet.value = null;
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

  // Google data state  
  const googleSpreadsheets = ref<any[]>([]);
  const googleConnectedAt = ref<string>('');
  const connectedSpreadsheet = ref<{ id: string; name: string } | null>(null);

  // Check authentication status from backend
  const checkAuthStatus = async (): Promise<void> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/status`, {
        withCredentials: true,
      });
      if (response.data.success) {
        isGoogleAuthenticated.value = response.data.data.google;
        isSolapiAuthenticated.value = response.data.data.solapi;
        
        // Update Google data if available
        if (response.data.data.googleData) {
          googleSpreadsheets.value = response.data.data.googleData.spreadsheets || [];
          googleConnectedAt.value = response.data.data.googleData.connectedAt || '';
        } else {
          googleSpreadsheets.value = [];
          googleConnectedAt.value = '';
        }
        
        // Update connected spreadsheet if available
        if (response.data.data.connectedSpreadsheet) {
          connectedSpreadsheet.value = response.data.data.connectedSpreadsheet;
        } else {
          connectedSpreadsheet.value = null;
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      isGoogleAuthenticated.value = false;
      isSolapiAuthenticated.value = false;
      googleSpreadsheets.value = [];
      googleConnectedAt.value = '';
      connectedSpreadsheet.value = null;
    }
  };

  // Logout from all services
  const logoutAll = async (): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        withCredentials: true,
      });
      clearGoogleAuth();
      clearSolapiAuth();
      setAdminAuth(false);
      clearDeliveryAuth();
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  };

  // Logout from Google only
  const logoutGoogle = async (): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        withCredentials: true,
      });
      clearGoogleAuth();
    } catch (error) {
      console.error('Failed to logout from Google:', error);
      throw error;
    }
  };

  // Logout from SOLAPI only
  const logoutSolapi = async (): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        withCredentials: true,
      });
      clearSolapiAuth();
    } catch (error) {
      console.error('Failed to logout from SOLAPI:', error);
      throw error;
    }
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
    googleSpreadsheets,
    googleConnectedAt,
    connectedSpreadsheet,
    
    // Actions
    setGoogleAuth,
    clearGoogleAuth,
    setSolapiAuth,
    clearSolapiAuth,
    setAdminAuth,
    setDeliveryAuth,
    clearDeliveryAuth,
    
    // New methods
    checkAuthStatus,
    logoutAll,
    logoutGoogle,
    logoutSolapi,
  };
});