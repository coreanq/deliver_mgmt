import { useColorScheme } from 'react-native';

export interface Colors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  border: string;
  borderLight: string;
  success: string;
  successLight: string;
  successDark: string;
  warning: string;
  warningLight: string;
  warningDark: string;
  error: string;
  errorLight: string;
  errorDark: string;
  info: string;
  infoLight: string;
  infoDark: string;
  statusPending: string;
  statusPendingBg: string;
  statusInTransit: string;
  statusInTransitBg: string;
  statusCompleted: string;
  statusCompletedBg: string;
  overlay: string;
  shadow: string;
}

export const lightColors: Colors = {
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  
  secondary: '#0EA5E9',
  secondaryLight: '#38BDF8',
  secondaryDark: '#0284C7',
  
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',
  
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',
  
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',
  
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',
  
  statusPending: '#F59E0B',
  statusPendingBg: '#FEF3C7',
  statusInTransit: '#3B82F6',
  statusInTransitBg: '#DBEAFE',
  statusCompleted: '#10B981',
  statusCompletedBg: '#D1FAE5',
  
  overlay: 'rgba(15, 23, 42, 0.5)',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

export const darkColors: Colors = {
  primary: '#818CF8',
  primaryLight: '#A5B4FC',
  primaryDark: '#6366F1',
  
  secondary: '#38BDF8',
  secondaryLight: '#7DD3FC',
  secondaryDark: '#0EA5E9',
  
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  
  border: '#334155',
  borderLight: '#1E293B',
  
  success: '#34D399',
  successLight: 'rgba(16, 185, 129, 0.2)',
  successDark: '#10B981',
  
  warning: '#FBBF24',
  warningLight: 'rgba(245, 158, 11, 0.2)',
  warningDark: '#F59E0B',
  
  error: '#F87171',
  errorLight: 'rgba(239, 68, 68, 0.2)',
  errorDark: '#EF4444',
  
  info: '#60A5FA',
  infoLight: 'rgba(59, 130, 246, 0.2)',
  infoDark: '#3B82F6',
  
  statusPending: '#FBBF24',
  statusPendingBg: 'rgba(245, 158, 11, 0.2)',
  statusInTransit: '#60A5FA',
  statusInTransitBg: 'rgba(59, 130, 246, 0.2)',
  statusCompleted: '#34D399',
  statusCompletedBg: 'rgba(16, 185, 129, 0.2)',
  
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: 'rgba(0, 0, 0, 0.3)',
};

export function useColors(): Colors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}
