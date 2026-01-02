# 버전 관리 가이드

앱과 서버의 빌드 버전을 관리하고 표시하는 방법

## 버전 표시 형식

```
App v1.0.0 (26/01/01 01:00)  ← Expo OTA 업데이트 시점 반영
Server 26/01/01 00:38         ← Worker 배포 시점
```

---

## 1. Worker 빌드 날짜 (wrangler.toml)

Worker 배포 시 빌드 날짜를 자동으로 기록

### wrangler.toml 설정

```toml
# 빌드 시 BUILD_DATE 자동 업데이트 + 웹 빌드 (macOS/Linux 호환)
[build]
command = "if [ \"$(uname)\" = 'Darwin' ]; then sed -i '' \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; else sed -i \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; fi && cd web && npm install && npm run build"

[vars]
BUILD_DATE = "25/01/01 00:00"  # placeholder (sed가 교체함)
```

> **참고**: macOS(BSD sed)는 `-i ''`, Linux(GNU sed)는 `-i`를 사용하므로 `uname`으로 OS 판별

### Worker에서 BUILD_DATE 반환

```typescript
// /api/health 엔드포인트
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    buildDate: c.env.BUILD_DATE,
  });
});
```

---

## 2. 앱 빌드 날짜 (app.config.js)

동적 설정을 위해 `app.json` 대신 `app.config.js` 사용

### app.config.js 기본 구조

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
    version: '1.0.0',
    scheme: 'app-slug',  // 딥링크용 스킴
    extra: {
      buildDate: getBuildDate(),  // 빌드 시점 자동 기록
      eas: {
        projectId: 'eas-project-id',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',  // version 기준으로 OTA 호환성 결정
    },
    updates: {
      url: 'https://u.expo.dev/eas-project-id',
    },
  },
};
```

---

## 3. 앱에서 버전 정보 읽기

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

---

## 4. 서버 빌드 날짜 가져오기

```typescript
// /api/health 엔드포인트에서 서버 빌드 날짜 조회
const fetchServerBuildDate = async () => {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  const data = await res.json();
  return data.buildDate;  // Worker의 BUILD_DATE 환경변수
};
```

---

## 5. VersionInfo 공용 컴포넌트 패턴

`src/components/VersionInfo.tsx`에 재사용 가능한 컴포넌트 생성:
- 앱 버전 + OTA 업데이트 날짜 표시
- 서버 빌드 날짜 표시 (API 호출)
- 모든 화면 하단에 동일하게 사용

---

## 주의사항

- `expo-constants`, `expo-updates` 패키지 필수 설치
- OTA 업데이트는 `runtimeVersion`이 동일한 빌드에만 적용
- 스플래시, 아이콘 등 네이티브 변경은 새 빌드 필요 (OTA 불가)
