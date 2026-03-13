# App Intents 구현 가이드 (iOS 16+)

> App Intents 프레임워크는 구 SiriKit Intents Extension과 완전히 다른 아키텍처이다.
> 혼동하면 "단축어가 앱과 통신할 수 없습니다" 에러가 발생한다.

---

## 핵심 규칙

**App Intents는 메인 앱 타겟에 포함되어야 한다. 별도 Extension 타겟이 아니다.**

---

## App Intents vs SiriKit Intents (구 방식) 비교

| | App Intents (iOS 16+) | SiriKit Intents Extension (구 방식) |
|---|---|---|
| import | `import AppIntents` | `import Intents` |
| 프로토콜 | `AppIntent` | `INIntent` |
| 실행 위치 | **메인 앱 프로세스** (백그라운드) | **별도 Extension 프로세스** |
| 타겟 | **메인 앱 타겟에 포함** | Extension 타겟 필요 |
| 발견 방식 | 시스템이 메인 앱 바이너리 스캔 | Extension Info.plist |
| Extension 필요? | **불필요** | 필수 |
| 단축어 등록 | `AppShortcutsProvider` | Intent Definition File |

---

## 실행 흐름

```
단축어 실행
  → iOS가 메인 앱을 백그라운드로 launch
  → 메인 앱 바이너리 안의 AppIntent.perform() 실행
  → 결과 반환
  → 앱이 다시 suspend
```

별도 Extension 프로세스가 생성되지 않는다.

---

## Expo Config Plugin에서 주의사항

### 올바른 구현

```
UploadScreenshotIntent.swift → 메인 앱 타겟 Sources에 추가 (필수)
  - UploadImageIntent: 이미지 업로드 (Free: 압축, Plus: 원본)
  - UploadTextIntent: 텍스트 업로드 (Plus 전용)
  - ShotLinqShortcuts: AppShortcutsProvider (Upload Image, Upload Text)
  - ShotLinqResponseHandler: 공유 응답 파싱
  - ShotLinqError: 에러 정의 (HTTP 코드/응답 본문 포함)
SharedTokenManager.swift     → 메인 앱 타겟 Sources에 추가 (필수)
ShotLinqTokenBridge.swift    → 메인 앱 타겟 Sources에 추가 (RN ↔ Swift 브릿지)
```

Xcode project에 소스 파일 추가 시:
```javascript
// config plugin에서 메인 타겟에 추가
xcodeProject.addSourceFile(
  `${projectName}/UploadScreenshotIntent.swift`,
  { target: mainTarget.uuid },  // 메인 앱 타겟
  mainGroup
);
```

### 잘못된 구현 (에러 발생)

```
UploadScreenshotIntent.swift → Extension 타겟에만 추가
                              → 메인 앱 타겟에 없음
```

이렇게 하면 iOS가 메인 앱을 깨워서 Intent를 찾으려 하지만, 메인 앱 바이너리에 코드가 없으므로:
> "단축어가 앱과 통신할 수 없기 때문에 동작을 실행할 수 없습니다."

### Swift 컴파일 주의사항

- `parameterSummary`에서 `\(\.$param)`과 `\(.applicationName)`을 동시에 사용하면 타입 추론 실패
- String 타입 파라미터는 `Summary` interpolation에서 키패스 추론이 안 될 수 있음 → 고정 문자열 사용

---

## Extension 타겟이 필요한 경우

App Intents를 사용할 때 별도 Extension 타겟이 필요한 경우는 거의 없다.
다만, 아래 상황에서는 Extension을 고려할 수 있다:

- **위젯에서 Intent 사용**: WidgetKit Extension
- **Live Activity**: ActivityKit Extension
- **백그라운드 실행 최적화**: 앱 전체를 깨우지 않고 경량 Extension에서 처리하고 싶을 때

일반적인 단축어 연동에는 **메인 앱 타겟만으로 충분**하다.

---

## 단축어 업데이트 정책

- iCloud 단축어 링크는 공유 시점의 스냅샷 → 자동 업데이트 불가
- **핵심 원칙**: 로직은 App Intent에 구현, 단축어는 얇은 래퍼로 유지
  - 앱 업데이트만으로 동작 변경 가능 (단축어 재설치 불필요)
- 단축어 구조 변경 시: 앱 내 "새 단축어 설치" 안내 + 이전 단축어 삭제 유도
- 향후 고려: App Intent에서 서버 최소 버전 체크 → 오래된 단축어에 업데이트 안내 메시지 반환

**iCloud 단축어 링크:**
- 스크린샷 (Free + Plus): `https://www.icloud.com/shortcuts/2953f3d4d3eb417f94a9764ab7435acc`
- 텍스트 (Plus only): `https://www.icloud.com/shortcuts/13cf1c716f77449d9d4497c3690476ed`

---

## 현재 App Intent 목록

| Intent | 설명 | Tier |
|--------|------|------|
| `UploadImageIntent` | 이미지 업로드 (Free: 압축, Plus: 원본) | Free + Plus |
| `UploadTextIntent` | 텍스트 업로드 | Plus 전용 |

---

## 체크리스트

- [x] `import AppIntents` 사용 (NOT `import Intents`)
- [x] Intent struct가 **메인 앱 타겟**의 Sources에 포함됨
- [x] `AppShortcutsProvider` 구현하여 시스템에 등록
- [x] 앱을 최소 1회 실행하여 시스템에 Intent 등록
- [x] 별도 Extension 타겟 없음 (메인 앱 타겟에만 포함)
- [x] Config Plugin 작성 시 `addSourceFile`의 target이 메인 앱 타겟인지 확인
- [x] tier 기반 분기 (Free: 압축, Plus: 원본/텍스트)
- [x] 토큰 만료 시 자동 갱신 (SharedTokenManager.refreshAccessToken)
- [x] 에러 메시지에 HTTP 상태 코드 + 응답 본문 포함 (디버깅용)
