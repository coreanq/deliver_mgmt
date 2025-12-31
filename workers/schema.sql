-- 배송 관리 시스템 D1 스키마

-- 관리자 테이블
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 관리자 이메일 인덱스
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Magic Link 토큰 테이블
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Magic Link 토큰 인덱스
CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);

-- QR 토큰 테이블 (배송담당자 인증용)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  fail_count INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- QR 토큰 인덱스
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_admin_id ON qr_tokens(admin_id);

-- 배송 테이블
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  staff_name TEXT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  memo TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_transit', 'completed')),
  delivery_date TEXT NOT NULL,
  completed_at TEXT,
  photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 배송 인덱스
CREATE INDEX IF NOT EXISTS idx_deliveries_admin_id ON deliveries(admin_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_staff_name ON deliveries(staff_name);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
-- 복합 인덱스 (관리자별 날짜 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_deliveries_admin_date ON deliveries(admin_id, delivery_date);

-- 구독 테이블
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  admin_id TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'free' CHECK(type IN ('free', 'basic', 'pro')),
  retention_days INTEGER DEFAULT 7,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 구독 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_admin_id ON subscriptions(admin_id);

-- 엑셀 매핑 패턴 저장 (AI 학습용)
CREATE TABLE IF NOT EXISTS mapping_patterns (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  source_headers TEXT NOT NULL, -- JSON array
  field_mapping TEXT NOT NULL,  -- JSON object
  use_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 매핑 패턴 인덱스
CREATE INDEX IF NOT EXISTS idx_mapping_patterns_admin_id ON mapping_patterns(admin_id);
