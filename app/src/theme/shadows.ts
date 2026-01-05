import { ViewStyle, Platform } from 'react-native';

interface ShadowStyle extends ViewStyle {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}

// Helper to create cross-platform shadows
const createShadow = (
  offsetY: number,
  blurRadius: number,
  opacity: number,
  elevation: number,
  color = '#000'
): ShadowStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: blurRadius,
  elevation,
});

// Light mode shadows - Subtle and refined
export const shadows = {
  none: {} as ShadowStyle,

  xs: createShadow(1, 2, 0.04, 1),
  sm: createShadow(2, 4, 0.06, 2),
  md: createShadow(4, 8, 0.08, 4),
  lg: createShadow(8, 16, 0.1, 6),
  xl: createShadow(12, 24, 0.12, 8),
  '2xl': createShadow(20, 40, 0.15, 12),

  // Inner shadow effect (simulated)
  inner: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  } as ShadowStyle,

  // Glow effect for active/focus states
  glow: (color: string): ShadowStyle => ({
    ...Platform.select({
      ios: {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  }),
} as const;

// Dark mode shadows - More pronounced
export const darkShadows = {
  none: {} as ShadowStyle,

  xs: createShadow(1, 2, 0.15, 1, '#000'),
  sm: createShadow(2, 4, 0.2, 2, '#000'),
  md: createShadow(4, 8, 0.25, 4, '#000'),
  lg: createShadow(8, 16, 0.3, 6, '#000'),
  xl: createShadow(12, 24, 0.35, 8, '#000'),
  '2xl': createShadow(20, 40, 0.4, 12, '#000'),

  // Inner shadow for dark mode
  inner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  } as ShadowStyle,

  // Glow for dark mode
  glow: (color: string): ShadowStyle => ({
    ...Platform.select({
      ios: {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  }),
} as const;

export type Shadows = typeof shadows;
