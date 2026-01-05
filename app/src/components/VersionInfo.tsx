import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { healthCheck } from '../services/api';
import { useTheme } from '../theme';

const getUpdateDate = (): string => {
  if (!Updates.isEmbeddedLaunch && Updates.createdAt) {
    const d = new Date(Updates.createdAt);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${min}`;
  }
  return Constants.expoConfig?.extra?.buildDate ?? '';
};

export function VersionInfo() {
  const { colors, typography } = useTheme();
  const [serverDate, setServerDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const updateDate = getUpdateDate();

  useEffect(() => {
    healthCheck()
      .then((res) => {
        if (res.success && res.data?.buildDate) {
          setServerDate(res.data.buildDate);
        } else {
          setServerDate('-');
        }
      })
      .catch(() => {
        setServerDate('-');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, typography.caption, { color: colors.textMuted }]}>
        App v{appVersion} ({updateDate})
      </Text>
      <Text style={[styles.text, typography.caption, { color: colors.textMuted }]}>
        Server {loading ? '...' : serverDate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  text: {
    fontSize: 11,
  },
});
