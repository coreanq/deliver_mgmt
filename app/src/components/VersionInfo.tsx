import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { API_BASE_URL } from '@/constants';

interface VersionInfoProps {
  style?: object;
}

export function VersionInfo({ style }: VersionInfoProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [serverBuildDate, setServerBuildDate] = useState<string>('');

  // 앱 버전 정보
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const appBuildDate = Constants.expoConfig?.extra?.buildDate ?? '';

  // OTA 업데이트 시점
  const getUpdateDate = () => {
    if (Updates.isEmbeddedLaunch) {
      return appBuildDate;
    }
    const updateTime = Updates.createdAt;
    if (updateTime) {
      const d = new Date(updateTime);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yy}/${mm}/${dd} ${hh}:${min}`;
    }
    return appBuildDate;
  };

  // 서버 빌드 날짜 가져오기
  useEffect(() => {
    const fetchServerBuildDate = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        const data = await res.json();
        if (data.buildDate) {
          setServerBuildDate(data.buildDate);
        }
      } catch {
        // 서버 연결 실패 시 무시
      }
    };
    fetchServerBuildDate();
  }, []);

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.versionText, { color: isDark ? '#555' : '#94a3b8' }]}>
        App v{appVersion} ({getUpdateDate()})
      </Text>
      {serverBuildDate && (
        <Text style={[styles.versionText, { color: isDark ? '#444' : '#a1a1aa' }]}>
          Server {serverBuildDate}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
