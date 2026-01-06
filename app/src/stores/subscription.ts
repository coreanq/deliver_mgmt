import { create } from 'zustand';
import type { PlanType, SubscriptionStatus } from '../types';

interface SubscriptionStore {
  status: SubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  
  isPro: boolean;
  planType: PlanType;
  dailyLimit: number;
  todayUsage: number;
  remaining: number;
  
  setStatus: (status: SubscriptionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: null,
  isLoading: false,
  error: null,
  isPro: false,
  planType: 'free' as PlanType,
  dailyLimit: 100,
  todayUsage: 0,
  remaining: 100,
};

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  ...initialState,

  setStatus: (status) => {
    set({
      status,
      isPro: status.isPro,
      planType: status.type,
      dailyLimit: status.dailyLimit,
      todayUsage: status.todayUsage,
      remaining: status.remaining,
      error: null,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  reset: () => set(initialState),
}));
