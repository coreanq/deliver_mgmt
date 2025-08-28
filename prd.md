# 구글 스프레드시트 기반 배송 관리 시스템 (MVP) - Product Requirements Document

## 개요 
구글 스프레드시트에 저장된 주문 정보를 관리자가 직접 관리하고, 배송담당자는 QR 코드와 본인 인증을 통해 자신의 배송 목록에 접근할 수 있는 간소화된 MVP 시스템입니다. 배송 완료시에만 고객에게 카카오톡 메시지를 자동 발송합니다.

**✅ MVP 상태**: 핵심 기능이 구현되고 테스트 완료되었습니다. (2025-08-28 현재)

## 제품 목표 (MVP)
- ✅ 구글 스프레드시트를 메인 데이터 저장소로 활용 (구현 완료)
- ✅ QR 코드 + 이름 확인을 통한 간단한 배송담당자 인증 (구현 완료)
- ✅ 배송 완료시에만 고객 알림으로 스팸 메시지 방지 (구현 완료)
- ✅ Hono.js + Vue.js + Cloudflare Workers 기반의 확장 가능한 웹 애플리케이션 (구현 완료)

## 핵심 기능 요구사항 (MVP)

### 1. ✅ 구글 스프레드시트 연동 관리 UI (구현 완료)
- **✅ 스프레드시트 연결 인터페이스**:
  - AdminView.vue에서 "구글 스프레드시트 연결하기" 버튼 구현
  - Google OAuth2 인증을 통한 사용자 친화적 연동 완료
  - 첫 번째 사용 가능한 스프레드시트 자동 선택 기능
- **✅ 연동 상태 확인**:
  - 현재 연결된 스프레드시트 정보 실시간 표시
  - 연결 상태 및 스프레드시트 개수 표시 
  - 로그아웃 기능 및 상태 자동 업데이트 구현

### 2. ✅ 구글 스프레드시트 직접 관리 (날짜별 시트) (구현 완료)
- **✅ 스프레드시트 구조**: 
  - 날짜별로 개별 스프레드시트 생성 (YYYYMMDD 형식) - 구현 완료
  - 스프레드시트명 = 날짜 (예: "20250825", "20250826", "20250827")
  - 각 스프레드시트 내에서 첫 번째 시트 사용
- **✅ 시트 내 데이터 구조**: 동적 헤더 시스템으로 유연한 컬럼 구조 지원
- **✅ 배송 상태 값**: 5단계 시스템 구현 완료
  - "주문 완료" (초기값)
  - "상품 준비중" 
  - "배송 준비중"
  - "배송 출발"
  - "배송 완료"
- **✅ 관리자 작업**: 
  - 캘린더 기반 날짜 선택 및 데이터 조회 시스템 구현
  - 배송담당자별 데이터 그룹화 및 표시 기능 구현
  - 동적 헤더 시스템으로 컬럼명 유연하게 대응 완료
- **✅ 실시간 동기화**: Google Sheets API 연동 및 상태 업데이트 구현 완료

### 3. ✅ 배송담당자 웹사이트 (날짜별 접근 + 본인 인증) (구현 완료)
- **✅ QR 코드 접근**: 
  - 배송담당자별 고유 QR코드 (JWT 토큰 기반) 구현 완료
  - QR 코드 형식: `/delivery/auth?token=JWT_TOKEN` (DeliveryAuthView)
  - 24시간 만료 JWT 토큰으로 보안 강화
- **✅ 본인 인증 절차**:
  - DeliveryAuthView.vue에서 QR 스캔 및 본인 인증 구현
  - "본인 이름을 입력하세요" 화면 구현 완료
  - 입력한 이름과 토큰 정보 일치 검증 로직 구현
- **✅ 배송 목록 조회**: 
  - StaffMobileView.vue에서 모바일 최적화된 인터페이스 구현
  - 인증 완료 후 해당 날짜의 배송담당자 주문 목록 표시
  - Pull-to-refresh 기능 포함한 실시간 데이터 동기화
  - 동적 헤더 시스템으로 다양한 데이터 구조 지원
- **✅ 배송 상태 업데이트**: 5단계 진행형 시스템 구현 완료
  - 배송 준비중/배송 출발 상태에서만 버튼 활성화
  - 한 단계씩 진행하는 Progressive Flow 구현
  - 상태 변경이 즉시 스프레드시트에 반영

### 4. ✅ QR 코드 시스템 (JWT 기반 + 본인 인증) (구현 완료)
- **✅ JWT 기반 QR 생성**: 
  - delivery.ts에서 배송담당자별 JWT 토큰 기반 QR코드 생성 구현
  - QR코드 내용: `/delivery/auth?token=JWT_TOKEN`
  - SVG 형태 QR 코드 생성 및 Base64 데이터 URL 제공
- **✅ 2단계 인증 시스템**:
  1. **✅ 1단계**: QR코드 스캔으로 초기 접근 (JWT 토큰 검증)
  2. **✅ 2단계**: 본인 이름 입력으로 최종 인증
- **✅ 이름 확인 프로세스**:
  - DeliveryAuthView.vue에서 "본인 이름을 입력하세요" 입력 필드 구현
  - 입력값과 JWT 토큰의 staffName 정확히 일치 검증 로직
  - 한국어 이름 2-4자 패턴 검증 (`/^[가-힣]{2,4}$/`)
- **✅ 접근 제어 로직**:
  - 이름 불일치 시: "이름이 일치하지 않습니다. 다시 확인해주세요." 메시지
  - 토큰 만료 시: 자동 재인증 요구
- **✅ 보안 토큰**: 
  - JWT 토큰 with SHA256 해시로 URL 위변조 방지 구현 완료
  - 24시간 만료 정책으로 보안 강화
  - Cross-Device Support: 모바일에서 별도 인증 없이 QR 접근 지원

### 5. ✅ SOLAPI OAuth2 연동 관리 UI (구현 완료)
- **✅ SOLAPI OAuth2 인증 인터페이스**:
  - AdminView.vue에서 "SOLAPI로 로그인" 버튼 구현
  - solapi.ts에서 OAuth2 리다이렉트 처리
  - 권한 승인 페이지에서 사용자가 직접 권한 허용
- **✅ OAuth2 권한 요청**:
  - 메시지 발송 권한 (message:write) 구현
  - HTTP API 방식으로 SOLAPI 연동 (SDK 미사용)
- **✅ 자동 연동 프로세스**:
  - OAuth2 승인 후 자동으로 Access Token 발급 구현
  - Cloudflare KV에 토큰 안전 저장
  - 계정 정보 및 잔액 정보 자동 표시
- **✅ 연동 상태 모니터링**:
  - SOLAPI 연결 상태 (연결됨/연결 끊김) 실시간 표시 구현
  - Access Token 자동 관리 및 갱신 로직
- **✅ 메시지 발송 시스템**:
  - 배송 완료 시에만 고객 알림 발송 구현
  - HTTP API 직접 호출 방식으로 메시지 발송

### 6. ✅ SOLAPI를 통한 카카오톡 메시지 발송 (배송 완료시만) (구현 완료)
- **✅ SOLAPI HTTP API 연동**: OAuth2 기반 직접 HTTP API 호출 (SDK 미사용) 완료
- **✅ 발송 시점**: 
  - **배송 완료 버튼 클릭시에만** 고객에게 메시지 발송 구현
  - 상품 준비중, 배송 준비중, 배송 출발 상태는 알림 발송하지 않음
- **✅ 메시지 템플릿**: 
  - 배송 완료 메시지 발송 기능 구현
  - 동적 고객 정보 치환 시스템
- **✅ 개인화 변수**: 
  - 고객명 등 기본 정보 활용
  - 동적 헤더 시스템으로 다양한 고객 정보 필드 지원
- **✅ 발송 결과 처리**: 
  - 성공/실패 처리 로직 구현
  - 사용자에게 발송 결과 피드백 제공
- **✅ 토큰 관리**: 
  - Access Token 자동 관리 및 Cloudflare KV 저장
  - OAuth2 재인증 플로우 지원

### 7. ✅ 데이터 관리 (스프레드시트 중심) (구현 완료)
- **✅ 메인 데이터 저장**: 모든 주문 데이터는 구글 스프레드시트에 저장 - 동적 헤더 시스템으로 유연한 구조
- **✅ 토큰 관리**: 
  - QR 토큰: JWT 기반 stateless 토큰 구현 완료
  - OAuth2 토큰: Cloudflare KV Storage 사용 (세션 관리)
  - Admin Session: httpOnly 쿠키 + KV 백엔드 저장
- **✅ 로그 관리**: 
  - 메시지 발송 로그: Cloudflare Workers 로그 시스템
  - 시스템 로그: console.log - Cloudflare Workers 환경
- **✅ 백업**: 구글 스프레드시트 자체가 클라우드 백업 (Google Drive)

## ✅ S/W 개발 환경 및 기술 스택 (구현 완료)

### ✅ 백엔드 (Hono + Cloudflare Workers) (구현 완료)
- **✅ 프레임워크**: Hono 4.9.4 (Cloudflare Workers 호환)
- **✅ 언어**: TypeScript 5.9.2
- **✅ 런타임**: Cloudflare Workers (Edge Runtime)
- **✅ 저장소**: Cloudflare KV (세션), Google Sheets (메인 데이터)
- **✅ 주요 라이브러리**: (실제 구현된 버전)
  ```json
  {
    "hono": "^4.9.4",
    "googleapis": "^158.0.0", 
    "qrcode": "^1.5.4",
    "jsonwebtoken": "^9.0.2",
    "@cloudflare/workers-types": "^4.20250826.0",
    "axios": "^1.11.0"
  }
  ```

### ✅ 프론트엔드 (Vue.js) (구현 완료)
- **✅ 프레임워크**: Vue 3.3.0 (Composition API)
- **✅ 빌드 툴**: Vite 4.4.0
- **✅ 상태 관리**: Pinia 2.1.0
- **✅ 라우팅**: Vue Router 4.2.0
- **✅ UI 프레임워크**: Vuetify 3.3.0 (Material Design)
- **✅ Node.js 요구사항**: >= 22.0.0
- **✅ 주요 라이브러리**: (실제 구현된 버전)
  ```json
  {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0", 
    "pinia": "^2.1.0",
    "axios": "^1.4.0",
    "vuetify": "^3.3.0",
    "qrcode-reader": "^1.0.4",
    "html5-qrcode": "^2.3.8"
  }
  ```
- **✅ PWA**: Vite PWA 플러그인 (vite-plugin-pwa)

### ✅ 개발 도구 및 환경 (구현 완료)
- **✅ 패키지 매니저**: npm 
- **✅ 코드 포매터**: Prettier
- **✅ 린터**: ESLint (@typescript-eslint, @vue/eslint-config-typescript)
- **✅ 버전 관리**: Git
- **✅ 배포**: 
  - 백엔드: Cloudflare Workers (Wrangler 4.33.0)
  - 프론트엔드: Cloudflare Pages (Static hosting) 
- **✅ 환경 변수 관리**: .env 파일 + Cloudflare Workers 환경변수
- **✅ 테스트**: Playwright E2E, Vitest (unit tests)

## 기술적 요구사항 (MVP)

### 1. 시스템 아키텍처 (Hono + Vue.js + Cloudflare)
- **백엔드**: Hono/Cloudflare Workers 기반 Edge API 서버
  - SOLAPI HTTP API 직접 연동 (SDK 미사용)
  - Google Sheets API 연동
  - OAuth2 인증 처리 (Google + SOLAPI)
  - RESTful API 제공
  - Cloudflare KV 기반 세션 관리
- **프론트엔드**: Vue.js 3 기반 SPA (Cloudflare Pages)
  - **AdminView**: 관리자 설정 및 날짜별 데이터 관리
  - **StaffMobileView**: 모바일 최적화된 배송 관리 인터페이스
  - **DeliveryAuthView**: QR 인증 플로우
  - Vue Router를 통한 SPA 라우팅
  - Pinia를 통한 상태 관리
- **데이터 저장**: 
  - **메인 데이터**: 구글 스프레드시트 (날짜별)
  - **세션 관리**: Cloudflare KV
  - **토큰 관리**: JWT (QR 인증), OAuth2 (API 접근)
- **API 구조**: 
  ```
  /api/auth                    - OAuth2 인증 관련
  /api/sheets/date/:date       - 날짜별 스프레드시트 관리
  /api/sheets/date/:date/by-staff - 담당자별 그룹화 데이터
  /api/solapi                  - SOLAPI 연동 및 메시지 발송
  /api/delivery/qr             - QR 토큰 생성 및 검증
  ```

### 2. 구글 스프레드시트 연동 (Hono Backend)
- **백엔드 Google Sheets 처리**:
  - Cloudflare Workers에서 Google Sheets API v4 사용
  - Google OAuth2 클라이언트 라이브러리 활용
  - 동적 헤더 시스템으로 유연한 데이터 구조 지원
  - 날짜별 스프레드시트 자동 탐지
- **API 엔드포인트**:
  ```
  GET  /api/auth/google           - Google OAuth2 시작
  GET  /api/auth/google/callback  - OAuth2 콜백 처리
  GET  /api/auth/status           - 인증 상태 확인
  GET  /api/sheets/spreadsheets   - 스프레드시트 목록 조회
  GET  /api/sheets/date/:date     - 날짜별 데이터 조회 (YYYYMMDD)
  GET  /api/sheets/date/:date/by-staff - 담당자별 그룹화 데이터
  PUT  /api/sheets/data/:date/status   - 배송 상태 업데이트
  ```
- **Vue.js 프론트엔드**:
  - 구글 로그인 버튼으로 OAuth2 시작
  - 스프레드시트 선택 드롭다운 컴포넌트
  - 실시간 동기화 상태 표시 컴포넌트
- **실시간 동기화**: 
  - 폴링 방식으로 시트 변경사항 감지
  - WebSocket 또는 Server-Sent Events 활용 가능

### 3. QR 코드 시스템 (Hono + Vue.js)
- **백엔드 QR 처리**:
  - Cloudflare Workers에서 qrcode 라이브러리 사용
  - JWT 토큰 기반 QR 코드 생성 및 검증
  - 날짜 + 배송담당자명 기반 고유 URL 생성
  - 24시간 만료 정책으로 보안 강화
- **API 엔드포인트**:
  ```
  POST /api/delivery/qr/generate   - 배송자별 QR 코드 생성
  GET  /api/delivery/qr/verify     - QR JWT 토큰 검증
  POST /api/delivery/auth          - 배송자 이름 확인 인증
  GET  /api/delivery/:date/:staff  - 날짜별 배송자 주문 목록
  PUT  /api/sheets/data/:date/status - 배송 상태 업데이트
  ```
- **Vue.js 프론트엔드**:
  - **관리자용**: QR 코드 생성 및 다운로드 컴포넌트

- **모바일 최적화**: 
  - Vue.js PWA 설정으로 모바일 앱처럼 사용
  - 터치 친화적인 UI 컴포넌트

### 4. SOLAPI OAuth2 연동 (Hono Backend)
- **백엔드 SOLAPI 처리**:
  - Cloudflare Workers에서 SOLAPI HTTP API 직접 호출 (SDK 미사용)
  - OAuth2 Authorization Code 처리
  - Access Token 및 Refresh Token을 Cloudflare KV에 저장
  - 메시지 발송 HTTP API 직접 호출
- **프론트엔드 Vue.js 연동**:
  - Vue.js에서 백엔드 API 호출
  - OAuth2 인증 플로우 처리
  - 실시간 연동 상태 표시
- **API 엔드포인트**:
  ```
  GET  /api/solapi/auth/login     - SOLAPI OAuth2 시작
  GET  /api/solapi/auth/callback  - OAuth2 콜백 처리  
  GET  /api/solapi/account        - 계정 정보 조회
  GET  /api/solapi/senders        - 발신번호 목록 조회
  POST /api/solapi/send           - 메시지 발송
  GET  /api/solapi/templates      - 템플릿 목록 조회
  ```
- **토큰 관리**:
  - Cloudflare KV에서 Access Token 안전하게 저장
  - 토큰 만료 시 자동 갱신 처리
  - 프론트엔드는 세션 기반 인증 상태만 확인

## 성능 요구사항 (MVP)
- **스프레드시트 동기화**: 30개 주문 기준 10초 이내 동기화
- **QR 코드 스캔**: 스캔 후 5초 이내 페이지 로딩
- **메시지 발송**: 배송 완료 버튼 클릭 후 3초 이내 고객에게 메시지 발송
- **동시 접속**: 최대 10명의 배송담당자 동시 접속

## 보안 요구사항
- **QR 코드 보안**: 시트명 기반 해시 토큰으로 무단 접근 방지
- **본인 인증**: 이름 확인을 통한 2단계 인증
- **OAuth2 토큰 보안**: SOLAPI 및 Google OAuth2 토큰 안전한 저장
- **개인정보 보호**: 고객 연락처 정보 적절한 처리
- **접근 제어**: 각 배송담당자는 자신의 시트만 접근 가능

## 시스템 흐름도 (MVP)

### 1. 관리자 워크플로우 (OAuth2 기반 설정)
1. **관리자 설정 페이지 접속** (AdminView)
2. **"구글 스프레드시트 연결하기" 버튼 클릭**
3. **Google 계정 OAuth 인증 진행**
4. **날짜별 스프레드시트 자동 탐지 및 연결**
5. **"SOLAPI로 로그인" 버튼 클릭**
6. **SOLAPI 로그인 페이지에서 사용자 인증**
7. **권한 승인 페이지에서 메시지 발송 권한 허용**
8. **OAuth2 연동 완료 후 발신번호 및 템플릿 자동 설정**
9. **날짜별 스프레드시트에 배송 정보 입력**: 배송지, 고객명, 연락처, 배송담당자
10. **달력에서 날짜 선택하여 해당일 주문 데이터 확인**
11. **배송담당자별로 QR코드 자동 생성 및 제공**

### 2. 배송담당자 워크플로우 (2단계 인증)
1. 자신의 QR 코드 스캔으로 웹사이트 접속 (`/delivery/:date/:staffName`)
2. **JWT 토큰 자동 검증** (24시간 만료, 위변조 방지)
3. **본인 이름 입력하여 인증** (staffName 파라미터와 일치 확인)
4. 인증 성공 후 해당 날짜의 자신 담당 배송 목록 확인 (StaffMobileView)
5. 각 주문별로 5단계 상태 변경: 주문완료 → 상품준비중 → 배송준비중 → 배송출발 → 배송완료
6. **배송 완료시에만** 고객에게 SOLAPI 카카오톡 알림 발송
7. 변경사항이 Google Sheets 배송상태 컬럼에 실시간 반영

## 사용자 경험 요구사항 (MVP)

### 1. 관리자 경험 (통합 설정 UI)
- **간편한 연동 과정**: "구글 스프레드시트 연결하기" 버튼으로 쉬운 시작
- **직관적인 OAuth**: Google 계정 로그인과 동일한 친숙한 인증 과정
- **스프레드시트 선택**: 드롭다운에서 기존 시트 선택하거나 새로 생성
- **SOLAPI OAuth2 연동**:
  - "SOLAPI로 로그인" 버튼으로 OAuth2 인증 시작
  - 권한 승인 페이지에서 사용자가 직접 권한 허용
  - 연동 완료 후 계정 정보 및 발신번호 자동 설정
  - Access Token 자동 관리 및 갱신
- **자동 설정**: 배송담당자명 입력하면 시트 구조 자동 생성
- **실시간 모니터링**: 
  - 구글 시트 연동 상태
  - SOLAPI 연결 상태 및 잔액 정보
  - 메시지 발송 성공률 통계
- **QR코드 관리**: 생성된 QR코드 다운로드 및 인쇄 기능

### 2. 배송담당자 경험 (본인 인증 + 다중 주문 관리)
- **간편한 QR 접근**: QR 스캔으로 웹사이트 접근
- **직관적인 본인 인증**: "본인 이름을 입력하세요" 간단한 확인 절차
- **명확한 피드백**: 이름 불일치 시 친절한 오류 메시지 표시
- **전체 목록 확인**: 인증 후 자신에게 할당된 모든 배송 주문을 한 화면에서 확인
- **주문별 상태 관리**: 각 주문마다 독립적인 배송 상태 버튼
- **주소 정보 표시**: 배송 주소를 명확하게 표시
- **완료시 알림**: 배송 완료 버튼 클릭 시에만 고객에게 알림 발송
- **진행률 표시**: 전체 주문 중 완료된 주문 비율 표시

### 3. 알림 메시지 품질 (배송 완료시만)
- **단일 메시지**: 배송 완료시에만 발송하는 간단한 완료 알림
- **필수 정보**: 고객명, 배송 완료 확인 문구
- **정중한 톤**: "맛있게 드세요" 등 친근한 마무리 인사

## MVP 개발 우선순위

### Phase 1 (필수 기능)
1. **관리자 설정 페이지**: 스프레드시트 연동 UI
2. **Google OAuth 인증**: 사용자 친화적 연동 과정
3. **SOLAPI OAuth2 연동 UI**: 로그인 기반 권한 승인 인터페이스
4. 구글 스프레드시트 다중 시트 읽기/쓰기 기능
5. 배송자별 QR 코드 생성 및 접근 제어
6. **본인 이름 확인 인증 시스템**
7. 시트별 주문 목록 표시 웹사이트
8. SOLAPI 알림톡 발송 (배송 완료 1개 템플릿)

### Phase 2 (부가 기능)
1. 스프레드시트 자동 생성 기능
2. SOLAPI OAuth2 토큰 자동 갱신
3. 템플릿 승인 상태 자동 알림
4. 배송 진행률 표시
5. 메시지 발송 실패 재시도
6. QR코드 일괄 다운로드 기능

### 제외 기능 (추후 확장)
- 지도 및 위치 서비스
- 길찾기 앱 연동
- 배송 준비중/출발 단계 고객 알림
- 예상 도착시간 계산
- 관리자 전용 웹사이트
- SMS 대체 발송
- 실시간 위치 추적
- 복잡한 대시보드 및 통계
- 고급 보안 기능

## 운영 요구사항 (MVP)
- **기본 모니터링**: 시스템 가동 상태 확인
- **구글 시트 백업**: 스프레드시트 자체가 마스터 데이터
- **간단한 장애 대응**: 기본적인 에러 로깅 및 알림
- **확장 계획**: MVP 검증 후 추가 기능 개발

---
*문서 버전: 9.0 (MVP 구현 완료 - Hono + Vue.js + Cloudflare)*
*최종 수정: 2025-08-28*
*구현 상태: ✅ 핵심 MVP 기능 구현 및 테스트 완료*

## 🎉 MVP 구현 완료 현황

### ✅ 완료된 핵심 기능
1. **Google Sheets 연동**: OAuth2 인증 및 동적 헤더 시스템
2. **QR 코드 인증 시스템**: JWT 토큰 + 2단계 본인 인증
3. **배송 상태 관리**: 5단계 Progressive Flow 시스템
4. **SOLAPI 메시지 발송**: 배송 완료 시 고객 알림 
5. **모바일 최적화**: Pull-to-refresh 포함 반응형 UI
6. **관리자 대시보드**: 캘린더 기반 데이터 관리
7. **Cloudflare 배포**: Workers + Pages 배포 환경

### 🚀 배포 환경
- **백엔드**: Cloudflare Workers (전세계 에지 네트워크)
- **프론트엔드**: Cloudflare Pages (정적 호스팅)
- **세션 관리**: Cloudflare KV Storage 
- **데이터베이스**: Google Sheets (클라우드 네이티브)

### 📱 지원 기능
- Cross-Device QR 인증
- 실시간 데이터 동기화  
- PWA 지원 (모바일 앱처럼 사용)
- 다크모드 및 반응형 디자인
- Pull-to-refresh 모바일 UX