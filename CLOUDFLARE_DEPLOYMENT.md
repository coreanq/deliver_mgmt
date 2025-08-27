# Cloudflare Workers + Pages 배포 가이드

이 문서는 배달 관리 시스템을 Cloudflare Workers (백엔드) + Cloudflare Pages (프론트엔드)로 배포하는 방법을 설명합니다.

## 1. 사전 요구사항

- Cloudflare 계정
- GitHub 계정
- 코드가 GitHub 리포지토리에 업로드됨
- Wrangler CLI 설치: `npm install -g wrangler`

## 2. 백엔드 배포 (Cloudflare Workers)

### 2.1 Wrangler 로그인
```bash
cd backend-hono
wrangler login
```

### 2.2 KV 네임스페이스 생성
```bash
# 프로덕션 네임스페이스 생성 (Wrangler 3.60.0 이상)
npx wrangler kv namespace create "SESSIONS"

# 프리뷰 네임스페이스 생성
npx wrangler kv namespace create "SESSIONS" --preview
```

### 2.3 wrangler.toml 업데이트
위 명령어 실행 후 반환된 ID로 `backend-hono/wrangler.toml` 파일의 다음 부분을 수정:
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "실제_KV_네임스페이스_ID"  # 위에서 얻은 ID로 교체
preview_id = "실제_프리뷰_ID"  # 위에서 얻은 preview ID로 교체
```

### 2.4 환경 변수 설정
Cloudflare Dashboard → Workers & Pages → [워커 이름] → Settings → Variables에서 환경 변수 설정:

**필수 환경 변수:**
- `GOOGLE_CLIENT_ID`: Google OAuth2 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 클라이언트 시크릿
- `GOOGLE_REDIRECT_URL`: `https://your-worker-name.your-subdomain.workers.dev/api/auth/google/callback`
- `SOLAPI_CLIENT_ID`: SOLAPI 클라이언트 ID
- `SOLAPI_CLIENT_SECRET`: SOLAPI 클라이언트 시크릿
- `SOLAPI_REDIRECT_URL`: `https://your-worker-name.your-subdomain.workers.dev/api/solapi/auth/callback`
- `FRONTEND_URL`: `https://your-pages-domain.pages.dev`
- `JWT_SECRET`: JWT 토큰 생성용 시크릿 키
- `QR_SECRET_KEY`: QR 코드 보안용 시크릿 키

### 2.5 Workers 배포
```bash
cd backend-hono
npx wrangler login  # 로그인 (처음 한 번만)
npm run deploy
```

**참고**: 배포 후 대시보드에서 설정한 환경 변수는 유지됩니다.

## 3. 프론트엔드 배포 (Cloudflare Pages)

### 3.1 GitHub 연동
1. Cloudflare Dashboard → Workers & Pages → Create → Pages 탭 → "Connect to Git"
2. GitHub 리포지토리 선택
3. 프로젝트 설정:
   - **프레임워크 프리셋**: Vue
   - **빌드 명령어**: `cd frontend && npm run build`
   - **빌드 출력 디렉토리**: `frontend/dist`
   - **루트 디렉토리**: `/` (프로젝트 루트)

### 3.2 환경 변수 설정
Pages 설정에서 환경 변수 추가:
- `VITE_API_BASE_URL`: `https://your-worker-name.your-subdomain.workers.dev`

### 3.3 배포
Pages는 GitHub 푸시 시 자동으로 배포됩니다.

## 4. 도메인 설정 업데이트

### 4.1 프론트엔드 API URL 설정
배포된 Workers 도메인으로 `frontend/src/config/api.ts` 파일의 기본값을 수정:
```typescript
// Default production API URL (Cloudflare Workers)
return 'https://your-actual-worker-domain.workers.dev';
```

### 4.2 CORS 설정 업데이트
`backend-hono/src/index.ts`에서 실제 Pages 도메인으로 수정:
```typescript
// Add your actual Cloudflare Pages domain here
'https://your-actual-pages-domain.pages.dev',
```

## 5. Google OAuth2 설정 업데이트

Google Cloud Console에서 OAuth2 설정 업데이트:
1. **Authorized JavaScript origins**: `https://your-pages-domain.pages.dev`
2. **Authorized redirect URIs**: `https://your-worker-domain.workers.dev/api/auth/google/callback`

## 6. SOLAPI OAuth2 설정 업데이트

SOLAPI 콘솔에서 리다이렉트 URL 업데이트:
- **리다이렉트 URL**: `https://your-worker-domain.workers.dev/api/solapi/auth/callback`

## 7. 테스트

1. **헬스체크**: `https://your-worker-domain.workers.dev/health`
2. **프론트엔드 접속**: `https://your-pages-domain.pages.dev`
3. **Google 로그인** 테스트
4. **QR 코드 생성/인증** 테스트

## 8. 주의사항

### Wrangler 버전 호환성
- **Wrangler 3.60.0 이상**: `kv namespace create` 명령어 사용
- **Wrangler 3.60.0 미만**: `kv:namespace create` 명령어 사용

### 개발 vs 프로덕션
- **개발환경**: `npm run dev` (localhost:5173, localhost:5001)
- **프로덕션**: Cloudflare Pages + Workers

### 환경별 설정
- 코드는 자동으로 개발/프로덕션 환경을 감지
- 프로덕션에서는 `VITE_API_BASE_URL` 환경변수 사용
- 개발에서는 localhost 자동 사용

### 환경 변수 관리
- 대시보드에서 설정한 환경 변수는 배포 시 자동으로 유지됨
- 민감한 정보는 반드시 Secret으로 설정 (대시보드에서 "Encrypt" 옵션 선택)
- wrangler.toml의 [vars] 섹션은 민감하지 않은 정보만 사용

### 보안
- 모든 시크릿 키는 환경변수로 설정
- `.env` 파일은 절대 GitHub에 커밋하지 않음
- 프로덕션 도메인만 CORS에서 허용

## 9. 트러블슈팅

### CORS 에러
- Workers의 CORS 설정에 Pages 도메인이 포함되었는지 확인
- 개발자 도구에서 실제 요청 도메인 확인

### KV 스토리지 에러
- wrangler.toml의 KV 네임스페이스 ID 확인
- Cloudflare 대시보드에서 KV 네임스페이스 생성 상태 확인
- Wrangler 버전에 따른 명령어 차이 확인 (`kv namespace create` vs `kv:namespace create`)

### Google OAuth 에러
- Google Cloud Console의 redirect URI 설정 확인
- Workers의 환경변수 설정 확인

### 빌드 에러
- `npm run typecheck` 실행으로 타입 에러 확인
- `npm run lint` 실행으로 린트 에러 확인