import { create } from 'zustand';
import type { Delivery, DeliveryStatus } from '../types';
import { deliveryApi } from '../services/api';

interface DeliveryStore {
  deliveries: Delivery[];
  selectedDelivery: Delivery | null;
  isLoading: boolean;
  error: string | null;
  
  fetchDeliveries: (token: string, date: string, staffName?: string) => Promise<void>;
  fetchStaffDeliveries: (token: string, staffName: string) => Promise<void>;
  updateDeliveryStatus: (token: string, deliveryId: string, status: DeliveryStatus) => Promise<boolean>;
  completeDelivery: (token: string, deliveryId: string, photoBase64: string) => Promise<boolean>;
  selectDelivery: (delivery: Delivery | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  deliveries: [],
  selectedDelivery: null,
  isLoading: false,
  error: null,

  fetchDeliveries: async (token, date, staffName) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await deliveryApi.getList(token, date, staffName);
      
      if (result.success && result.data) {
        set({ deliveries: result.data.deliveries, isLoading: false });
      } else {
        set({ error: result.error || '배송 목록을 불러올 수 없습니다.', isLoading: false });
      }
    } catch (error) {
      set({ error: '네트워크 오류가 발생했습니다.', isLoading: false });
    }
  },

  fetchStaffDeliveries: async (token, staffName) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await deliveryApi.getStaffDeliveries(token, staffName);
      
      if (result.success && result.data) {
        set({ deliveries: result.data.deliveries, isLoading: false });
      } else {
        set({ error: result.error || '배송 목록을 불러올 수 없습니다.', isLoading: false });
      }
    } catch (error) {
      set({ error: '네트워크 오류가 발생했습니다.', isLoading: false });
    }
  },

  updateDeliveryStatus: async (token, deliveryId, status) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await deliveryApi.updateStatus(token, deliveryId, status);
      
      if (result.success && result.data) {
        const updatedDelivery = result.data;
        set((state) => ({
          deliveries: state.deliveries.map((d) =>
            d.id === deliveryId ? updatedDelivery : d
          ),
          selectedDelivery: state.selectedDelivery?.id === deliveryId 
            ? updatedDelivery 
            : state.selectedDelivery,
          isLoading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '상태 변경에 실패했습니다.', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: '네트워크 오류가 발생했습니다.', isLoading: false });
      return false;
    }
  },

  completeDelivery: async (token, deliveryId, photoBase64) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await deliveryApi.complete(token, deliveryId, photoBase64);
      
      if (result.success && result.data) {
        const completedDelivery = result.data;
        set((state) => ({
          deliveries: state.deliveries.map((d) =>
            d.id === deliveryId ? completedDelivery : d
          ),
          selectedDelivery: completedDelivery,
          isLoading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '배송 완료 처리에 실패했습니다.', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: '네트워크 오류가 발생했습니다.', isLoading: false });
      return false;
    }
  },

  selectDelivery: (delivery) => {
    set({ selectedDelivery: delivery });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      deliveries: [],
      selectedDelivery: null,
      isLoading: false,
      error: null,
    });
  },
}));
