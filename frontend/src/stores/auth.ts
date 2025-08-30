import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import type { GoogleSheetsConfig, SolapiConfig } from '../types';
import { API_BASE_URL } from '../config/api';

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
  const connectedSpreadsheet = ref<{ id: string; name?: string; sheets?: any[] } | null>(null);

  // Check authentication status from backend
  const checkAuthStatus = async (): Promise<void> => {
    try {
      console.log('Checking auth status...');
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('Document cookies:', document.cookie);
      
      // Session is now managed via httpOnly cookies automatically
      const response = await axios.get(`${API_BASE_URL}/api/auth/status`, {
        withCredentials: true
      });
      
      console.log('Auth status response:', response.data);
      
      if (response.data.success) {
        // Set Google authentication status
        isGoogleAuthenticated.value = true;
        
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
      } else {
        // Clear all Google authentication state when not authenticated
        clearGoogleAuth();
      }
      
      // Check SOLAPI authentication status separately
      try {
        const solapiResponse = await axios.get(`${API_BASE_URL}/api/solapi/auth/status`, {
          withCredentials: true
        });
        
        console.log('SOLAPI status response:', solapiResponse.data);
        if (solapiResponse.data.success && solapiResponse.data.authenticated) {
          isSolapiAuthenticated.value = true;
        } else {
          // Clear SOLAPI authentication state when not authenticated
          clearSolapiAuth();
        }
      } catch (solapiError) {
        console.error('Failed to check SOLAPI status:', solapiError);
        // Clear SOLAPI authentication state on error
        clearSolapiAuth();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      // Clear all authentication states on error
      clearGoogleAuth();
      clearSolapiAuth();
      setAdminAuth(false);
      clearDeliveryAuth();
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
      // Session is now managed via httpOnly cookies - cleared automatically by server
    } catch (error) {
      console.error('Failed to logout:', error);
      // Session cleanup is handled by server via cookie expiration
      throw error;
    }
  };

  // Logout from Google only
  const logoutGoogle = async (): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/google/logout`, {}, {
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
      await axios.post(`${API_BASE_URL}/api/solapi/auth/logout`, {}, {
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