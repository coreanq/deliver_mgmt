import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { DeliveryStatus } from '../types';

interface StatusBadgeProps {
  status: DeliveryStatus;
  size?: 'sm' | 'md';
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { colors, radius } = useTheme();
  
  const getStatusConfig = (): StatusConfig => {
    switch (status) {
      case 'pending':
        return {
          label: '배송 준비',
          bgColor: colors.statusPendingBg,
          textColor: colors.statusPending,
        };
      case 'in_transit':
        return {
          label: '배송 중',
          bgColor: colors.statusInTransitBg,
          textColor: colors.statusInTransit,
        };
      case 'completed':
        return {
          label: '완료',
          bgColor: colors.statusCompletedBg,
          textColor: colors.statusCompleted,
        };
      default:
        return {
          label: status,
          bgColor: colors.surfaceSecondary,
          textColor: colors.textSecondary,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { 
          backgroundColor: config.bgColor,
          borderRadius: radius.full,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          { color: config.textColor },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 12,
  },
});
