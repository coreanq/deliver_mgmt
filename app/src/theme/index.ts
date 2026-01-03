import { useColorScheme } from 'react-native';
import { lightColors, darkColors, useColors, type Colors } from './colors';
import { typography, fontSizes, fontWeights, lineHeights, type Typography } from './typography';
import { spacing, radius, type Spacing, type Radius } from './spacing';
import { shadows, darkShadows, type Shadows } from './shadows';

export interface Theme {
  colors: Colors;
  typography: Typography;
  fontSizes: typeof fontSizes;
  fontWeights: typeof fontWeights;
  lineHeights: typeof lineHeights;
  spacing: Spacing;
  radius: Radius;
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
    spacing,
    radius,
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
  spacing,
  radius,
  shadows,
  darkShadows,
};

export type { Colors, Typography, Spacing, Radius, Shadows };
