# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 배달 관리 시스템 개발 가이드

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## 프로젝트 개요
구글 스프레드시트 기반 배달 관리 시스템 (MVP) - QR 코드와 본인 인증을 통한 배달 업무 관리 웹앱

## 기술 스택 및 아키텍처
- **백엔드**: Node.js v22 + Express.js + TypeScript
- **프론트엔드**: Vue.js 3 + Composition API + Vuetify 3 + TypeScript
- **빌드**: Vite (프론트엔드), TypeScript Compiler (백엔드)
- **데이터 저장**: Google Sheets API (배달담당자별 개별 시트)
- **인증**: OAuth2 (Google + SOLAPI), QR 코드 + 본인 이름 확인 (2단계 인증)
- **메시지 발송**: SOLAPI OAuth2 연동 (배달 완료시만)
- **개발 도구**: ESLint, Prettier, Winston 로깅

## 핵심 기능 구현
1. **OAuth 기반 스프레드시트 연동**: 
   - Google Drive API로 스프레드시트 목록 자동 조회
   - 복수 선택 가능한 연동 시스템
   - 검색/필터 기능 및 선택 기록 저장
   - 배달담당자별 시트 관리 (A:고객명, B:연락처, C:주소, D:배달상태)

2. **QR 코드 시스템**: 시트명 기반 QR 생성 + 본인 인증

3. **배달 상태 관리**: "대기" → "준비중" → "출발" → "완료"

4. **카카오톡 알림**: SOLAPI OAuth2 연동, 배달 완료시에만 자동 발송

## 프로젝트 구조
```
/                     - 루트 프로젝트
├── backend/          - Node.js/Express API 서버 (포트: 5000)
│   ├── src/
│   │   ├── routes/      - API 라우트 (auth, sheets, solapi, delivery, qr, admin)
│   │   ├── services/    - 비즈니스 로직
│   │   │   ├── GoogleSheetsService.ts   - 스프레드시트 CRUD 작업
│   │   │   ├── GoogleDriveService.ts    - 스프레드시트 목록/검색
│   │   │   ├── SolapiService.ts         - SOLAPI 메시지 발송
│   │   │   ├── FilterPreferencesService.ts - 검색 기록 관리
│   │   │   └── TokenService.ts          - JWT 토큰 관리
│   │   ├── middleware/  - 인증, 로깅, 에러 핸들링
│   │   ├── config/      - Google OAuth, SOLAPI 설정
│   │   └── types/       - TypeScript 타입 정의
│   └── .env            - 환경 변수 (SERVER_IP, 포트, OAuth 키)
├── frontend/         - Vue.js 3 SPA (포트: 3000)
│   ├── src/
│   │   ├── components/  - 재사용 가능한 컴포넌트
│   │   ├── views/       - 페이지 컴포넌트
│   │   │   ├── AdminDashboard.vue    - 스프레드시트 관리
│   │   │   └── DeliveryDashboard.vue - 배달담당자 인터페이스
│   │   ├── stores/      - Pinia 상태 관리
│   │   └── services/    - API 호출 서비스
│   └── .env            - 프론트엔드 환경 변수
└── package.json      - 루트 프로젝트 스크립트
```

## 개발 워크플로우

### 일반적인 개발 명령어
```bash
# 프로젝트 설정
npm install                    # 루트 종속성 설치
cd backend && npm install      # 백엔드 종속성 설치
cd frontend && npm install     # 프론트엔드 종속성 설치

# 개발 서버 실행
npm run dev                    # 백엔드(5000) + 프론트엔드(3000) 동시 실행
npm run dev:backend           # 백엔드만 실행 (nodemon)
npm run dev:frontend          # 프론트엔드만 실행 (Vite)

# 빌드 및 배포
npm run build                 # 전체 프로젝트 빌드
cd backend && npm run build   # 백엔드 TypeScript 컴파일
cd frontend && npm run build  # 프론트엔드 Vite 빌드
npm start                     # 프로덕션 서버 시작

# 코드 품질 검사
cd backend && npm run lint    # 백엔드 ESLint 검사
cd backend && npm run lint:fix # 백엔드 ESLint 자동 수정
cd frontend && npm run lint   # 프론트엔드 ESLint 검사
cd frontend && npm run type-check  # Vue TypeScript 타입 검사

# 테스트 실행
cd backend && npm test        # 백엔드 Jest 테스트
npm test                      # E2E Playwright 테스트
npm run test:ui              # Playwright UI 모드
npm run test:debug           # Playwright 디버그 모드
npm run test:report          # Playwright 테스트 리포트

# 네트워크 설정
npm run setup-ip              # 환경 변수 기반 IP 설정
npm run setup-network         # 네트워크 설정 (setup-ip와 동일)

# 배포 관련 (PM2 프로덕션 배포)
./deploy.sh production        # 프로덕션 배포 (자동화 스크립트)
./deploy.sh staging          # 스테이징 배포
./deploy.sh development      # 개발 환경 빌드
```

### 환경 변수 설정
**중요**: IP 하드코딩 대신 환경 변수 사용 필수

**backend/.env**:
```bash
# 네트워크 설정
SERVER_IP=localhost           # 이 값만 변경하면 모든 곳에 자동 적용
SERVER_PORT=5000
FRONTEND_PORT=3000

# OAuth 설정
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SOLAPI_CLIENT_ID=your_solapi_client_id
SOLAPI_CLIENT_SECRET=your_solapi_client_secret

# 보안
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
QR_SECRET_KEY=your-qr-secret
```

**frontend/.env**:
```bash
VITE_SERVER_IP=localhost       # backend SERVER_IP와 동일하게 설정
VITE_SERVER_PORT=5000
VITE_API_BASE_URL=http://${VITE_SERVER_IP}:${VITE_SERVER_PORT}
```

### 포트 구성 및 외부 접근
- **백엔드**: 포트 5000 (API 서버)
- **프론트엔드**: 포트 3000 (개발 서버)
- **외부 접근**: `10.13.116.82:3000` 등 외부 IP 접근을 위해 HOST=0.0.0.0으로 바인딩
- **CORS 설정**: 환경 변수 기반 동적 오리진 허용
- **Playwright 테스트**: 백엔드 5001 포트 (테스트 전용), 프론트엔드 3000 포트

### 주요 API 엔드포인트
```bash
# 인증 관련
GET  /api/auth/google          # Google OAuth 인증 URL 생성
GET  /api/auth/google/callback # Google OAuth 콜백
GET  /api/auth/status          # 인증 상태 확인
POST /api/auth/logout          # 로그아웃

# 관리자 기능
GET  /api/admin/auth-status        # OAuth 인증 상태
GET  /api/admin/google-auth-url    # Google 인증 URL
GET  /api/admin/spreadsheets       # 스프레드시트 목록 (검색/필터)
POST /api/admin/spreadsheets/bulk-connect  # 복수 스프레드시트 연결

# 스프레드시트 관리
GET  /api/sheets/data/:sheetName   # 특정 시트 데이터 조회
PUT  /api/sheets/data/:sheetName   # 시트 데이터 업데이트

# 배달 관리
GET  /api/delivery/orders/:staff   # 배달담당자별 주문 조회
PUT  /api/delivery/status          # 배달 상태 변경

# QR 코드
POST /api/qr/generate/:staffName   # QR 코드 생성
GET  /api/qr/verify/:token         # QR 토큰 검증

# SOLAPI
POST /api/solapi/send              # 메시지 발송
GET  /api/solapi/account           # 계정 정보
```

## 핵심 아키텍처 패턴

### 실시간 통신 시스템
- **WebSocket**: Socket.IO 기반 실시간 배달 상태 동기화
- **SyncService**: 다중 클라이언트 간 데이터 동기화 관리
- **이벤트 기반**: 배달 상태 변경 시 모든 연결된 클라이언트에게 실시간 알림

### PWA (Progressive Web App) 구현
- **에러 트래킹**: ErrorTracker 서비스로 클라이언트 에러 수집
- **성능 모니터링**: 앱 마운트 시간, 페이지 로드 시간 측정
- **오프라인 지원**: PWAService 통한 캐싱 및 백그라운드 동기화

### OAuth2 인증 플로우 (중요)
- **Google OAuth**: 리다이렉트 방식 사용 (팝업 방식 제거됨)
- **URL 파라미터 기반**: 임시 토큰을 URL 파라미터로 전달하여 COOP 정책 회피
- **세션 관리**: Express-session 기반 서버사이드 세션 관리
- **SOLAPI OAuth**: 전통적인 OAuth2 방식, 클라이언트 시크릿 필수

### 데이터 동기화 아키텍처
- **중앙집중식**: 모든 배달 상태는 Google Sheets를 Single Source of Truth로 사용
- **실시간 동기화**: WebSocket 통해 모든 클라이언트가 동일한 상태 유지
- **오류 복구**: SyncService가 동기화 실패 시 자동 재시도 및 충돌 해결

## 주요 서비스 클래스

### GoogleDriveService.ts
스프레드시트 목록 조회 및 검색 기능
```typescript
// 스프레드시트 목록 조회 (페이징, 검색, 필터 지원)
getSpreadsheetsList(tokens, options): Promise<{files, nextPageToken, totalCount}>

// 특정 스프레드시트 상세 정보
getSpreadsheetDetails(tokens, fileId): Promise<SpreadsheetInfo>
```

### GoogleSheetsService.ts
스프레드시트 데이터 CRUD 작업
```typescript
// 시트 데이터 조회 및 업데이트
getSheetData(sheetName): Promise<SheetData>
updateDeliveryStatus(sheetName, rowIndex, newStatus): Promise<void>
```

### FilterPreferencesService.ts
검색 기록 및 필터 설정 관리
```typescript
// 검색 기록 저장/조회
saveRecentSearch(query, resultCount): Promise<void>
getRecentSearches(limit): Promise<RecentSearch[]>

// 필터 설정 저장/조회
saveFilterPreference(preference): Promise<FilterPreference>
getFilterPreferences(): Promise<FilterPreference[]>
```

### SolapiService.ts
SOLAPI OAuth2 연동 및 메시지 발송
```typescript
// 메시지 발송 (배달 완료시에만)
sendMessage(to, message, from): Promise<SendResult>

// 계정 정보 조회
getAccountInfo(accessToken): Promise<AccountInfo>
```

### TokenService.ts
JWT 토큰 관리 (QR 코드 인증용)
```typescript
// QR 토큰 생성 및 검증
generateQRToken(staffName, sheetName): Promise<string>
verifyQRToken(token): Promise<{staffName, sheetName}>
```

### WebSocketManager.ts
실시간 통신 및 클라이언트 연결 관리
```typescript
// WebSocket 서버 초기화 및 이벤트 관리
initialize(httpServer): void
broadcastSyncEvent(event): void
getConnectedClients(): ClientInfo[]
```

### SyncService.ts
다중 클라이언트 간 데이터 동기화
```typescript
// 동기화 이벤트 발생 및 처리
emitSyncEvent(type, data): void
handleSyncConflict(conflictData): void
```

### DeliveryStatusService.ts
배달 상태 변경 로직 및 검증
```typescript
// 배달 상태 업데이트 및 유효성 검사
updateDeliveryStatus(params): Promise<UpdateResult>
validateStatusTransition(from, to): boolean
```

### LoggerService.ts
Winston 기반 구조화된 로깅
```typescript
// 시스템 로그 관리 (일별 로테이션)
info(message, meta): void
error(message, meta): void
audit(action, meta): void // 중요 작업 감사 로그
```

### SecurityService.ts
보안 관련 유틸리티
```typescript
// 입력값 검증 및 보안 처리
validateInput(data): boolean
sanitizeSheetName(name): string
```

## OAuth2 인증 플로우

### Google OAuth (리다이렉트 방식)
1. 사용자가 "구글 계정으로 인증" 클릭
2. 프론트엔드에서 `/api/admin/google-auth-url` 호출하여 인증 URL 취득
3. `window.location.href`로 Google 인증 페이지로 전체 페이지 리다이렉트 (팝업 없음)
4. Google 인증 완료 후 `/api/auth/google/callback`으로 코드 전달
5. 백엔드에서 임시 토큰 생성 후 `res.redirect()`로 프론트엔드로 리다이렉트
6. URL 파라미터로 `temp_token` 전달: `/admin?temp_token=xxx&auth_status=completed`
7. 프론트엔드에서 `handleUrlAuthParams()` 함수가 URL 파라미터 감지
8. 임시 토큰으로 `/api/auth/complete` 호출하여 세션 인증 완료
9. 자동으로 스프레드시트 목록 로딩

**중요**: 팝업 방식 제거로 COOP(Cross-Origin-Opener-Policy) 문제 해결

### SOLAPI OAuth (주의: 클라이언트 시크릿 필수)
- Google Sign-In 방식이 아닌 전통적인 OAuth2 사용
- 백엔드에서 클라이언트 시크릿 관리
- OAuth 콜백 URI는 Google Cloud Console에 등록 필요

## 개발 시 주의사항

### 1. 환경 변수 우선 사용
- IP 주소 하드코딩 금지
- SERVER_IP 환경 변수만 변경하면 모든 설정 자동 적용
- CORS, 리다이렉트 URI 등 동적 생성

### 2. TypeScript 에러 처리
- `|| undefined` 패턴으로 null 체크
- 예: `nextPageToken: response.data.nextPageToken || undefined`

### 3. 포트 관리
```bash
# 포트 사용 중일 때
lsof -ti:5000 | xargs kill -9    # 5000번 포트 프로세스 종료
lsof -ti:3000 | xargs kill -9    # 3000번 포트 프로세스 종료
```

### 4. OAuth 설정 확인
- Google Cloud Console에서 리다이렉트 URI 등록 확인
- SOLAPI 개발자 콘솔에서 OAuth 앱 설정 확인
- 환경 변수에 올바른 클라이언트 ID/시크릿 설정

### 5. 외부 접근 문제
- 브라우저 확장 프로그램 (애드블로커 등) 비활성화
- CORS 오류 시 환경 변수 및 허용 오리진 확인
- 방화벽 설정 확인

## 중요 파일 및 위치

### 핵심 인증 로직
- `backend/src/routes/auth.ts` - OAuth 콜백 및 인증 처리
- `frontend/src/stores/adminStore.ts` - Google 인증 상태 관리 및 URL 파라미터 처리
- `frontend/src/views/AdminDashboard.vue` - 인증 플로우 시작점

### 실시간 동기화 코어
- `backend/src/services/WebSocketManager.ts` - 실시간 통신 관리
- `backend/src/services/SyncService.ts` - 데이터 동기화 로직
- `frontend/src/stores/deliveryStore.ts` - 배달 상태 실시간 업데이트

### 환경 설정 및 보안
- `backend/.env` / `backend/.env.staging` - 백엔드 환경 변수
- `frontend/.env` / `frontend/.env.staging` - 프론트엔드 환경 변수
- `backend/src/middleware/errorHandler.ts` - 통합 에러 처리
- `backend/ecosystem.config.js` - PM2 프로덕션 배포 설정

## 최근 구현 내용

### OAuth 기반 스프레드시트 관리 시스템
- 수동 ID 입력 대신 OAuth 인증 후 자동 목록 표시
- 복수 선택 가능한 스프레드시트 연결
- 검색/필터 기능 및 검색 기록 저장
- 실시간 연결 상태 모니터링

### 팝업 없는 OAuth 인증 시스템 (2024년 최신 개선)
- **COOP 정책 문제 해결**: 팝업 방식 제거하고 전체 페이지 리다이렉트 방식 채택
- **seamless 인증**: 콜백 창 표시 없이 자연스럽게 메인 페이지로 복귀
- **URL 파라미터 토큰 전달**: localStorage 대신 URL 파라미터로 임시 토큰 전달
- **자동 스프레드시트 로딩**: 인증 완료 즉시 스프레드시트 목록 자동 조회

### 실시간 동기화 및 PWA 구현
- **WebSocket 기반 실시간 통신**: 배달 상태 변경 시 모든 클라이언트 동기화
- **에러 트래킹 및 성능 모니터링**: ErrorTracker로 클라이언트 상태 추적
- **PWA 지원**: 오프라인 기능 및 모바일 앱 같은 사용자 경험

### 동적 환경 설정 시스템
- 하드코딩된 IP 제거
- 환경 변수 기반 CORS 및 리다이렉트 URI 생성
- 개발/프로덕션 환경 통합 관리

### 외부 접근 지원
- HOST=0.0.0.0 바인딩으로 외부 IP 접근 가능
- 동적 CORS 오리진 설정
- 환경 변수 기반 IP 설정

## 아키텍처 및 데이터 플로우

### 배달 상태 워크플로우
```
1. 스프레드시트 연동 → 2. QR 코드 생성 → 3. 배달담당자 인증 → 4. 상태 업데이트 → 5. 메시지 발송
```

### 인증 레이어
- **관리자**: Google OAuth → 스프레드시트 접근 권한
- **배달담당자**: QR 코드 + 이름 확인 → 배달 상태 업데이트 권한
- **시스템**: SOLAPI OAuth → 메시지 발송 권한

### 데이터 구조
- **Google Sheets**: A열(고객명), B열(연락처), C열(주소), D열(배달상태)
- **상태값**: "대기" → "준비중" → "출발" → "완료"
- **QR 토큰**: JWT 기반, 시트명과 만료시간 포함

## 문제 해결 가이드

### 자주 발생하는 오류
1. **포트 충돌**: `lsof -ti:5000 | xargs kill -9`로 프로세스 종료
2. **CORS 오류**: 환경 변수 SERVER_IP 확인
3. **OAuth 404**: Google/SOLAPI 콘솔에서 리다이렉트 URI 등록
4. **TypeScript 오류**: null 체크 및 타입 가드 사용
5. **외부 접근 안됨**: 브라우저 확장 프로그램 비활성화

### 디버깅 팁
- Winston 로거로 상세 로그 확인
- `console.log`로 OAuth 토큰 상태 확인
- 브라우저 개발자 도구 네트워크 탭에서 API 호출 추적

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- backend 나 frotnend 는 직접 시작하겠다