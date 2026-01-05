import { useColorScheme } from 'react-native';
import { lightColors, darkColors, useColors, type Colors } from './colors';
import { typography, fontSizes, fontWeights, lineHeights, letterSpacing, type Typography } from './typography';
import { spacing, radius, zIndex, timing, springs, type Spacing, type Radius, type Springs } from './spacing';
import { shadows, darkShadows, type Shadows } from './shadows';

export interface Theme {
  colors: Colors;
  typography: Typography;
  fontSizes: typeof fontSizes;
  fontWeights: typeof fontWeights;
  lineHeights: typeof lineHeights;
  letterSpacing: typeof letterSpacing;
  spacing: Spacing;
  radius: Radius;
  zIndex: typeof zIndex;
  timing: typeof timing;
  springs: typeof springs;
  shadows: Shadows;
  isDark: boolean;
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: isDark ? darkColors : lightColors,
    typography,
    fontSizes,
    fontWeights,
    lineHeights,
    letterSpacing,
    spacing,
    radius,
    zIndex,
    timing,
    springs,
    shadows: isDark ? darkShadows : shadows,
    isDark,
  };
}

export {
  lightColors,
  darkColors,
  useColors,
  typography,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing,
  spacing,
  radius,
  zIndex,
  timing,
  springs,
  shadows,
  darkShadows,
};

export type { Colors, Typography, Spacing, Radius, Shadows, Springs };
