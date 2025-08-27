# Cloudflare Workers + Pages 배포 가이드

이 문서는 배달 관리 시스템을 Cloudflare Workers (백엔드) + Cloudflare Pages (프론트엔드)로 배포하는 방법을 설명합니다.

**중요**: 하나의 저장소에서 백엔드와 프론트엔드를 별도로 배포하는 방법을 다룹니다.

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

#### **중요: Runtime Variables vs Build-time Variables**

**Runtime Variables** (코드 실행 시 사용 - 여기에 설정):
- 코드에서 `c.env.VARIABLE_NAME`으로 접근하는 모든 변수
- API 키, 시크릿, 데이터베이스 연결 정보 등
- 보안이 중요한 정보는 반드시 **"Encrypt"** 옵션 선택

**Build-time Variables** (빌드 시에만 사용):
- 빌드 설정, 환경 플래그 등
- `process.env.VARIABLE_NAME`으로 접근 (빌드 시 치환됨)

#### **필수 Runtime Variables 설정:**
다음 변수들을 **Runtime Variables** 섹션에 추가:

- `GOOGLE_CLIENT_ID`: Google OAuth2 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 클라이언트 시크릿 (**Encrypt 체크**)
- `GOOGLE_REDIRECT_URL`: `https://deliver-mgmt-backend.coreanq.workers.dev/api/auth/google/callback`
- `SOLAPI_CLIENT_ID`: SOLAPI 클라이언트 ID
- `SOLAPI_CLIENT_SECRET`: SOLAPI 클라이언트 시크릿 (**Encrypt 체크**)
- `SOLAPI_REDIRECT_URL`: `https://deliver-mgmt-backend.coreanq.workers.dev/api/solapi/auth/callback`
- `FRONTEND_URL`: `https://deliver-mgmt.pages.dev`
- `JWT_SECRET`: JWT 토큰 생성용 시크릿 키 (**Encrypt 체크**)
- `QR_SECRET_KEY`: QR 코드 보안용 시크릿 키 (**Encrypt 체크**)

#### **주의사항:**
- **변수명**은 코드와 정확히 일치해야 함
- **시크릿 정보**는 반드시 "Encrypt" 옵션 선택
- 설정 후 반드시 **"Save"** 버튼 클릭
- 변경 사항은 즉시 적용됨 (재배포 불필요)

### 2.5 Workers 배포
```bash
cd backend-hono
npx wrangler login  # 로그인 (처음 한 번만)
npm run deploy
```

**참고**: 배포 후 대시보드에서 설정한 환경 변수는 유지됩니다.

## 3. 프론트엔드 배포 (Cloudflare Pages)

### 3.1 GitHub 연동 (프론트엔드용)
1. Cloudflare Dashboard → Workers & Pages → Create → Pages 탭 → "Connect to Git"
2. GitHub 리포지토리 선택
3. **프로젝트명**: `deliver-mgmt-frontend` (구분을 위해)
4. 프로젝트 설정:
   - **프레임워크 프리셋**: Vue
   - **빌드 명령어**: `npm run build:frontend`
   - **빌드 출력 디렉토리**: `frontend/dist`
   - **루트 디렉토리**: `/` (프로젝트 루트)

### 3.2 환경 변수 설정
Pages 설정에서 환경 변수 추가:
- `VITE_API_BASE_URL`: `https://deliver-mgmt-backend.coreanq.workers.dev`

### 3.3 배포
Pages는 GitHub 푸시 시 자동으로 배포됩니다.
## 4. 도메인 설정 업데이트

### 4.1 프론트엔드 API URL 설정
배포된 Workers 도메인으로 `frontend/src/config/api.ts` 파일의 기본값을 수정:
```typescript
// Default production API URL (Cloudflare Workers)
return 'https://deliver-mgmt-backend.coreanq.workers.dev';
```

### 4.2 CORS 설정 업데이트
`backend-hono/src/index.ts`에서 실제 Pages 도메인으로 수정:
```typescript
// Add your actual Cloudflare Pages domain here
'https://deliver-mgmt.pages.dev',
```

## 5. Google OAuth2 설정 업데이트

Google Cloud Console에서 OAuth2 설정 업데이트:
1. **Authorized JavaScript origins**: `https://deliver-mgmt.pages.dev`
2. **Authorized redirect URIs**: `https://deliver-mgmt-backend.coreanq.workers.dev/api/auth/google/callback`

## 6. SOLAPI OAuth2 설정 업데이트

SOLAPI 콘솔에서 리다이렉트 URL 업데이트:
- **리다이렉트 URL**: `https://deliver-mgmt-backend.coreanq.workers.dev/api/solapi/auth/callback`

## 7. 테스트

1. **헬스체크**: `https://deliver-mgmt-backend.coreanq.workers.dev/health`
2. **프론트엔드 접속**: `https://deliver-mgmt.pages.dev`
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