# Delivery Management Backend - Hono Version

Google Sheets 기반 배달 관리 시스템의 Cloudflare Workers용 Hono 백엔드입니다.

## 특징

- **Hono Framework**: 경량, 고성능 웹 프레임워크
- **Cloudflare Workers**: 엣지에서 실행되는 서버리스 환경  
- **Google Sheets Integration**: 구글 시트를 데이터베이스로 사용
- **SOLAPI Integration**: 카카오톡 메시지 발송
- **QR Code Authentication**: 배송 담당자 인증
- **TypeScript**: 완전한 타입 안전성

## 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp src/.env.example .env
# .env 파일을 편집하여 실제 값들을 입력
```

### 3. 로컬 개발 서버 실행
```bash
npm run local  # Node.js 서버 (포트 5001)
```

### 4. Wrangler 개발 서버 (권장)
```bash
npm run dev    # Cloudflare Workers 환경과 동일
```

## Cloudflare Workers 배포

### 1. Wrangler CLI 로그인
```bash
npx wrangler auth login
```

### 2. KV 네임스페이스 생성
```bash
# Production
npx wrangler kv:namespace create "SESSIONS"

# Preview (개발용)
npx wrangler kv:namespace create "SESSIONS" --preview
```

### 3. wrangler.toml 설정 업데이트
KV 네임스페이스 ID를 wrangler.toml 파일에 추가:
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

### 4. 환경변수 설정 (Cloudflare Dashboard)
Cloudflare 대시보드에서 다음 환경변수들을 설정:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URL`
- `SOLAPI_CLIENT_ID`
- `SOLAPI_CLIENT_SECRET`
- `SOLAPI_REDIRECT_URL`
- `FRONTEND_URL`

### 5. 배포
```bash
npm run deploy
```

## API 엔드포인트

### 인증
- `GET /api/auth/google` - Google OAuth 로그인
- `GET /api/auth/google/callback` - Google OAuth 콜백
- `GET /api/auth/status` - 인증 상태 확인
- `POST /api/auth/logout` - 로그아웃

### Google Sheets
- `GET /api/sheets/list` - 스프레드시트 목록
- `POST /api/sheets/connect` - 스프레드시트 연결
- `GET /api/sheets/date/:date` - 날짜별 주문 조회
- `GET /api/sheets/date/:date/by-staff` - 담당자별 주문 조회
- `PUT /api/sheets/data/:date/status` - 배송 상태 업데이트

### 배달 관리
- `GET /api/delivery/qr/:staffName` - QR 코드 생성
- `POST /api/delivery/qr/verify` - QR 코드 검증

### SOLAPI
- `GET /api/solapi/auth/login` - SOLAPI OAuth 로그인
- `GET /api/solapi/auth/callback` - SOLAPI OAuth 콜백
- `GET /api/solapi/auth/status` - SOLAPI 인증 상태
- `POST /api/solapi/message/send` - 카카오톡 메시지 발송

## 인증 방식

클라이언트는 다음 방법 중 하나로 세션 ID를 전달해야 합니다:
- HTTP 헤더: `X-Session-ID: your-session-id`
- 쿼리 파라미터: `?sessionId=your-session-id`

## 프론트엔드 연동

기존 Express 백엔드와 호환되도록 설계되었습니다. API 엔드포인트와 응답 형식이 동일합니다.

프론트엔드에서 API 베이스 URL만 변경하면 됩니다:
```typescript
// 기존: http://localhost:5001
// 새로운: https://your-worker.your-subdomain.workers.dev
const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev';
```

## 주요 차이점 (Express vs Hono)

1. **세션 저장소**: Express Session → Cloudflare KV
2. **환경변수**: .env 파일 → Cloudflare Dashboard
3. **로깅**: Winston → console.log (Cloudflare Logs)
4. **미들웨어**: Express → Hono 미들웨어
5. **배포**: PM2/Docker → Cloudflare Workers

## 개발 명령어

- `npm run dev` - Wrangler 개발 서버
- `npm run local` - Node.js 로컬 서버  
- `npm run build` - TypeScript 빌드
- `npm run typecheck` - 타입 체크
- `npm run deploy` - Cloudflare Workers 배포