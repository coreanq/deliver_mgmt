import { View, Text, StyleSheet, useColorScheme } from 'react-native';

interface AdBannerProps {
  size?: 'small' | 'medium' | 'large';
}

export function AdBanner({ size = 'medium' }: AdBannerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getHeight = (): number => {
    switch (size) {
      case 'small':
        return 50;
      case 'large':
        return 100;
      default:
        return 60;
    }
  };

  if (__DEV__) {
    return (
      <View 
        style={[
          styles.placeholder, 
          { 
            height: getHeight(),
            backgroundColor: isDark ? '#374151' : '#e5e7eb',
          }
        ]}
      >
        <Text style={[styles.placeholderText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Ad Placeholder
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: getHeight() }]}>
      <Text style={[styles.adText, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
        Advertisement
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  adText: {
    fontSize: 10,
  },
});
