# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Automatic Context Management

### Context Compression Rules
- **AUTOMATIC TRIGGER**: When conversation exceeds 150 messages or shows signs of context degradation
- **COMPRESSION AGENT**: Use context-manager subagent for automatic `/init` execution
- **PRESERVATION PRIORITY**: Current task > Recent decisions > Project state > Historical context

### Context Health Monitoring
Monitor these signals for compression triggers:
1. Repetitive responses or Claude forgetting recent context
2. Performance degradation in code understanding
3. Long conversation threads (200+ messages)
4. Multiple parallel subagent tasks accumulating context

### Automatic Compression Workflow
1. **Detection**: context-manager monitors conversation health
2. **Trigger**: Automatically execute context compression
3. **Compression**: Run `/init` and update project state
4. **Handoff**: Create compressed summary for continuation
5. **Reset**: Start fresh conversation with essential context




## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## 프로젝트 개요
구글 스프레드시트 기반 배달 관리 시스템 (MVP) - QR 코드와 본인 인증을 통한 배달 업무 관리 웹앱

## 개발 환경 명령어

### 백엔드 (Node.js/Express/TypeScript)
```bash
cd backend

# 개발 서버 실행 (nodemon + ts-node)
npm run dev

# 프로덕션 빌드
npm run build
npm start

# 코드 품질 확인
npm run lint
npm run lint:fix

# 테스트 실행
npm test
```

### 프론트엔드 (Vue.js 3/Vuetify/Vite)
```bash
cd frontend

# 개발 서버 실행 (Vite dev server)
npm run dev

# 프로덕션 빌드
npm run build
npm run preview

# 코드 품질 확인
npm run lint
npm run type-check
```

## 아키텍처 개요
- **백엔드**: Node.js v22 + Express.js + TypeScript (포트: 5000)
- **프론트엔드**: Vue.js 3 + Composition API + Vuetify 3 + TypeScript (포트: 3000)
- **데이터 저장**: Google Sheets API (배달담당자별 개별 시트)
- **인증**: QR 코드 + 본인 이름 확인 (2단계 인증) + Google OAuth2
- **메시지 발송**: SOLAPI OAuth2 연동 (배달 완료시만)
- **세션 관리**: Express Session + JWT

## 핵심 서비스 클래스
- **GoogleSheetsService**: Google Sheets API 연동 및 데이터 관리
- **SolapiService**: SOLAPI OAuth2 및 메시지 발송
- **SyncService**: 실시간 데이터 동기화 (서버 종료 시 정리)
- **TokenService**: JWT 토큰 관리 및 QR 코드 생성

## API 라우트 구조
- `/api/auth/*` - Google OAuth2 인증 및 세션 관리
- `/api/sheets/*` - Google Sheets 데이터 CRUD
- `/api/delivery/*` - 배달 상태 관리 및 업데이트
- `/api/sync/*` - 실시간 동기화 엔드포인트
- `/api/solapi/*` - SOLAPI OAuth2 및 메시지 발송

## 환경 설정
- 백엔드 환경변수: `backend/.env` (예시: `backend/.env.example`)
- 주요 필수 환경변수:
  - Google OAuth2: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - SOLAPI: `SOLAPI_CLIENT_ID`, `SOLAPI_CLIENT_SECRET`
  - 보안: `SESSION_SECRET`, `JWT_SECRET`, `QR_SECRET_KEY`

## 프론트엔드 프록시 설정
- Vite는 `/api/*` 요청을 백엔드 (`http://localhost:5000`)로 프록시
- 별칭: `@` → `./src`
- Vuetify 자동 임포트 활성화

## 배달 상태 플로우
"대기" → "준비중" → "출발" → "완료" (Google Sheets D열에 저장)

## 테스트 페이지
- SOLAPI OAuth2 테스트: `http://localhost:5000/test/test-oauth.html`