## 기본 컨벤션
- TypeScript strict, ESM, 함수형 스타일
- 타입: `src/types/index.ts`
- Frontend: `app/`, Backend: `workers/`
- Expo SDK54, Reanimated 4.x (New Architecture)
- Cloudflare Workers (wrangler 4+), AI Gateway BYOK (`cf-aig-auth`)
- Domain: try-dabble.com

## 코드 수정 룰
- OCP: 기존 코드 수정 최소화, 확장으로 해결
- ISP: 작은 인터페이스 선호
- 수정한 코드의 주석도 함께 변경
- 같은 기능 UI는 공용 컴포넌트 사용
- 로그: 앱에서 POST로 원격 로깅 (wrangler tail용)

## 진척도 추적
- 새 대화 시작 시 [진척도 체크리스트](./docs/progress-checklist.md) 확인
- 기능 완료 시 체크리스트 업데이트 (`[ ]` → `[x]`), 진행중 `[/]`
- PRD 수정 시 체크리스트 동기화 필수
- Test/mockup 구현은 실제 구현 필요로 리스트업

## 참고 문서
- [PRD](./docs/prd.md)
- [UI 스펙](./docs/ui-spec.md)
- [셋업 레퍼런스](./docs/setup-reference.md) — EAS, Magic Link, 폴더 구조, 버전 관리, URL 등
