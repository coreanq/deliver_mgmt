import { useColorScheme } from 'react-native';

export interface Colors {
  // Core brand
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;

  // Backgrounds
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Borders & Dividers
  border: string;
  borderLight: string;
  divider: string;

  // Status colors
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

  // Delivery status specific
  statusPending: string;
  statusPendingBg: string;
  statusInTransit: string;
  statusInTransitBg: string;
  statusCompleted: string;
  statusCompletedBg: string;

  // Effects
  overlay: string;
  overlayLight: string;
  shadow: string;
  glow: string;

  // Gradients (start, end)
  gradientPrimary: [string, string];
  gradientAccent: [string, string];
  gradientSurface: [string, string];
}

// Industrial Premium - Dark Mode First
export const darkColors: Colors = {
  // Core brand - Deep Indigo & Coral
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  accent: '#F97316',
  accentLight: '#FB923C',
  accentDark: '#EA580C',

  // Backgrounds - Rich dark slate
  background: '#0C0F14',
  backgroundAlt: '#12161D',
  surface: '#1A1F2B',
  surfaceElevated: '#242B3A',
  surfacePressed: '#2D3548',

  // Text - High contrast
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0C0F14',

  // Borders
  border: '#334155',
  borderLight: '#1E293B',
  divider: 'rgba(148, 163, 184, 0.12)',

  // Status - Vibrant
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',
  successDark: '#16A34A',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  warningDark: '#F59E0B',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  errorDark: '#DC2626',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',
  infoDark: '#2563EB',

  // Delivery status
  statusPending: '#FBBF24',
  statusPendingBg: 'rgba(251, 191, 36, 0.12)',
  statusInTransit: '#3B82F6',
  statusInTransitBg: 'rgba(59, 130, 246, 0.12)',
  statusCompleted: '#22C55E',
  statusCompletedBg: 'rgba(34, 197, 94, 0.12)',

  // Effects
  overlay: 'rgba(12, 15, 20, 0.85)',
  overlayLight: 'rgba(12, 15, 20, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.5)',
  glow: 'rgba(99, 102, 241, 0.4)',

  // Gradients
  gradientPrimary: ['#6366F1', '#8B5CF6'],
  gradientAccent: ['#F97316', '#FB923C'],
  gradientSurface: ['#1A1F2B', '#12161D'],
};

// Light mode - Clean industrial
export const lightColors: Colors = {
  // Core brand
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#EA580C',
  accentLight: '#F97316',
  accentDark: '#C2410C',

  // Backgrounds - Warm white
  background: '#F8FAFC',
  backgroundAlt: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfacePressed: '#F1F5F9',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: 'rgba(15, 23, 42, 0.08)',

  // Status
  success: '#16A34A',
  successLight: '#DCFCE7',
  successDark: '#15803D',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  infoDark: '#1D4ED8',

  // Delivery status
  statusPending: '#D97706',
  statusPendingBg: '#FEF3C7',
  statusInTransit: '#2563EB',
  statusInTransitBg: '#DBEAFE',
  statusCompleted: '#16A34A',
  statusCompletedBg: '#DCFCE7',

  // Effects
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.3)',
  shadow: 'rgba(15, 23, 42, 0.08)',
  glow: 'rgba(79, 70, 229, 0.2)',

  // Gradients
  gradientPrimary: ['#4F46E5', '#6366F1'],
  gradientAccent: ['#EA580C', '#F97316'],
  gradientSurface: ['#FFFFFF', '#F8FAFC'],
};

export function useColors(): Colors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}
