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


--

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
  custom_fields TEXT,
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
  retention_days INTEGER DEFAULT 3,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 구독 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_admin_id ON subscriptions(admin_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_admin_created ON deliveries(admin_id, created_at);

-- SMS 템플릿 테이블
CREATE TABLE IF NOT EXISTS sms_templates (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  use_ai INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- SMS 템플릿 인덱스
CREATE INDEX IF NOT EXISTS idx_sms_templates_admin_id ON sms_templates(admin_id);

-- 커스텀 필드 정의 테이블
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_order INTEGER DEFAULT 0,
  is_editable_by_staff INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 커스텀 필드 정의 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_admin_id ON custom_field_definitions(admin_id);
