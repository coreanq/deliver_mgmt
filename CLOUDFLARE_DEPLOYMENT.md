# Cloudflare Workers + Pages 배포 가이드

이 문서는 배송 관리 시스템을 Cloudflare Workers (백엔드) + Cloudflare Pages (프론트엔드)로 배포하는 방법을 설명합니다.

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

Wrangler에서는 두 가지 방법으로 환경변수를 관리할 수 있습니다:

#### **방법 1: wrangler.toml + Cloudflare Dashboard (권장)**

**wrangler.toml에 설정** (공개 정보):
```toml
[vars]
NODE_ENV = "production"
GOOGLE_CLIENT_ID = "your-google-client-id"
GOOGLE_REDIRECT_URL = "https://deliver-mgmt-backend.coreanq.workers.dev/api/auth/google/callback"
FRONTEND_URL = "https://deliver-mgmt.pages.dev"
```

**Cloudflare Dashboard에 설정** (Secret 정보):
- Dashboard → Workers & Pages → [워커 이름] → Settings → Variables
- Secret 정보만 여기서 설정하고 **"Encrypt" 옵션 선택**

#### **방법 2: Cloudflare Dashboard 전용**

**주의**: wrangler.toml에 `[vars]` 섹션이 있으면 Dashboard 변수가 무시될 수 있습니다!

#### **Wrangler 환경변수 우선순위**

1. **wrangler.toml [vars] 섹션** (최우선)
2. **.env 파일** (로컬 개발용만)
3. **Cloudflare Dashboard Environment Variables** (최후순위)

#### **중요: Runtime Variables vs Build-time Variables**

**Runtime Variables** (코드 실행 시 사용):
- 코드에서 `c.env.VARIABLE_NAME`으로 접근하는 모든 변수
- API 키, 시크릿, 데이터베이스 연결 정보 등
- wrangler.toml [vars] 또는 Dashboard에서 설정

**Build-time Variables** (빌드 시에만 사용):
- 빌드 설정, 환경 플래그 등
- `process.env.VARIABLE_NAME`으로 접근 (빌드 시 치환됨)

#### **필수 Variables 설정 (권장 방법):**

**wrangler.toml [vars] 섹션** (공개 정보):
```toml
[vars]
NODE_ENV = "production"
GOOGLE_CLIENT_ID = "your-google-client-id"
GOOGLE_REDIRECT_URL = "https://deliver-mgmt-backend.coreanq.workers.dev/api/auth/google/callback"
SOLAPI_CLIENT_ID = "your-solapi-client-id"
SOLAPI_REDIRECT_URL = "https://deliver-mgmt-backend.coreanq.workers.dev/api/solapi/auth/callback"
FRONTEND_URL = "https://deliver-mgmt.pages.dev"
```

**Cloudflare Dashboard Runtime Variables** (Secret 정보만):
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 클라이언트 시크릿 (**Encrypt 체크**)
- `SOLAPI_CLIENT_SECRET`: SOLAPI 클라이언트 시크릿 (**Encrypt 체크**)
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

### 환경 변수 관리 (중요!)
- **wrangler.toml [vars]가 우선**: Dashboard 변수보다 우선 적용됨
- **배포시 변수 유지**: wrangler.toml 변수는 배포 후에도 유지됨
- **민감한 정보 보안**: Secret 정보는 반드시 Dashboard에서 "Encrypt" 옵션 선택
- **혼용 방식**: 공개 정보는 wrangler.toml, Secret은 Dashboard 권장

### 환경변수 트러블슈팅
- **변수가 undefined**: wrangler.toml [vars] 섹션 확인
- **배포 후 변수 리셋**: Dashboard와 wrangler.toml 우선순위 충돌
- **CORS 에러**: FRONTEND_URL 변수 확인 및 대소문자 정확히 일치
- **인증 실패**: Secret 변수들이 Dashboard에서 "Encrypt" 설정되었는지 확인

### 보안
- 모든 시크릿 키는 환경변수로 설정
- `.env` 파일은 절대 GitHub에 커밋하지 않음
- 프로덕션 도메인만 CORS에서 허용

## 9. 트러블슈팅

### CORS 에러
- Workers의 CORS 설정에 Pages 도메인이 포함되었는지 확인
- 개발자 도구에서 실제 요청 도메인 확인

### 환경변수 관련 에러
**증상**: `환경변수가 설정되지 않았습니다` 에러
- **원인**: wrangler.toml [vars] 섹션과 Dashboard 변수 충돌
- **해결**: wrangler.toml에 공개 변수 추가 또는 [vars] 섹션 제거
- **확인**: 배포 로그에서 "Your Worker has access to the following bindings" 확인

**증상**: 배포 후 환경변수가 사라짐
- **원인**: wrangler.toml [vars] 섹션이 Dashboard 변수를 덮어씀
- **해결**: wrangler.toml과 Dashboard 역할 분리 (공개/Secret)

### KV 스토리지 에러
- wrangler.toml의 KV 네임스페이스 ID 확인
- Cloudflare 대시보드에서 KV 네임스페이스 생성 상태 확인
- Wrangler 버전에 따른 명령어 차이 확인 (`kv namespace create` vs `kv:namespace create`)

### Google OAuth 에러
**증상**: "서버 내부 오류가 발생했습니다"
- **원인**: GOOGLE_CLIENT_ID 또는 GOOGLE_REDIRECT_URL 누락
- **해결**: wrangler.toml [vars] 섹션 또는 Dashboard에서 변수 확인
- Google Cloud Console의 redirect URI 설정과 GOOGLE_REDIRECT_URL 일치 확인

### 크로스 도메인 쿠키 에러
**증상**: 인증 후 "연결 안됨" 상태
- **원인**: SameSite 쿠키 정책으로 크로스 도메인 쿠키 차단
- **해결**: 백엔드에서 `sameSite: 'None'` 설정 확인

### 빌드 에러
- `npm run typecheck` 실행으로 타입 에러 확인
- `npm run lint` 실행으로 린트 에러 확인