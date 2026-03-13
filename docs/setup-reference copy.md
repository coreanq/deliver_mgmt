# 셋업 레퍼런스

> 초기 셋업 및 구현 완료 스펙 참고용. 항시 참고할 룰은 [CLAUDE.md](../CLAUDE.md) 참조.

---

## Magic Link 구현

- Resend API 사용 (RESEND_API_KEY)
- 테스트용 이메일: `dev@test.com`, `dev@example.com` (worker 환경변수) — 링크 클릭 없이 바로 접속
- 매직링크 저장: Cloudflare KV (15분 TTL)
- 매직링크 재전송 제한: 1분

## EAS 설정

- Remote version incremental
- 버전 관리는 한곳에서 관리
- Simulator build 사용 안함
- OTA를 위해 반드시 `expo-updates` 포함

### 암호화 수출 규정 (ITSAppUsesNonExemptEncryption)

```javascript
ios: {
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
  },
},
```

- `false`: HTTPS만 사용하는 일반 앱 (표준/면제 암호화)
- `true`: 자체 암호화 알고리즘 사용 시 (미국 수출 규정 대상)

설정하지 않으면 EAS 빌드 시 인터랙티브 프롬프트가 뜨고, App Store 제출 시 매번 질문에 답해야 함.

```json
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
    "distribution": "store",
    "autoIncrement": true,
    "channel": "production"
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": ""
      }
    }
  }
}
```

**distribution 옵션:**
- `internal`: Ad-hoc 배포 (Preview, 기기 UDID 등록 필요)
- `store`: App Store/TestFlight 배포 (Transporter 업로드용)

## 폴더 구조

```
├── app/                      # Frontend (Expo SDK 54)
│   ├── package.json
│   ├── app.json
│   ├── eas.json
│   ├── babel.config.js
│   ├── tsconfig.json
│   ├── app/                  # Expo Router 라우트
│   │   ├── _layout.tsx
│   ├── src/                  # 재사용 코드
│   └── assets/
│
└── workers/                  # Backend (Cloudflare Workers)
    ├── package.json
    ├── wrangler.toml
    └── src/
```

## 버전 관리 가이드

앱과 서버의 빌드 버전을 관리하고 표시하는 방법

### 버전 표시 형식

```
App v1.0.0 (26/01/01 01:00)  ← Expo OTA 업데이트 시점 반영
Server 26/01/01 00:38         ← Worker 배포 시점
```

### Worker 빌드 날짜 (wrangler.toml)

Worker 배포 시 빌드 날짜를 자동으로 기록

**wrangler.toml 설정:**

```toml
# 빌드 시 BUILD_DATE 자동 업데이트 + 웹 빌드 (macOS/Linux 호환)
[build]
command = "if [ \"$(uname)\" = 'Darwin' ]; then sed -i '' \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; else sed -i \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; fi && cd web && npm install && npm run build"

[vars]
BUILD_DATE = "25/01/01 00:00"  # placeholder (sed가 교체함)
```

> **참고**: macOS(BSD sed)는 `-i ''`, Linux(GNU sed)는 `-i`를 사용하므로 `uname`으로 OS 판별

**Worker에서 BUILD_DATE 반환:**

```typescript
// /api/health 엔드포인트
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    buildDate: c.env.BUILD_DATE,
  });
});
```

### app.config.js 전체 구조

동적 설정을 위해 `app.json` 대신 `app.config.js` 사용

```javascript
const getBuildDate = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yy}/${mm}/${dd} ${hh}:${min}`;
};

export default {
  expo: {
    name: '앱이름',
    slug: 'app-slug',
    owner: 'expo-account-name',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'app-slug',  // 딥링크용 스킴
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.example.app',
      appleTeamId: 'XXXXXXXXXX',  // Apple Developer Team ID
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.example.app',
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/images/adaptive-icon.png',
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      ['expo-build-properties', { ios: { deploymentTarget: '16.0' } }],
      // 커스텀 플러그인
      './plugins/with-app-intent/withAppIntent',
    ],
    extra: {
      buildDate: getBuildDate(),
      apiUrl: 'https://api.example.com',
      eas: {
        projectId: 'eas-project-uuid',
        // App Extension 설정 (eas.json이 아님!)
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: 'ExtensionName',
                  bundleIdentifier: 'com.example.app.extension',
                  entitlements: {
                    'com.apple.security.application-groups': ['group.com.example.app'],
                  },
                },
              ],
            },
          },
        },
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/eas-project-uuid',
    },
  },
};
```

### 앱에서 버전 정보 읽기

```typescript
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// 앱 버전
const appVersion = Constants.expoConfig?.version ?? '1.0.0';

// 빌드/OTA 업데이트 날짜
const getUpdateDate = () => {
  // OTA 업데이트된 경우 업데이트 시점 표시
  if (!Updates.isEmbeddedLaunch && Updates.createdAt) {
    const d = new Date(Updates.createdAt);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${min}`;
  }
  // 네이티브 빌드인 경우 빌드 시점 표시
  return Constants.expoConfig?.extra?.buildDate ?? '';
};
```

### 서버 빌드 날짜 가져오기

```typescript
// /api/health 엔드포인트에서 서버 빌드 날짜 조회
const fetchServerBuildDate = async () => {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  const data = await res.json();
  return data.buildDate;  // Worker의 BUILD_DATE 환경변수
};
```

### VersionInfo 공용 컴포넌트 패턴

`src/components/VersionInfo.tsx`에 재사용 가능한 컴포넌트 생성:
- 앱 버전 + OTA 업데이트 날짜 표시
- 서버 빌드 날짜 표시 (API 호출)
- 모든 화면 하단에 동일하게 사용

### 주의사항

- `expo-constants`, `expo-updates` 패키지 필수 설치
- OTA 업데이트는 `runtimeVersion`이 동일한 빌드에만 적용
- 스플래시, 아이콘 등 네이티브 변경은 새 빌드 필요 (OTA 불가)

---

## URL / 링크

| 항목 | URL |
|------|-----|
| 개인정보 처리방침 | https://periwinkle-foam-a5a.notion.site/2e10f396f354808b85f6dcce7412a3c2 |
| 고객 지원 | https://periwinkle-foam-a5a.notion.site/2e10f396f35480c3a5a8c6e4bb1c27fc |

## 계정 삭제 기능 (Account Deletion)

- 계정 생성을 지원하는 앱은 앱 내에서 계정 삭제(탈퇴) 기능을 반드시 제공해야 합니다.

## 이미지 변환

- jpg → png 변환 시 ImageMagick 사용

## Cloudflare 상세

- Backend: Cloudflare Workers
- AI API 호출: Cloudflare AI Gateway Universal Endpoint + BYOK 방식 (`cf-aig-auth` 헤더 사용)
- wrangler 4 이상 사용

---

## iOS App Intent (Expo SDK 55+)

iOS 단축어와 연동하기 위한 App Intent 설정. **메인 앱 타겟에 직접 포함** (별도 Extension 없음).

### 폴더 구조

```
app/
├── plugins/
│   └── with-app-intent/
│       ├── withAppIntent.js       # Config Plugin
│       └── ios/
│           ├── SharedTokenManager.swift
│           ├── UploadScreenshotIntent.swift
│           ├── ShotLinqTokenBridge.swift
│           └── ShotLinqTokenBridge.m
```

### 주요 설정 포인트

**1. App Intent는 메인 앱 타겟에 포함**
- App Intents 프레임워크 (iOS 16+)는 별도 Extension 불필요
- Config Plugin이 Swift 파일을 메인 앱 타겟에 복사 및 추가

**2. 토큰 공유**
App Intent가 메인 앱 프로세스에서 실행되므로 `UserDefaults.standard`로 토큰에 직접 접근.
별도 Extension이 없어 App Groups는 불필요.

**3. Config Plugin 핵심 로직**
```javascript
// 모든 Swift 파일을 메인 앱 타겟에 복사
// SharedTokenManager, UploadScreenshotIntent, Bridge 파일
```

### 빌드 명령어

```bash
# ios 폴더 초기화 후 prebuild
rm -rf ios && npx expo prebuild --platform ios

# 로컬 빌드
eas build --platform ios --profile preview --local
```

### 트러블슈팅

| 에러 | 원인 | 해결 |
|------|------|------|
| `initializer for conditional binding must have Optional type` | `IntentFile.data`는 non-optional `Data` 타입 | `guard let imageData = image.data` → `let imageData = image.data` |
| `No architectures in the binary` (Transporter 409) | Preview(Ad-hoc) 빌드로 제출 시도 | production 프로필(`distribution: "store"`)로 빌드 |
| 단축어에서 "앱과 통신할 수 없습니다" | App Intent가 메인 앱 타겟에 없음 | Config Plugin이 메인 타겟에 Swift 파일 추가하는지 확인 |
