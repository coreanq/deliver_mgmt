# 프로젝트 코딩 규칙 및 가이드라인

TypeScript 기반 반응형 웹 프로젝트 개발을 위한 종합적인 규칙과 가이드라인입니다.

## Communication Guidelines

### 응답 언어
- **한글로 답변**: 모든 응답과 설명은 한글로 작성
- **영어로 주석 작성**: 코드 내 주석은 영어로 작성

## Technology Stack

### 기본 스택
- **Language**: TypeScript
- **Node.js Version**: 22
- **UI Framework**: 공통 모듈 기반 UI Element 사용
- **Build Tool**: Vite
- **Tools**: context7 MCP 사용

## Design Requirements

### UI/UX 요구사항
- **Color Scheme**: Dark Mode 지원
- **Responsive Design**: 반응형 웹 디자인 필수
- **Device Support**: 
  - PC
  - Tablet
  - Mobile
- **Orientation Support**:
  - 가로 보기 (Landscape)
  - 세로 보기 (Portrait)

## Coding Principles

### SOLID 원칙 준수

#### SRP - 단일 책임 원칙 (Single Responsibility Principle)
클래스나 모듈은 오직 하나의 변경 이유만을 가져야 합니다. 즉, 하나의 책임만 수행해야 합니다.

#### OCP - 개방-폐쇄 원칙 (Open/Closed Principle)
소프트웨어 엔티티(클래스, 모듈, 함수 등)는 확장에 대해서는 개방되어야 하지만, 수정에 대해서는 폐쇄되어야 합니다. 즉, 새로운 기능을 추가할 때 기존 코드를 수정하지 않아야 합니다.

#### LSP - 리스코프 치환 원칙 (Liskov Substitution Principle)
상위 타입의 객체는 하위 타입의 객체로 치환해도 프로그램의 정확성이 유지되어야 합니다. 즉, 부모 클래스를 사용하는 코드가 자식 클래스로 대체되어도 문제없이 동작해야 합니다.

#### ISP - 인터페이스 분리 원칙 (Interface Segregation Principle)
클라이언트는 자신이 사용하지 않는 메서드에 의존해서는 안 됩니다. 즉, 하나의 거대한 인터페이스보다는 여러 개의 작은 인터페이스가 낫습니다.

#### DIP - 의존성 역전 원칙 (Dependency Inversion Principle)
고수준 모듈은 저수준 모듈에 의존해서는 안 됩니다. 이 두 모듈 모두 추상화에 의존해야 합니다. 추상화는 세부 사항에 의존해서는 안 됩니다. 세부 사항이 추상화에 의존해야 합니다. (즉, 인터페이스나 추상 클래스에 의존하고, 구체 클래스에 직접 의존하지 않습니다.)

## Testing Guidelines

### 테스트 접근 방식
- **신중한 분석**: 테스트 시 반드시 신중하게 분석하고 검토한다 (hard think)
- **사전 검토**: 모든 테스트 케이스 실행 전 충분한 사전 검토를 수행한다
- **다각도 분석**: 테스트 결과에 대해 다각도로 분석한다
- **근본 원인 파악**: 예상하지 못한 결과에 대해서는 근본 원인을 파악한다

### Web Testing
- **Playwright MCP 도구 사용**: Web test 시 playwright MCP 도구를 사용한다
- **npx playwright test 금지**: 직접적인 playwright 명령어 사용 금지

## Code Modification Rules

### 코드 수정 시 준수 사항
1. **주석 업데이트**: 코드 수정 발생 시 코드 수정한 부분의 주석이 알맞게 변경한다
2. **기존 기능 확인**: 기능 추가시 기존에 기능이 이미 추가 되어 있는지 반드시 확인한다

## Session Management

### 세션 관리 원칙
- **Local Storage 사용 금지**: local storage session 사용 금지
- **Server Side Only**: 모든 세션 관리는 서버 사이드(KV storage)에서만 처리한다

## Task Management

### Todo 관리
- **tasks.md 업데이트**: todo 완료 될때마다 tasks.md 파일의 해당 항목을 [x]로 체크 표시하여 업데이트한다

## File Structure

### 포함 파일
```
src/**/*.ts
src/**/*.tsx
src/**/*.js
src/**/*.jsx
*.md
package.json
tsconfig.json
```

### 제외 파일
```
node_modules/**
dist/**
build/**
*.log
.git/**
```

## Summary

이 규칙들은 코드 품질 향상, 유지보수성 증대, 그리고 팀 협업 효율성을 위해 수립되었습니다. 모든 개발 작업 시 이 가이드라인을 준수하여 일관성 있고 고품질의 코드를 작성해야 합니다.