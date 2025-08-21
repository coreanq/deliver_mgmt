# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## 프로젝트 개요
구글 스프레드시트 기반 배달 관리 시스템 (MVP) - QR 코드와 본인 인증을 통한 배달 업무 관리 웹앱

## 아키텍처 개요
- **백엔드**: Node.js v22 + Express.js + TypeScript
- **프론트엔드**: Vue.js 3 + Composition API + Vuetify 3 + TypeScript
- **데이터 저장**: Google Sheets API (배달담당자별 개별 시트)
- **인증**: QR 코드 + 본인 이름 확인 (2단계 인증)
- **메시지 발송**: SOLAPI OAuth2 연동 (배달 완료시만)

## 핵심 기능
1. **구글 스프레드시트 연동**: 배달담당자별 시트 관리 (A:고객명, B:연락처, C:주소, D:배달상태)
2. **QR 코드 시스템**: 시트명 기반 QR 생성 + 본인 인증
3. **배달 상태 관리**: "대기" → "준비중" → "출발" → "완료"
4. **카카오톡 알림**: SOLAPI 연동, 배달 완료시에만 자동 발송

## 권장 디렉토리 구조
```
/backend          - Node.js/Express API 서버
  /src
    /routes       - API 라우트 (auth, sheets, solapi, delivery, qr)
    /services     - 비즈니스 로직 (GoogleSheetsService, SolapiService)
    /middleware   - 인증, 로깅 미들웨어
    /utils        - 공통 유틸리티 (토큰, 해싱)
/frontend         - Vue.js 3 SPA
  /src
    /components   - 재사용 가능한 컴포넌트
    /views        - 페이지 컴포넌트 (Admin, Delivery)
    /stores       - Pinia 상태 관리
    /services     - API 호출 서비스
```