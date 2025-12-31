# 데이터베이스 스키마

> 이 문서는 [prd.md](./prd.md)의 참조 문서입니다.

## 개요

| 저장소 | 용도 |
|--------|------|
| **Cloudflare D1** | 사용자, 배송, 매핑 캐시, 구독 |
| **Cloudflare R2** | 배송완료 사진 |
| **Cloudflare KV** | 세션, Magic Link 토큰 |

---

## 1. Cloudflare D1 스키마

### schema.sql

```sql
-- ============================================
-- 사용자 테이블
-- ============================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',  -- 'admin' only (staff는 QR로 접근)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 구독 테이블
-- ============================================
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free',  -- 'free', 'basic', 'pro'
  retention_days INTEGER DEFAULT 7,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ============================================
-- 배송 테이블
-- ============================================
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  staff_name TEXT,
  status TEXT DEFAULT '주문 완료',
  memo TEXT,
  order_date DATE NOT NULL,
  order_time DATETIME,
  completed_at DATETIME,
  photo_url TEXT,  -- R2 사진 URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_deliveries_user_date ON deliveries(user_id, order_date);
CREATE INDEX idx_deliveries_staff ON deliveries(user_id, staff_name, order_date);
CREATE INDEX idx_deliveries_cleanup ON deliveries(user_id, order_date);

-- ============================================
-- 매핑 캐시 테이블
-- ============================================
CREATE TABLE mapping_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  header_hash TEXT NOT NULL,
  original_headers TEXT NOT NULL,  -- JSON
  mappings TEXT NOT NULL,          -- JSON
  use_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, header_hash)
);

CREATE INDEX idx_mapping_user_hash ON mapping_cache(user_id, header_hash);

-- ============================================
-- QR 토큰 테이블 (배송담당자용)
-- ============================================
CREATE TABLE qr_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,  -- 관리자 ID
  staff_name TEXT NOT NULL,
  date DATE NOT NULL,
  token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_qr_user_staff_date ON qr_tokens(user_id, staff_name, date);
```

---

## 2. 구독 플랜

| 플랜 | retention_days | 가격 |
|------|----------------|------|
| free | 7 | 무료 |
| basic | 30 | TBD |
| pro | 90 | TBD |

### 데이터 보관 정책

```typescript
// Cron Trigger: 매일 00:00 실행
async function cleanupExpiredData(env: Bindings) {
  // 1. 구독 플랜에 따른 배송 데이터 삭제
  const expiredDeliveries = await env.DB.prepare(`
    DELETE FROM deliveries 
    WHERE id IN (
      SELECT d.id FROM deliveries d
      JOIN subscriptions s ON d.user_id = s.user_id
      WHERE d.order_date < date('now', '-' || s.retention_days || ' days')
    )
  `).run();
  
  console.log(`Deleted ${expiredDeliveries.meta.changes} expired deliveries`);
  
  // 2. 사진은 구독과 관계없이 7일 후 삭제
  const expiredPhotos = await env.DB.prepare(`
    SELECT id, photo_url FROM deliveries 
    WHERE photo_url IS NOT NULL 
    AND completed_at < date('now', '-7 days')
  `).all();
  
  for (const row of expiredPhotos.results) {
    if (row.photo_url) {
      const key = (row.photo_url as string).replace('https://r2.yourapp.com/', '');
      await env.R2.delete(key);
      await env.DB.prepare('UPDATE deliveries SET photo_url = NULL WHERE id = ?')
        .bind(row.id).run();
    }
  }
  
  console.log(`Deleted ${expiredPhotos.results.length} expired photos`);
}
```

**정책 요약**
| 항목 | 보관 기간 | 비고 |
|------|----------|------|
| 배송 데이터 | 구독 플랜에 따름 | free: 7일, basic: 30일, pro: 90일 |
| 배송완료 사진 | **7일 (고정)** | 구독과 관계없이 삭제 |

---

## 3. Cloudflare R2 (사진 저장)

### 버킷 구조

```
delivery-photos/
├── {user_id}/
│   ├── {date}/
│   │   ├── {delivery_id}.jpg
│   │   └── {delivery_id}.jpg
│   └── {date}/
│       └── ...
```

### 사진 업로드 API

```typescript
// POST /api/delivery/:id/complete
async function uploadPhoto(env: Bindings, deliveryId: string, photoData: ArrayBuffer) {
  const key = `${userId}/${date}/${deliveryId}.jpg`;
  
  await env.R2.put(key, photoData, {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  
  // 공개 URL 생성 (또는 signed URL)
  const photoUrl = `https://r2.yourapp.com/${key}`;
  
  // D1에 URL 저장
  await env.DB.prepare(
    'UPDATE deliveries SET photo_url = ?, status = ?, completed_at = ? WHERE id = ?'
  ).bind(photoUrl, '배송 완료', new Date().toISOString(), deliveryId).run();
  
  return photoUrl;
}
```

### wrangler.toml R2 설정

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "delivery-photos"
```

---

## 4. Cloudflare KV

### KV Namespace: `DELIVERY_KV`

#### 세션

```typescript
// Key: session:{sessionId}
// TTL: 7일
interface Session {
  userId: string;
  email: string;
  role: 'admin';
  createdAt: string;
}
```

#### Magic Link 토큰

```typescript
// Key: magic_link:{token}
// TTL: 10분
interface MagicLinkToken {
  email: string;
  createdAt: string;
  used: boolean;
}
```

#### 임시 업로드

```typescript
// Key: upload_temp:{uploadId}
// TTL: 1시간
interface TempUpload {
  userId: string;
  fileName: string;
  headers: string[];
  headerHash: string;
  rows: any[];
}
```

---

## 5. TypeScript 타입

### `types/index.ts`

```typescript
// ============================================
// 상태
// ============================================

export type DeliveryStatus =
  | '주문 완료'
  | '상품 준비중'
  | '배송 준비중'
  | '배송 출발'
  | '배송 완료';

export type SubscriptionPlan = 'free' | 'basic' | 'pro';

export const PLAN_RETENTION: Record<SubscriptionPlan, number> = {
  free: 7,
  basic: 30,
  pro: 90,
};

// ============================================
// 사용자
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin';
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  retentionDays: number;
  startedAt: string;
  expiresAt: string | null;
}

// ============================================
// 배송
// ============================================

export interface Delivery {
  id: string;
  userId: string;
  orderId: string | null;
  customerName: string;
  phone: string;
  address: string;
  staffName: string | null;
  status: DeliveryStatus;
  memo: string | null;
  orderDate: string;
  completedAt: string | null;
  photoUrl: string | null;  // R2 URL
  createdAt: string;
}

// ============================================
// QR 토큰 (배송담당자용)
// ============================================

export interface QRTokenPayload {
  userId: string;     // 관리자 ID
  staffName: string;  // 배송담당자 이름
  date: string;       // YYYY-MM-DD
  exp: number;        // 만료 시간
  iat: number;        // 발급 시간
}

// ============================================
// 매핑
// ============================================

export type DbField =
  | 'customerName'
  | 'phone'
  | 'address'
  | 'staffName'
  | 'memo'
  | 'orderId'
  | 'orderTime'
  | 'skip';

export interface ColumnMapping {
  excelColumn: string;
  dbField: DbField;
  confidence: number;
}

// ============================================
// API 응답
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 6. 데이터 플로우

### 관리자 플로우

```
[PC 웹] 엑셀 업로드
    ↓
[Worker] 파싱 → KV에 임시 저장 (1시간)
    ↓
[Worker] 매핑 추천 (캐시 또는 AI)
    ↓
[PC 웹] 매핑 확정
    ↓
[Worker] D1에 deliveries INSERT
    ↓
[관리자 앱] 카드뷰로 조회
```

### 배송담당자 플로우

```
[앱] QR 스캔 → JWT 검증
    ↓
[앱] 본인 이름 입력 → 확인
    ↓
[앱] 오늘 배송 목록 조회 (staff_name + date)
    ↓
[앱] 상태 변경 → D1 UPDATE
    ↓
[앱] 배송완료 → 카메라 → 사진 촬영
    ↓
[Worker] R2에 사진 업로드 → URL 저장
    ↓
[앱] SMS 앱 열기 (번호 + 내용 + 사진 URL)
```

### 데이터 정리 (Cron)

```
[Cron] 매일 00:00 실행
    ↓
[Worker] 각 사용자의 retention_days 확인
    ↓
[Worker] 초과된 deliveries 삭제
    ↓
[Worker] R2 사진도 삭제
```

---

## 7. wrangler.toml 전체

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
crons = ["0 0 * * *"]  # 매일 00:00 UTC

[vars]
APP_URL = "https://yourapp.com"
```

---

*문서 버전: 3.0*  
*작성일: 2025-12-31*
