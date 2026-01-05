// Spatial system based on 4px grid
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// Border radius - Modern, slightly more rounded
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

// Z-index scale
export const zIndex = {
  hide: -1,
  auto: 'auto' as const,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  toast: 1700,
  tooltip: 1800,
} as const;

// Animation timing
export const timing = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
} as const;

// Spring configs for Reanimated
export const springs = {
  // Snappy - Quick responses
  snappy: {
    damping: 20,
    stiffness: 400,
    mass: 0.8,
  },
  // Bouncy - Playful feel
  bouncy: {
    damping: 12,
    stiffness: 200,
    mass: 0.8,
  },
  // Gentle - Smooth transitions
  gentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
  },
  // Stiff - Minimal overshoot
  stiff: {
    damping: 30,
    stiffness: 400,
    mass: 0.8,
  },
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type ZIndex = typeof zIndex;
export type Timing = typeof timing;
export type Springs = typeof springs;
