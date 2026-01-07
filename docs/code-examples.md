# 코드 예시

> 이 문서는 [prd.md](./prd.md)의 참조 문서입니다.

---

# Part 1: 프로젝트 설정

## 1. app.json (Expo)

```json
{
  "expo": {
    "name": "배송관리",
    "slug": "delivery-app",
    "version": "1.0.0",
    "scheme": "delivery-app",
    "ios": {
      "bundleIdentifier": "com.yourcompany.deliveryapp",
      "infoPlist": {
        "NSCameraUsageDescription": "배송 완료 사진을 촬영하기 위해 카메라 접근이 필요합니다."
      }
    },
    "android": {
      "package": "com.yourcompany.deliveryapp",
      "permissions": ["CAMERA"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-camera", {
        "cameraPermission": "배송 완료 사진을 촬영하기 위해 카메라 접근이 필요합니다."
      }]
    ],
    "extra": {
      "apiBaseUrl": "https://yourapp.com"
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

## 2. eas.json

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "autoIncrement": true,
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

---

# Part 2: 모바일 앱 (Expo)

## 1. 역할 선택 화면 (`app/index.tsx`)

```typescript
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function RoleSelectScreen() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(200)}>
        <Text style={styles.emoji}>🚚</Text>
        <Text style={styles.title}>배송 관리 시스템</Text>
      </Animated.View>

      <Animated.View style={styles.buttons} entering={FadeInDown.delay(400)}>
        <Pressable
          style={styles.roleButton}
          onPress={() => router.push('/(admin)/login')}
        >
          <Text style={styles.roleEmoji}>👔</Text>
          <Text style={styles.roleTitle}>관리자</Text>
          <Text style={styles.roleDesc}>이메일로 로그인</Text>
        </Pressable>

        <Pressable
          style={styles.roleButton}
          onPress={() => router.push('/(staff)/scan')}
        >
          <Text style={styles.roleEmoji}>🚗</Text>
          <Text style={styles.roleTitle}>배송담당자</Text>
          <Text style={styles.roleDesc}>QR 코드로 접속</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginTop: 16, color: '#111827' },
  buttons: { marginTop: 48, gap: 16, width: '100%' },
  roleButton: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roleEmoji: { fontSize: 40 },
  roleTitle: { fontSize: 20, fontWeight: '600', marginTop: 12, color: '#111827' },
  roleDesc: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});
```

## 2. 배송완료 + 사진 촬영 (`app/(staff)/complete.tsx`)

```typescript
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { api } from '@/services/api';

export default function CompleteScreen() {
  const { orderId, customerName, phone, address } = useLocalSearchParams<{
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    const result = await cameraRef.current.takePictureAsync({
      quality: 0.7,
      base64: true,
    });

    if (result) {
      setPhoto(result.uri);
    }
  };

  const uploadAndSendSMS = async () => {
    if (!photo || !orderId) return;

    setIsUploading(true);

    try {
      // 1. 사진 업로드 + 상태 완료 처리
      const res = await api.completeDelivery(orderId, photo);

      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Upload failed');
      }

      const photoUrl = res.data.photoUrl;

      // 2. SMS 앱 열기
      const message = `안녕하세요, ${customerName}님

주문하신 상품이 배송 완료되었습니다.

📍 ${address}
📷 배송사진: ${photoUrl}

감사합니다! 🙏`;

      const smsUrl = Platform.select({
        ios: `sms:${phone}&body=${encodeURIComponent(message)}`,
        android: `sms:${phone}?body=${encodeURIComponent(message)}`,
      });

      if (smsUrl) {
        await Linking.openURL(smsUrl);
      }

      // 3. 목록으로 돌아가기
      router.replace('/(staff)/');
    } catch (error) {
      Alert.alert('오류', '업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>카메라 권한이 필요합니다</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>권한 요청</Text>
        </Pressable>
      </View>
    );
  }

  // 사진 촬영 전
  if (!photo) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.controls}>
          <Text style={styles.instruction}>배송 완료 사진을 촬영하세요</Text>
          <Pressable style={styles.captureButton} onPress={takePhoto}>
            <Text style={styles.captureText}>📷 촬영</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 사진 촬영 후
  return (
    <View style={styles.container}>
      <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" />
      <View style={styles.info}>
        <Text style={styles.success}>✅ 사진이 저장되었습니다</Text>
        <Text style={styles.infoText}>고객: {customerName}</Text>
        <Text style={styles.infoText}>연락처: {phone}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={uploadAndSendSMS}
          disabled={isUploading}
        >
          <Text style={styles.primaryButtonText}>
            {isUploading ? '업로드 중...' : '📱 고객에게 SMS 발송'}
          </Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => setPhoto(null)}>
          <Text style={styles.linkText}>다시 촬영하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  preview: { flex: 1 },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  instruction: { color: '#fff', fontSize: 16, marginBottom: 16 },
  captureButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
  },
  captureText: { fontSize: 18, fontWeight: '600' },
  info: { backgroundColor: '#fff', padding: 16 },
  success: { fontSize: 16, fontWeight: '600', color: '#10B981', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#6B7280' },
  actions: { backgroundColor: '#fff', padding: 16, gap: 12 },
  button: { padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryButton: { backgroundColor: '#2563EB' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  message: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  buttonText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
});
```

## 3. API 서비스 (`src/services/api.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import type { ApiResponse, Delivery, User } from '@/types';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://yourapp.com';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // 관리자 인증
  async sendMagicLink(email: string): Promise<ApiResponse<void>> {
    const res = await this.client.post('/api/auth/magic-link/send', { email });
    return res.data;
  }

  async verifyMagicLink(token: string): Promise<ApiResponse<{ user: User; sessionToken: string }>> {
    const res = await this.client.post('/api/auth/magic-link/verify', { token });
    return res.data;
  }

  // 배송담당자 인증
  async verifyQRToken(token: string): Promise<ApiResponse<{ staffName: string; date: string }>> {
    const res = await this.client.post('/api/auth/qr/verify', { token });
    return res.data;
  }

  async verifyStaffName(token: string, name: string): Promise<ApiResponse<{ sessionToken: string }>> {
    const res = await this.client.post('/api/auth/staff/verify', { token, name });
    return res.data;
  }

  // 배송 목록
  async getDeliveries(date: string): Promise<ApiResponse<Delivery[]>> {
    const res = await this.client.get(`/api/delivery/list?date=${date}`);
    return res.data;
  }

  async getStaffDeliveries(date: string, staffName: string): Promise<ApiResponse<Delivery[]>> {
    const res = await this.client.get(`/api/delivery/staff/${encodeURIComponent(staffName)}?date=${date}`);
    return res.data;
  }

  // 상태 변경
  async updateStatus(id: string, status: string): Promise<ApiResponse<Delivery>> {
    const res = await this.client.put(`/api/delivery/${id}/status`, { status });
    return res.data;
  }

  // 배송완료 + 사진 업로드
  async completeDelivery(id: string, photoUri: string): Promise<ApiResponse<{ photoUrl: string }>> {
    // 사진을 Base64로 읽기
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const res = await this.client.post(`/api/delivery/${id}/complete`, {
      photo: base64,
    });

    return res.data;
  }
}

export const api = new ApiService();
```

## 4. 관리자 앱 - PC 웹 링크 안내 (`app/(admin)/index.tsx`)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Linking, Share } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { api } from '@/services/api';
import { DeliveryCard } from '@/components/DeliveryCard';

import { DatePicker } from '@/components/DatePicker';
import type { Delivery } from '@/types';

const PC_WEB_URL = 'https://yourapp.com';

export default function AdminDashboard() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await api.getDeliveries(date);
    if (res.success && res.data) {
      setDeliveries(res.data);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedCount = deliveries.filter((d) => d.status === '배송 완료').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DatePicker value={date} onChange={setDate} />
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            총 {deliveries.length}건 | 완료 {completedCount}건
          </Text>
        </View>
        
        {/* QR 생성 버튼 */}
        <Pressable
          style={styles.qrButton}
          onPress={() => router.push({ pathname: '/(admin)/qr-generate', params: { date } })}
        >
          <Text style={styles.qrButtonText}>📱 배송담당자 QR 생성</Text>
        </Pressable>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn}>
            <DeliveryCard delivery={item} variant="admin" />
          </Animated.View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>배송 데이터가 없습니다</Text>}
      />

      {/* PC 웹 링크 안내 */}
      <View style={styles.pcWebBanner}>
        <Pressable style={styles.pcWebButton} onPress={() => Linking.openURL(PC_WEB_URL)}>
          <Text style={styles.pcWebEmoji}>💻</Text>
          <View>
            <Text style={styles.pcWebTitle}>PC에서 엑셀 작업하기</Text>
            <Text style={styles.pcWebUrl}>{PC_WEB_URL}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  stats: { marginTop: 8 },
  statsText: { fontSize: 14, color: '#6B7280' },
  qrButton: { 
    marginTop: 12, 
    backgroundColor: '#2563EB', 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  qrButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 48 },
  pcWebBanner: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  pcWebButton: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pcWebEmoji: { fontSize: 32 },
  pcWebTitle: { fontSize: 16, fontWeight: '600', color: '#1E40AF' },
  pcWebUrl: { fontSize: 12, color: '#3B82F6' },
});
```

## 5. QR 생성 화면 (`app/(admin)/qr-generate.tsx`)

```typescript
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/services/api';

interface StaffSummary {
  staffName: string;
  count: number;
}

export default function QRGenerateScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [staffList, setStaffList] = useState<StaffSummary[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  useEffect(() => {
    api.getStaffList(date ?? new Date().toISOString().slice(0, 10)).then((res) => {
      if (res.success && res.data) {
        setStaffList(res.data);
      }
    });
  }, [date]);

  const generateQR = async () => {
    if (!selectedStaff) return;

    const res = await api.generateQRToken(selectedStaff, date ?? new Date().toISOString().slice(0, 10));
    if (res.success && res.data) {
      setQrToken(res.data.token);
    }
  };

  // QR 표시 화면
  if (qrToken && selectedStaff) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{selectedStaff}님 전용 QR</Text>
        <Text style={styles.date}>{date}</Text>

        <View style={styles.qrContainer}>
          <QRCode value={qrToken} size={200} />
        </View>

        <Text style={styles.expiry}>⏱️ 유효시간: 오늘 자정까지</Text>
        <Text style={styles.info}>
          ℹ️ 배송담당자가 이 QR을 스캔하면{'\n'}
          오늘의 배송 목록을 확인할 수 있습니다
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => {
            setQrToken(null);
            setSelectedStaff(null);
          }}
        >
          <Text style={styles.buttonText}>다른 담당자 선택</Text>
        </Pressable>
      </View>
    );
  }

  // 담당자 선택 화면
  return (
    <View style={styles.container}>
      <Text style={styles.title}>배송담당자 선택</Text>
      <Text style={styles.date}>날짜: {date}</Text>

      <FlatList
        data={staffList}
        keyExtractor={(item) => item.staffName}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.staffItem,
              selectedStaff === item.staffName && styles.staffItemSelected,
            ]}
            onPress={() => setSelectedStaff(item.staffName)}
          >
            <Text style={styles.radioIcon}>
              {selectedStaff === item.staffName ? '●' : '○'}
            </Text>
            <Text style={styles.staffName}>{item.staffName}</Text>
            <Text style={styles.staffCount}>({item.count}건)</Text>
          </Pressable>
        )}
        style={styles.list}
      />

      <Pressable
        style={[styles.button, !selectedStaff && styles.buttonDisabled]}
        onPress={generateQR}
        disabled={!selectedStaff}
      >
        <Text style={styles.buttonText}>QR 코드 생성</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', color: '#111827' },
  date: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4 },
  list: { marginTop: 24 },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  staffItemSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  radioIcon: { fontSize: 16, color: '#2563EB', marginRight: 12 },
  staffName: { flex: 1, fontSize: 16, color: '#111827' },
  staffCount: { fontSize: 14, color: '#6B7280' },
  button: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrContainer: {
    alignItems: 'center',
    marginTop: 32,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  expiry: { textAlign: 'center', marginTop: 24, fontSize: 14, color: '#F59E0B' },
  info: { textAlign: 'center', marginTop: 12, fontSize: 14, color: '#6B7280', lineHeight: 20 },
});
```

# Part 3: Backend (Cloudflare Workers)

## 1. wrangler.toml

```toml
name = "delivery-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./web/dist"

[[d1_databases]]
binding = "DB"
database_name = "delivery-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "delivery-photos"

[triggers]
crons = ["0 0 * * *"]

[vars]
APP_URL = "https://yourapp.com"
```

## 2. 메인 엔트리 (`src/index.ts`)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import upload from './routes/upload';
import delivery from './routes/delivery';
import { cleanupExpiredData } from './cron/cleanup';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors({
  origin: ['https://yourapp.com', 'exp://localhost:8081'],
  credentials: true,
}));

app.route('/api/auth', auth);
app.route('/api/upload', upload);
app.route('/api/delivery', delivery);

// Cron Trigger
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupExpiredData(env));
  },
};
```

## 3. 배송완료 + 사진 업로드 (`src/routes/delivery.ts`)

```typescript
import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
};

const delivery = new Hono<{ Bindings: Bindings }>();

// 배송완료 + 사진 업로드
delivery.post('/:id/complete', async (c) => {
  const { id } = c.req.param();
  const { photo } = await c.req.json<{ photo: string }>(); // Base64

  // 배송 정보 조회
  const deliveryData = await c.env.DB.prepare(
    'SELECT * FROM deliveries WHERE id = ?'
  ).bind(id).first();

  if (!deliveryData) {
    return c.json({ success: false, error: 'Delivery not found' }, 404);
  }

  // R2에 사진 업로드
  const photoKey = `${deliveryData.user_id}/${deliveryData.order_date}/${id}.jpg`;
  const photoBuffer = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));

  await c.env.R2.put(photoKey, photoBuffer, {
    httpMetadata: { contentType: 'image/jpeg' },
  });

  const photoUrl = `https://r2.yourapp.com/${photoKey}`;

  // D1 업데이트
  await c.env.DB.prepare(`
    UPDATE deliveries 
    SET status = '배송 완료', completed_at = ?, photo_url = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    new Date().toISOString(),
    photoUrl,
    new Date().toISOString(),
    id
  ).run();

  return c.json({
    success: true,
    data: { photoUrl },
  });
});

// 배송담당자별 목록
delivery.get('/staff/:name', async (c) => {
  const { name } = c.req.param();
  const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);
  const userId = c.get('userId');

  const result = await c.env.DB.prepare(`
    SELECT * FROM deliveries 
    WHERE user_id = ? AND staff_name = ? AND order_date = ?
    ORDER BY created_at ASC
  `).bind(userId, name, date).all();

  return c.json({ success: true, data: result.results });
});

export default delivery;
```

## 4. 데이터 정리 Cron (`src/cron/cleanup.ts`)

```typescript
type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
};

export async function cleanupExpiredData(env: Bindings) {
  console.log('Starting cleanup...');

  // 1. 구독 플랜에 따른 배송 데이터 삭제
  const expiredDeliveries = await env.DB.prepare(`
    SELECT d.id, d.photo_url
    FROM deliveries d
    JOIN subscriptions s ON d.user_id = s.user_id
    WHERE d.order_date < date('now', '-' || s.retention_days || ' days')
  `).all();

  // R2 사진도 함께 삭제
  for (const row of expiredDeliveries.results) {
    if (row.photo_url) {
      const key = (row.photo_url as string).replace('https://r2.yourapp.com/', '');
      try {
        await env.R2.delete(key);
      } catch (e) {
        console.error(`Failed to delete R2 key: ${key}`);
      }
    }
  }

  const deleteResult = await env.DB.prepare(`
    DELETE FROM deliveries 
    WHERE id IN (
      SELECT d.id FROM deliveries d
      JOIN subscriptions s ON d.user_id = s.user_id
      WHERE d.order_date < date('now', '-' || s.retention_days || ' days')
    )
  `).run();

  console.log(`Deleted ${deleteResult.meta.changes} expired deliveries`);

  // 2. 사진은 구독과 관계없이 7일 후 삭제 (배송 데이터는 유지)
  const expiredPhotos = await env.DB.prepare(`
    SELECT id, photo_url FROM deliveries 
    WHERE photo_url IS NOT NULL 
    AND completed_at < datetime('now', '-7 days')
  `).all();

  for (const row of expiredPhotos.results) {
    if (row.photo_url) {
      const key = (row.photo_url as string).replace('https://r2.yourapp.com/', '');
      try {
        await env.R2.delete(key);
        await env.DB.prepare('UPDATE deliveries SET photo_url = NULL WHERE id = ?')
          .bind(row.id).run();
      } catch (e) {
        console.error(`Failed to delete photo: ${row.id}`);
      }
    }
  }

  console.log(`Deleted ${expiredPhotos.results.length} expired photos (7 days)`);
}
```

---

# Part 4: PC 웹 (관리자 전용)

## 1. 엑셀 업로드 (`web/src/pages/Upload.tsx`)

```tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';

export function UploadPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    const res = await api.parseExcel(formData);

    if (res.success && res.data) {
      navigate(`/mapping?uploadId=${res.data.uploadId}`);
    }

    setIsLoading(false);
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">엑셀 업로드</h1>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        {isLoading ? (
          <p className="text-gray-500">파일 처리 중...</p>
        ) : (
          <>
            <p className="text-4xl mb-4">📤</p>
            <p className="text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-gray-400 text-sm mt-2">xlsx, xls, csv 지원</p>
          </>
        )}
      </div>
    </div>
  );
}
```

---

# Part 5: 빌드 및 배포

```bash
# 1. D1 + KV + R2 생성
wrangler d1 create delivery-db
wrangler kv:namespace create DELIVERY_KV
wrangler r2 bucket create delivery-photos

# 2. 스키마 적용
wrangler d1 execute delivery-db --file=./schema.sql

# 3. 환경변수 설정
wrangler secret put RESEND_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put CF_AIG_AUTH_TOKEN
wrangler secret put OPENAI_API_KEY

# 4. 빌드 + 배포
cd workers/web && npm run build && cd ..
wrangler deploy
```

---

*문서 버전: 3.0*  
*작성일: 2025-12-31*
