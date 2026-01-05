import { TextStyle, Platform } from 'react-native';

// Bold, industrial typography scale
export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
};

export const lineHeights = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
} as const;

export const letterSpacing = {
  tighter: -1.5,
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
} as const;

// System font with fallbacks optimized for Korean
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Display - Hero headlines
  display: {
    fontSize: fontSizes['5xl'],
    fontWeight: fontWeights.extrabold,
    lineHeight: fontSizes['5xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tighter,
    fontFamily,
  } as TextStyle,

  // Headlines
  h1: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
    fontFamily,
  } as TextStyle,

  h2: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['3xl'] * lineHeights.snug,
    letterSpacing: letterSpacing.tight,
    fontFamily,
  } as TextStyle,

  h3: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['2xl'] * lineHeights.snug,
    letterSpacing: letterSpacing.tight,
    fontFamily,
  } as TextStyle,

  h4: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.normal,
    fontFamily,
  } as TextStyle,

  // Body text
  bodyLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.lg * lineHeights.relaxed,
    fontFamily,
  } as TextStyle,

  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.md * lineHeights.normal,
    fontFamily,
  } as TextStyle,

  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.normal,
    fontFamily,
  } as TextStyle,

  // Utility styles
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
    fontFamily,
  } as TextStyle,

  overline: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    fontFamily,
  } as TextStyle,

  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
    fontFamily,
  } as TextStyle,

  // Buttons
  buttonLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.snug,
    letterSpacing: letterSpacing.wide,
    fontFamily,
  } as TextStyle,

  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.snug,
    letterSpacing: letterSpacing.wide,
    fontFamily,
  } as TextStyle,

  buttonSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.sm * lineHeights.snug,
    letterSpacing: letterSpacing.wide,
    fontFamily,
  } as TextStyle,

  // Numbers - For stats and metrics
  metric: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['3xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
    fontFamily,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  metricLarge: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.extrabold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tighter,
    fontFamily,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;

export type Typography = typeof typography;
