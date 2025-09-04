# AGENTS.md

AI 에이전트(예: ChatGPT, Claude, MCP 도구)가 이 저장소에서 안정적으로 작업하기 위한 가이드입니다. 코드 변경 시 보안·안정·일관성을 최우선으로 하며, 문맥과 기존 설계를 존중하세요.

rules.md 파일도 참고하여 rule 로 정하세요

## 프로젝트 개요
- 목적: Google 스프레드시트를 메인 데이터 저장소로 사용하는 배송 관리 시스템(MVP)
- 프레임워크: 백엔드(Hono + Cloudflare Workers), 프론트엔드(Vue 3 + Vite + Vuetify)
- 인증: Google OAuth2(관리자), QR 토큰(배송담당자), SOLAPI OAuth2(메시지)
- 저장소: Cloudflare KV(세션/유저 데이터), Google Sheets(업무 데이터)

## 리포지토리 구조 요약
- `backend-hono/`: Hono 기반 Cloudflare Workers 백엔드
  - `src/index.ts`: 앱 부트스트랩, CORS/로깅/에러 핸들러, 라우팅 합류
  - `src/local.ts`: 로컬 개발 서버(Node, 포트 5001), KV 모킹
  - `src/types/index.ts`: 공용 타입(세션, OAuth 토큰, 자동화 규칙 등)
  - `src/middleware/auth.ts`: Google 인증 미들웨어(토큰 자동 갱신)
  - `src/routes/`: 주요 API 라우트
    - `auth.ts`: Google OAuth 플로우, 세션/상태/로그아웃
    - `sheets.ts`: 스프레드시트 목록/시트/데이터/상태 업데이트(+직접 SMS 연동)
    - `solapi.ts`: SOLAPI OAuth/잔액/가/격/발신번호/메시지 발송
    - `delivery.ts`: 배송담당자용 QR 코드 생성/검증/모바일 URL 발급
    - `automation.ts`: 자동화 규칙 CRUD 및(개발용) 웹훅 도구
  - `src/services/`: 서비스 계층
    - `googleAuth.ts`, `googleSheets.ts`: Google OAuth/Sheets 연동(만료 전 자동 갱신)
    - `solapiAuth.ts`: SOLAPI 토큰 갱신 및 만료 판단
    - `automationService.ts`: 메시지 치환/바이트 계산/SMS·카카오톡 발송 래퍼
    - `unifiedUserService.ts`: 사용자 통합 데이터(해시 키) + 세션 위임
  - `src/utils/secureTemplateEngine.ts`: 안전한 메시지 템플릿 치환 엔진
  - `src/utils/errorSanitizer.ts`: 민감정보 마스킹 로그/오류 유틸
- `frontend/`: Vue 3 앱(라우터, Pinia, Vuetify, PWA)
- 최상위 스크립트: 루트 `package.json`(동시 실행/빌드/테스트 스크립트)
- 참고 문서: `CLAUDE.md`, `tasks.md`, `prd.md`, `README_GoogleSheetWebhook.md`, `rules.md`

## 실행/빌드/배포(루트)
- 개발 동시 실행: `npm run dev`  # 백엔드(5001) + 프론트엔드(5173)
- 백엔드 단독: `cd backend-hono && npm run local` 또는 `npm run dev`
- 프론트엔드 단독: `cd frontend && npm run dev`
- 빌드: 
  - 전체: `npm run build:full`
  - 백엔드: `npm run backend:build`
  - 프론트엔드: `npm run frontend:build`
- 배포(백엔드): `npm run deploy:backend` (Wrangler)
- 테스트: `npm run test` / E2E: `npm run test:e2e`

환경 변수(주요)
- 백엔드(Hono): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `SOLAPI_CLIENT_ID`, `SOLAPI_CLIENT_SECRET`, `SOLAPI_REDIRECT_URL`, `FRONTEND_URL`, `EMAIL_HASH_SALT`, `JWT_SECRET`

## 핵심 아키텍처 개념
- UnifiedUserService(통합 저장)
  - 키: `unified_user:${sha256(email+salt)}`
  - 데이터: Google 토큰, SOLAPI 토큰, 자동화 규칙(최대 20), 메타데이터
  - 세션 위임: `session_user:${sessionId}` → 이메일 메타데이터만 저장(1일 TTL) → 실제 데이터는 통합 저장소에서 조회/저장(1년 TTL)
- 인증
  - 관리자: Google OAuth2(만료 5분 전 자동 갱신), httpOnly 쿠키 + `X-Session-ID` 지원
  - 배송담당자: JWT QR 토큰(24h), 관리자 세션 풀에서 Google 토큰 사용
  - 메시지: SOLAPI OAuth2(액세스 토큰 18h, 30분 전에 갱신)
- 스프레드시트 모델
  - 날짜 기반 스프레드시트(예: `20250825`) 또는 다중 스프레드시트 내 날짜 시트 검색
  - 동적 헤더(첫 행 헤더로 키 매핑), 담당자 컬럼 자동 탐지/그룹화
- 자동화
  - 상태 업데이트 이후 직접 SMS 연동(웹훅 의존 최소화)
  - 템플릿 변수 `#{컬럼명}` 안전 치환, 바이트 계산으로 SMS/LMS 자동 결정(90바이트 기준)

## 주요 API 맵(백엔드)
- `/api/auth/*`: Google OAuth2 로그인, 콜백, 상태, 로그아웃
- `/api/solapi/*`: SOLAPI 로그인, 상태, 잔액, 가격, 발신번호, 메시지 발송
- `/api/sheets/*`: 스프레드시트·시트·데이터 조회, 날짜별/담당자별 집계, 상태 업데이트(+SMS)
- `/api/delivery/*`: QR 코드 생성/검증, 배송담당자 모바일용 URL
- `/api/automation/*`: 자동화 규칙 CRUD, 디버그 도구

구체 구현은 다음 파일을 참조하세요:
- `backend-hono/src/routes/auth.ts`
- `backend-hono/src/routes/solapi.ts`
- `backend-hono/src/routes/sheets.ts`
- `backend-hono/src/routes/delivery.ts`
- `backend-hono/src/routes/automation.ts`

## 에이전트 작업 수칙(필수)
1) 보안
- OAuth 토큰/쿠키/Authorization 헤더는 절대 로그/응답에 노출 금지. `safeConsoleError`/`createSafeErrorResponse` 사용.
- QR 토큰(JWT)은 24시간 만료/서명 검증·해시 일치·담당자 매칭 필수.
- 로컬 스토리지에 세션 저장 금지. 세션/유저 데이터는 KV 저장만 허용.

2) 아키텍처 일관성
- Cloudflare Workers 호환(Hono) 코드를 유지. Node 전용 API/Express 사용 금지.
- 통합 저장소(해시 키) + 세션 위임 패턴을 고수. 이중 저장 금지.
- Google/SOLAPI 토큰 만료 시점을 실제 응답의 `expiry_date`/정책으로 판단하고 사전 갱신.

3) 변경 가이드
- 주변 스타일과 일치하는 최소 변경. 불필요한 리팩터링/파일 이동 금지.
- 타입 안전성 유지. `src/types/index.ts` 확장 시 범용성을 고려.
- 에러 응답은 한국어 메시지 + 개발 환경에서만 상세(`details`).

4) 테스트·검증
- 변경 후 최소 경로 테스트(해당 라우트/서비스) → 필요 시 E2E(Playwright MCP).
- 대용량 로그/응답 금지. 10KB 이상 출력 피하기.

## MCP(모델 컨텍스트 프로토콜) 권장 사용법
- 문서 검색: context7 MCP로 라이브러리 문서를 조회해 API·사용법 확인
  - 예: Hono/Cloudflare Workers/Google APIs/Vue 관련 훅/타입
- 브라우저/E입E: Playwright MCP 도구로 UI 흐름 확인 및 회귀 테스트 수행
- 계획 도구: `update_plan`을 사용해 멀티스텝 작업을 투명하게 공유(항상 한 단계만 in_progress)
- 쉘: 파일 검색은 `rg` 우선, 파일 읽기는 250줄 이하로 분할

예시 워크플로우
1) 변경 범위 파악 → 2) 관련 타입/서비스/라우트 연계 점검 → 3) 수정 → 4) 국소 테스트 → 5) E2E(선택) → 6) 문서 갱신

## 자주 하는 작업 레시피
- 로컬 구동: 루트에서 `npm run dev` → 백엔드 5001, 프론트 5173
- Google 로그인 플로우 확인: `/api/auth/google` → 콜백 → `/api/auth/status`
- SOLAPI 연결/검증: `/api/solapi/auth/login` → `/api/solapi/auth/status`
- 특정 날짜 주문 조회: `GET /api/sheets/date/:YYYYMMDD`
- 담당자별 그룹 조회: `GET /api/sheets/date/:date/by-staff`
- 배송 상태 업데이트(+SMS): `PUT /api/sheets/status ...`(sheets.ts 내 구현 참고)
- 자동화 규칙 생성: `POST /api/automation/rules`(템플릿 검증 포함)

## 코딩 체크리스트(요약)
- [보안] 민감정보 마스킹 로깅 사용 여부 확인(`errorSanitizer.ts`)
- [세션] KV 세션 위임 구조 준수 여부 확인(`unifiedUserService.ts`)
- [토큰] Google/SOLAPI 갱신 로직 및 만료 버퍼 적용 확인
- [시트] 동적 헤더 기반 접근(하드코딩 금지), 한국어 이름 패턴 활용
- [자동화] 템플릿 안전 치환, 바이트 계산으로 SMS/LMS 자동 선택
- [CORS] `src/index.ts`의 허용 오리진 정책에 영향 없는지 검토

## 알려진 제약/주의
- Cloudflare Workers 런타임 제약: Node 전용 API 사용 금지(파일시스템, net 소켓 등)
- QR 토큰만으로 시트 업데이트는 제한적이며, 관리자 토큰 풀을 사용하는 경로를 따를 것
- 대량 데이터 시 Google Apps Script 웹훅은 보조 수단일 뿐, 핵심은 직접 SMS 연동 경로

## 참조 문서(강력 추천)
- `CLAUDE.md`: 상세 아키텍처/흐름/테스트/마이그레이션 이력
- `rules.md`: 팀 코딩 규칙(한국어 응답, MCP 도구 사용, SOLID 등)
- `tasks.md`: 작업 현황 및 TODO 체크리스트
- `prd.md`: 제품 요구사항 문서(MVP 범위)
- `README_GoogleSheetWebhook.md`: Apps Script 웹훅 안내(보조 경로)

필요 시 이 문서를 업데이트해 에이전트 작업 품질을 지속적으로 개선하세요.

