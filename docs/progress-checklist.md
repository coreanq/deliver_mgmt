# 배송 관리 시스템 - 진척도 체크리스트

> 마지막 업데이트: 2025-01-06

## 진척률 요약

| 구분 | 완료 | 전체 | 진척률 |
|------|------|------|--------|
| Phase 1: 핵심 기능 | 5 | 5 | 100% |
| Phase 2: 배송완료 플로우 | 3 | 3 | 100% |
| Phase 3: 관리자 기능 | 3 | 3 | 100% |
| Phase 4: 구독 시스템 | 8 | 24 | 33% |
| **전체** | **19** | **35** | **54%** |

> **Note**: RevenueCat SDK가 바이너리에 포함됨. 나머지 기능은 OTA로 활성화 예정

---

## Phase 1: 핵심 기능

### 프로젝트 초기화
- [x] Expo SDK 54 프로젝트 생성 (app/)
- [x] Cloudflare Workers 프로젝트 생성 (workers/)
- [x] PC 웹 프로젝트 생성 (workers/web/)
- [x] D1 데이터베이스 스키마 정의

### 앱 역할 선택
- [x] 역할 선택 화면 (관리자/배송담당자)
- [x] Reanimated 4.x 애니메이션 적용
- [x] 다크 모드 지원

### 관리자 인증 (Magic Link)
- [x] 이메일 입력 폼 UI
- [x] Magic Link 발송 API
- [x] Magic Link 검증 API
- [x] 테스트 이메일 바이패스 (dev@test.com, dev@example.com)
- [ ] 실제 Resend API 연동 테스트

### 배송담당자 인증 (QR 코드)
- [x] QR 스캔 화면 (expo-camera)
- [x] QR 토큰 검증 API
- [x] 본인 인증 화면 (이름 확인)
- [x] JWT 토큰 기반 세션 관리

### PC 웹 엑셀 업로드
- [x] 드래그 앤 드롭 업로드 UI
- [x] SheetJS 엑셀 파싱
- [x] AI 매핑 추천 API
- [x] 매핑 확정 + DB 저장

---

## Phase 2: 배송완료 플로우

### 배송 상태 관리
- [x] 배송 리스트 화면 (배송담당자)
- [x] 상태 변경 기능 (pending → in_transit → completed)
- [x] 배송 상태별 배지 UI

### 배송 완료 처리
- [x] 카메라 촬영 화면
- [x] 사진 미리보기 + 재촬영
- [x] R2 사진 업로드 API

### SMS 발송
- [x] SMS 앱 열기 (Linking API)
- [x] 완료 메시지 자동 채움

---

## Phase 3: 관리자 기능

### 관리자 앱 기능
- [x] 날짜별 배송정보 카드뷰
- [x] 배송담당자 QR 생성
- [x] Workers Assets로 PC 웹 통합 서빙

### PC 웹 기능
- [x] 로그인 페이지
- [x] 대시보드 (배송 목록)
- [x] 엑셀 업로드 페이지
- [x] AI 매핑 페이지

### 데이터 보관 정책
- [x] Cron Trigger 설정 (매일 00:00)
- [x] 만료 데이터 삭제 로직
- [x] API 응답 camelCase 변환

---

## Phase 4: 구독 및 고도화

### 유료 구독 시스템 (RevenueCat)
- [x] 구독 상태 조회 API (서버)
- [x] 플랜 설정 (free/basic/pro)
- [x] 보관일수 관리 로직

#### RevenueCat SDK 통합 (바이너리)
- [x] react-native-purchases 패키지 설치
- [x] app.config.js 플러그인 추가
- [x] RevenueCat 서비스 기본 구조 (비활성화 상태)
- [x] 구독 Store 생성 (subscription.ts)

#### RevenueCat 대시보드 설정
- [ ] RevenueCat 프로젝트 생성
- [ ] Apple App Store Connect 인앱 구매 상품 등록
- [ ] Google Play Console 인앱 상품 등록
- [ ] RevenueCat에 스토어 연동 (App Store/Play Store)
- [ ] Entitlements 및 Offerings 설정

#### RevenueCat 앱 연동 (OTA)
- [ ] API 키 발급 및 적용 (iOS/Android)
- [ ] 구독 Paywall UI 구현
- [ ] 구매 플로우 연동
- [ ] 구독 복원 기능
- [ ] Feature flag 활성화

#### 서버 연동
- [ ] RevenueCat Webhook 설정
- [ ] 서버 구독 상태 동기화 API
- [ ] 구독 만료 처리 로직

### EAS 빌드 및 배포
- [x] eas.json 설정
- [ ] development 빌드 테스트
- [ ] preview 빌드 테스트
- [ ] production 빌드 및 스토어 배포

---

## OTA 활성화 변수

> RevenueCat 구독 기능을 OTA로 활성화할 때 변경해야 하는 변수들

### 📁 `app/src/services/revenuecat.ts`

| 변수 | 현재 값 | 활성화 시 |
|------|---------|----------|
| `FEATURE_ENABLED` | `false` | `true` |
| `REVENUECAT_API_KEY_IOS` | `'appl_YOUR_IOS_API_KEY'` | RevenueCat에서 발급받은 실제 iOS API 키 |
| `REVENUECAT_API_KEY_ANDROID` | `'goog_YOUR_ANDROID_API_KEY'` | RevenueCat에서 발급받은 실제 Android API 키 |

### 활성화 순서

1. RevenueCat 대시보드에서 프로젝트 생성
2. App Store Connect / Google Play Console에서 인앱 상품 등록
3. RevenueCat에 스토어 연동 완료
4. API 키 발급 후 위 변수에 적용
5. `FEATURE_ENABLED = true` 변경
6. Paywall UI 구현
7. EAS Update로 OTA 배포

---

## 구현 필요 항목 (Mockup/TODO)

> 아래 항목들은 기본 구조만 구현되었으며 실제 테스트 및 완성이 필요합니다.

1. **Resend API 실제 연동 테스트** - Magic Link 이메일 발송
2. **R2 버킷 생성 및 테스트** - 배송 완료 사진 저장
3. **Cloudflare D1 마이그레이션 실행** - `npm run db:migrate`
4. **환경 변수 설정** - `wrangler secret put JWT_SECRET` 등
5. **RevenueCat 연동** - 대시보드 설정 후 OTA 활성화

---

## 기술 부채

- [ ] API 에러 핸들링 통일
- [ ] 로딩 상태 개선 (스켈레톤 UI)
- [ ] 오프라인 지원 (캐싱)
- [ ] 푸시 알림 연동

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-31 | 초기 체크리스트 생성 |
| 2025-12-31 | Workers Assets 통합, camelCase 변환, PC 웹 빌드 완료 |
| 2025-01-06 | RevenueCat 구독 시스템 기본 구조 추가 (SDK 설치, Store 생성) |
