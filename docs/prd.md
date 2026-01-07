# 배송 관리 시스템 - Product Requirements Document

## 개요

하나의 앱에서 관리자와 배송담당자 역할을 선택하여 사용하는 배송 관리 시스템입니다.

**핵심 구조**
- **모바일 앱 1개** (Expo): 관리자/배송담당자 역할 선택
- **PC 웹** (Workers Assets): 관리자 전용 엑셀 업로드/매핑/데이터 관리
- **백엔드** (Cloudflare Workers + D1): API, 사용자별 DB

**타겟 플랫폼**
- 모바일: iOS, Android (Expo SDK 54)
- PC: 웹 브라우저 (관리자 엑셀 작업용)

## 사용자 역할 및 접근 방식

| 역할 | 접근 방식 | 주요 기능 |
|------|----------|----------|
| **관리자 (앱)** | Magic Link 로그인 | 날짜별 배송정보 카드뷰 조회, PC 웹 링크 |
| **관리자 (PC 웹)** | Magic Link 로그인 | 엑셀 업로드, AI 매핑, 데이터 관리 |
| **배송담당자** | QR 코드 스캔 | 오늘 배송 리스트, 배송완료 + 사진 촬영 → SMS |

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    모바일 앱 (1개)                       │    │
│  │  ┌─────────────────┐      ┌─────────────────┐          │    │
│  │  │   관리자 모드    │      │  배송담당자 모드  │          │    │
│  │  │                 │      │                 │          │    │
│  │  │ • Magic Link    │      │ • QR 코드 스캔   │          │    │
│  │  │ • 카드뷰 조회   │      │ • 배송 리스트    │          │    │
│  │  │ • PC 웹 링크    │      │ • 사진 촬영      │          │    │
│  │  │                 │      │ • SMS 발송      │          │    │
│  │  └─────────────────┘      └─────────────────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │        PC 웹 (관리자 전용) │                               │  │
│  │  • 엑셀 업로드             │                               │  │
│  │  • AI 매핑                │                               │  │
│  │  • 데이터 관리            │                               │  │
│  └───────────────────────────┼───────────────────────────────┘  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           Cloudflare Workers (API + 웹 서빙)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           Cloudflare D1 (Database)                      │    │
│  │  • 날짜별 배송 데이터 (기본 7일 보관)                      │    │
│  │  • 유료 구독 시 보관일수 증가                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 기능 요구사항

### 1. 앱 진입 화면 (역할 선택)

앱 실행 시 관리자/배송담당자 역할을 선택하는 화면 표시

### 2. 관리자 모드

#### 2.1 인증: Magic Link
- 이메일 입력 → Magic Link 발송 → 클릭 → 자동 로그인
- 테스트용 이메일 바로 통과: `dev@test.com`, `dev@example.com`

#### 2.2 앱 기능 (모바일)
- **날짜별 배송정보 조회**: 카드뷰 형태로 표시
- **배송담당자 QR 생성**: 담당자 선택 → QR 코드 표시 → 담당자가 스캔
- **PC 웹 링크 제공**: "PC에서 엑셀 작업하려면 여기로 접속하세요"

- 엑셀 업로드 기능 **없음** (PC 웹에서만)

#### 2.3 PC 웹 기능 (관리자 전용)
- **엑셀 업로드**: 드래그 앤 드롭
- **AI 매핑**: Mapping Intelligence (패턴 기억)
- **데이터 관리**: 조회/수정/삭제
- **날짜별 데이터 관리**: 기본 7일 보관

### 3. 배송담당자 모드

#### 3.1 인증: QR 코드 스캔
- 카메라로 QR 코드 스캔
- QR에 포함된 JWT 토큰으로 인증
- 본인 이름 확인 (2차 인증)

#### 3.2 앱 기능
- **오늘 배송 리스트**: 자신에게 할당된 배송 목록

- **배송 상태 관리**: 배송 준비중 → 배송 출발 → 배송 완료
- **배송완료 시**:
  1. "배송완료" 버튼 클릭
  2. **사진 촬영** (카메라 실행)
  3. 사진 + 완료 메시지 → **SMS 앱 열기** (고객에게 발송)

### 4. SMS 발송 (배송완료 시)

**플로우**
```
배송완료 버튼 → 카메라 실행 → 사진 촬영 → SMS 앱 열기
                                          (번호 + 내용 자동 채움)
```

> ⚠️ iOS/Android SMS에 이미지 직접 첨부 불가 (Linking API 한계)
> → 사진은 클라우드 업로드 후 URL 포함 방식 또는 MMS 별도 검토

### 5. 데이터 보관 정책

| 구독 유형 | 배송 데이터 보관 | 가격 |
|----------|----------------|------|
| 무료 | 7일 | - |
| 유료 (Basic) | 30일 | TBD |
| 유료 (Pro) | 90일 | TBD |

**사진 보관 정책**
- 배송완료 사진은 **구독과 관계없이 7일 후 자동 삭제**
- Cron Trigger로 매일 00:00에 정리

- 보관 기간 초과 데이터는 자동 삭제 (Cron Trigger)

## 기술 스택

### 모바일 앱 (Expo SDK 54)

| 구분 | 기술 |
|------|------|
| Framework | Expo SDK 54 |
| Language | TypeScript (strict) |
| Navigation | Expo Router 4.x |
| Animation | Reanimated 4.x + CSS animations |
| State | Zustand |
| Camera | expo-camera |
| SMS | react-native Linking API |

**주요 패키지**
```json
{
  "expo": "~54.0.0",
  "expo-router": "~4.0.0",
  "expo-camera": "~16.0.0",
  "expo-image-picker": "~16.0.0",
  "expo-secure-store": "~14.0.0",
  "expo-updates": "~0.27.0",
  "react-native-reanimated": "~4.0.0",

  "zustand": "^5.0.0"
}
```

### PC 웹 (Workers Assets)

| 구분 | 기술 |
|------|------|
| Framework | React 18 + Vite |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| State | Zustand |
| Excel 파싱 | SheetJS (xlsx) |

### Backend (Cloudflare Workers)

| 구분 | 기술 |
|------|------|
| Framework | Hono 4.x |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 (사진) |
| Cache | Cloudflare KV |
| Email | Resend API |
| AI | Cloudflare AI Gateway + BYOK |
| Cron | Cloudflare Cron Triggers |

> 📁 데이터베이스 스키마: [database-schema.md](./database-schema.md)

## 폴더 구조

```
project-root/
├── app/                          # 모바일 앱 (Expo SDK 54)
│   ├── package.json
│   ├── app.json
│   ├── eas.json
│   ├── tsconfig.json
│   ├── app/                      # Expo Router
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # 역할 선택 화면
│   │   ├── (admin)/              # 관리자 모드
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx         # Magic Link 로그인
│   │   │   ├── index.tsx         # 날짜별 카드뷰
│   │   │   ├── qr-generate.tsx   # 배송담당자 QR 생성
│   │   │   └── settings.tsx
│   │   └── (staff)/              # 배송담당자 모드
│   │       ├── _layout.tsx
│   │       ├── scan.tsx          # QR 스캔
│   │       ├── verify.tsx        # 본인 인증
│   │       ├── index.tsx         # 배송 리스트
│   │       ├── [orderId].tsx     # 배송 상세
│   │       └── complete.tsx      # 사진 촬영 + SMS
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── services/
│   │   └── types/
│   │       └── index.ts
│   └── assets/
│
└── workers/                      # Backend + PC 웹
    ├── package.json
    ├── wrangler.toml
    ├── schema.sql
    ├── src/
    │   ├── index.ts
    │   ├── routes/
    │   │   ├── auth.ts           # Magic Link + QR 인증
    │   │   ├── upload.ts         # 엑셀 업로드 + AI 매핑
    │   │   ├── delivery.ts       # 배송 CRUD
    │   │   └── subscription.ts   # 구독 관리
    │   ├── lib/
    │   │   ├── ai.ts
    │   │   └── storage.ts        # R2 사진 저장
    │   └── cron/
    │       └── cleanup.ts        # 만료 데이터 삭제
    └── web/                      # PC 웹 (관리자 전용)
        ├── package.json
        ├── vite.config.ts
        ├── src/
        │   ├── pages/
        │   │   ├── Login.tsx
        │   │   ├── Dashboard.tsx
        │   │   ├── Upload.tsx
        │   │   └── Mapping.tsx
        │   └── components/
        └── dist/
```

> 📁 UI 설계: [ui-spec.md](./ui-spec.md)
> 📁 코드 예시: [code-examples.md](./code-examples.md)

## API 설계

### 인증

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/magic-link/send` | Magic Link 발송 |
| POST | `/api/auth/magic-link/verify` | Magic Link 검증 |
| POST | `/api/auth/qr/generate` | QR 토큰 생성 (관리자) |
| POST | `/api/auth/qr/verify` | QR 토큰 검증 (배송담당자) |
| POST | `/api/auth/staff/verify` | 배송담당자 이름 확인 |

### 엑셀 업로드 (PC 웹 전용)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/upload/parse` | 엑셀 파싱 |
| POST | `/api/upload/mapping/suggest` | AI 매핑 추천 |
| POST | `/api/upload/save` | 매핑 확정 + DB 저장 |

### 배송 데이터

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/delivery/list` | 배송 목록 (날짜별) |
| GET | `/api/delivery/staff-list` | 배송담당자 목록 (QR 생성용) |
| GET | `/api/delivery/staff/:name` | 배송담당자별 목록 |
| PUT | `/api/delivery/:id/status` | 상태 변경 |
| POST | `/api/delivery/:id/complete` | 완료 + 사진 업로드 |

### 구독

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/subscription/status` | 구독 상태 조회 |
| POST | `/api/subscription/upgrade` | 유료 구독 |

## EAS 빌드 설정

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

## 앱스토어 심사 가이드라인

### ✅ Apple App Store

| 항목 | 상태 | 설명 |
|------|------|------|
| 4.2 최소 기능 | ✅ | 카메라, SMS 연동 등 네이티브 기능 |
| 3.1.1 인앱 결제 | ⚠️ | 구독 기능 시 Apple IAP 필수 |
| 5.1 개인정보 | ✅ | 카메라 권한 설명, 개인정보 처리방침 |

### ✅ Google Play Store

| 항목 | 상태 | 설명 |
|------|------|------|
| SMS 권한 | ✅ | Linking API 사용 (직접 발송 아님) |
| 카메라 권한 | ✅ | 배송 사진 촬영 용도 명시 |
| 결제 | ✅ | Google Play Billing 사용 |

## 개발 우선순위

### Phase 1: 핵심 기능 (2주)
1. 앱 역할 선택 화면
2. 관리자 Magic Link 인증
3. 배송담당자 QR 스캔 + 본인 인증
4. 배송 리스트 + 상태 관리
5. PC 웹 엑셀 업로드 + AI 매핑

### Phase 2: 배송완료 플로우 (1주)
1. 사진 촬영 기능
2. R2 사진 업로드
3. SMS 발송 연동

### Phase 3: 관리자 기능 (1주)
1. 관리자 앱 카드뷰
2. PC 웹 링크 안내
3. 데이터 보관 정책 (7일)

### Phase 4: 구독 및 고도화 (1주)
1. 유료 구독 시스템
2. Cron 기반 데이터 정리

4. EAS 빌드 및 배포

## 관련 문서

- [📁 데이터베이스 스키마](./database-schema.md)
- [📁 UI 스펙](./ui-spec.md)
- [📁 코드 예시](./code-examples.md)

---
*문서 버전: 3.0*  
*작성일: 2025-12-31*  
*구조: 단일 앱 (관리자/배송담당자 역할 분리)*
