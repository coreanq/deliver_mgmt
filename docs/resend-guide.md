# Resend 매직링크 구성 가이드

## 발신 설정
- **발신 주소**: `ShotLinq <noreply@try-dabble.com>`
- **Resend API Key**: `RESEND_API_KEY` (wrangler secret)

## 매직링크 플로우

```
1. 사용자가 이메일 입력 → POST /api/auth/magic-link
2. 서버가 토큰 생성 → 메일 발송
3. 사용자가 메일에서 링크 클릭
4. Worker GET 엔드포인트가 앱 딥링크로 리다이렉트
5. 앱에서 토큰으로 POST /api/auth/verify 호출 → 로그인 완료
```

## 링크 구성 (중요)

이메일 클라이언트는 `https://`만 클릭 가능하고, 커스텀 scheme(`shotlinq://`)은 링크로 인식하지 않음.

따라서 **Worker를 경유하는 리다이렉트 방식**을 사용해야 함:

```
메일 본문 링크 (클릭 가능)
  https://shotlinq-api.try-dabble.com/api/auth/verify?token=xxx
    ↓ Worker GET 핸들러에서 302 리다이렉트
  shotlinq://auth/verify?token=xxx
    ↓ 앱이 딥링크로 열림
  앱 verify 화면에서 POST /api/auth/verify 호출
```

### 안 되는 방식
- `shotlinq:///auth/verify?token=xxx` → 이메일 앱에서 링크로 인식 안 됨
- `https://shotlinq.com/auth/verify?token=xxx` → 유니버설링크 미설정 시 웹으로 열림

### wrangler.toml 설정
```toml
APP_URL = "https://shotlinq-api.try-dabble.com"  # 메일 링크용 (Worker 경유)
API_URL = "https://shotlinq-api.try-dabble.com"   # 앱 API 호출용
```

## 다국어 메일

앱에서 `POST /api/auth/magic-link` 호출 시 `locale` 필드를 함께 전송.

```json
{ "email": "user@example.com", "locale": "ko" }
```

- 지원 언어: `ko`, `en`, `ja` (미전송 시 `en` 기본)
- 메일 제목(`subject`)과 본문 모두 locale에 맞게 변환
- 번역 문자열: `workers/src/services/email.ts`의 `emailStrings` 객체에서 관리
- 앱 측: `login.tsx`에서 `useI18n()`의 `locale`을 `api.sendMagicLink(email, locale)`로 전달

## 앱 아이콘 삽입

메일 본문에 앱 아이콘을 표시하려면 공개 접근 가능한 URL이 필요함.

### 방법
1. R2 버킷에 아이콘 이미지 업로드 (예: `shotlinq-storage` 버킷의 `assets/icon.png`)
2. R2 커스텀 도메인 또는 Worker를 통해 공개 URL 확보
3. `getMagicLinkEmail()`의 HTML 템플릿에 `<img>` 태그 추가:

```html
<img src="https://{공개URL}/assets/icon.png"
     alt="ShotLinq" width="48" height="48"
     style="border-radius: 12px; margin-bottom: 16px;" />
```

### 주의사항
- 이메일 클라이언트는 외부 이미지를 기본 차단하는 경우가 있음 (Gmail은 프록시 경유 허용)
- 이미지 크기는 48~64px 권장, 너무 크면 스팸 필터에 걸릴 수 있음
- Base64 인라인 이미지는 대부분의 이메일 클라이언트에서 지원하지 않으므로 사용 금지
