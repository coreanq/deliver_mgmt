## 기본 

- TypeScript strict 모드
- ESM 모듈 사용
- 타입은 `src/types/index.ts`에 정의
- 함수형 프로그래밍 스타일 선호
- 에러는 throw로 처리, 상위에서 catch
- react Expo SDK54 버전에 우선 기준으로 package 구성
- react-native 사용 시  Reanimated 4.x (New Architecture) + CSS animations 사용
- Frontend는 app 폴더, Backend는 workers 폴더로 구성      
- Expo Go에서 admobd 보상형 광고 호출 시, 단순 팝업에서 확인하면 reward 받도록 처리:
- admob 테스트를 위해서 구글에서 제공한 테스트 광고 id 로 하다가, 진짜 id 로 변경을 eas OTA 로 가능한 구조 설계
- magic link 구현시 resend api 사용 (RESEND_API_KEY) 사용 
  - 테스트용 이메일 링크를 넣으면 바로 접속 될수 있도록 한다 2개 dev@test.com dev@example.com(worker 환경변수로)

# EAS 사용시 
- remote version incremental 
- 버전 관리는 한곳에서 하도록 함 
- simulator build 사용 안함 
- eas.json 아래 추가 
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
      "autoIncrement": true,
      "channel": "production"
    }
  }
- OTA 를 위해서 반드시  expo-updates가 포함.

# cloudflare
- backend cloudflare worker 사용
- AI api 호출 시 cloudflare ai gateway Universal Endpoint + BYOK 방식으로 수정 (cf-aig-auth 헤더 사용)
  - const host = "https://gateway.ai.cloudflare.com";
  - const endpoint = "/v1/37820b7e32b164918dd5bcb58e628ff1/[ai_gateway_way_name]/compat";
- wrangler 4 이상 사용

# 폴더 구조 
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

## Worker 빌드 날짜 자동 표시

Worker 배포 시 빌드 날짜를 자동으로 기록하고 앱에서 표시

### 1. wrangler.toml 설정

```toml
# 빌드 시 BUILD_DATE 자동 업데이트 + 웹 빌드 (macOS/Linux 호환)
[build]
command = "if [ \"$(uname)\" = 'Darwin' ]; then sed -i '' \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; else sed -i \"s/BUILD_DATE = \\\".*\\\"/BUILD_DATE = \\\"$(date '+%y\\/%m\\/%d %H:%M')\\\"/\" wrangler.toml; fi && cd web && npm install && npm run build"


[vars]
BUILD_DATE = "25/01/01 00:00"  # placeholder (sed가 교체함)
```

> **참고**: macOS(BSD sed)는 `-i ''`, Linux(GNU sed)는 `-i`를 사용하므로 `uname`으로 OS 판별

- GitHub push → Cloudflare 자동 배포 시에도 적용
- 로컬 `npm run deploy` 시에도 적용

# doamin
- try-dabble.com

# 이미지 변경
jpg -> png 변경시 ImageMgick 사용 


## 코드 추가/수정 시 룰

- 개방-폐쇄 원칙 (OCP: Open/Closed Principle)
목표: 소프트웨어 엔티티(클래스, 모듈, 함수 등)는 확장에 대해서는 개방되어야 하지만, 수정에 대해서는 폐쇄되어야 합니다. 즉, 새로운 기능을 추가할 때 기존 코드를 수정하지 않아야 합니다.
- 인터페이스 분리 원칙 (ISP: Interface Segregation Principle)
목표: 클라이언트는 자신이 사용하지 않는 메서드에 의존해서는 안 됩니다. 즉, 하나의 거대한 인터페이스보다는 여러 개의 작은 인터페이스가 낫습니다.
- 코드 수정 발생 시 코드 수정한 부분의 주석을 알맞게 변경한다.
- 같은 기능을 하는 Ui 의 경우 공용 component 를 사용한다. 


## 📊 진척도 추적 (필수 확인)

> **Claude는 새 대화 시작 시 반드시 아래 문서를 확인하세요.**

- **[진척도 체크리스트](./progress-checklist.md)** - 현재 개발 진행 상태
- 워크플로우: `/check-progress` 명령으로 상세 진척도 리포트 생성

### 작업 시 규칙
- 새 기능 구현 완료 시 체크리스트 업데이트 (`[ ]` → `[x]`)
- 진행 중인 작업은 `[/]`로 표시
- 진척률 테이블 갱신
- Test 나 mockup 구조로 된 구현 경우 실제 구현을 해야된다고 리스트업 

### ⚠️ PRD 수정 시 필수 동기화
> **prd.md가 수정되면 반드시 progress-checklist.md도 동기화해야 합니다.**

1. PRD에 **새 기능 추가** → 체크리스트에 해당 항목 추가
2. PRD에서 **기능 삭제** → 체크리스트에서 해당 항목 제거
3. PRD **기능 변경** → 체크리스트 항목 내용 수정
4. 동기화 후 진척률 테이블 재계산

---

## 참고 문서

- [PRD](./prd.md) - 전체 제품 요구사항
- [진척도 체크리스트](./progress-checklist.md) - 개발 진행 상태
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Claude API Docs](https://docs.anthropic.com/claude/reference/)
