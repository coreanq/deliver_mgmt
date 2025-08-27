# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Sheets-based delivery management system with Vue.js frontend and Node.js backend. Uses Google Sheets as primary database, QR code staff authentication, and SOLAPI OAuth2 for KakaoTalk messaging. **MVP status: Core features implemented and tested.**

## Development Commands

### Root Level (runs both servers concurrently)
```bash
npm run dev              # Start both backend (5001) and frontend (5173)
npm run build           # Build both projects
npm run test            # Run all tests
npm run test:e2e        # Run Playwright E2E tests (use MCP tools instead)
npm run test:e2e:ui     # Playwright UI mode
npm run lint            # Lint both projects
npm run typecheck       # Type check both projects
```

### Backend Specific
```bash
cd backend && npm run dev        # nodemon + ts-node (port 5001)
cd backend && npm run build      # TypeScript compilation
cd backend && npm run typecheck  # Type checking only
cd backend && npm run lint       # ESLint
```

### Frontend Specific
```bash
cd frontend && npm run dev       # Vite dev server (port 5173)
cd frontend && npm run build     # Production build
cd frontend && npm run preview   # Preview production build
```

### Testing
- **Playwright E2E**: Use Playwright MCP tools, NOT `npx playwright test`
- **Backend Tests**: Jest framework
- **Test Page**: `http://localhost:5173/test` for development testing

## Architecture

### Tech Stack
- **Backend**: Node.js 22+, Express.js, TypeScript 5.1+
- **Frontend**: Vue.js 3 Composition API, Vuetify 3, Vite
- **Database**: Google Sheets (primary), Express sessions (temporary)
- **Authentication**: Google OAuth2, SOLAPI OAuth2, JWT QR tokens

### Key Services (`backend/src/services/`)
- **GoogleSheetsService**: Spreadsheet CRUD operations with dynamic header system
- **GoogleAuthService**: Google OAuth2 token management with auto-refresh
- **SolapiAuthService**: SOLAPI OAuth2 integration (**HTTP API, not SDK**)

### Authentication Flows
1. **Google OAuth2**: Spreadsheet access (`/api/auth/google`)
2. **SOLAPI OAuth2**: KakaoTalk messaging (`/api/solapi/auth/login`)
3. **QR Authentication**: JWT tokens for staff (`/api/delivery/qr/`)

### Frontend Views (`frontend/src/views/`)
- **AdminView.vue**: Main admin configuration and data management
- **StaffMobileView.vue**: Mobile-optimized staff delivery interface with progressive status workflow
- **DeliveryAuthView.vue**: QR authentication flow
- **TestView.vue**: Development testing interface

## Configuration

### Environment Variables (`.env`)
```bash
NODE_ENV=development
PORT=5001

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:5001/api/auth/google/callback

# SOLAPI OAuth2 (OAuth2 flow, not SDK)
SOLAPI_CLIENT_ID=your-solapi-client-id
SOLAPI_CLIENT_SECRET=your-solapi-client-secret
SOLAPI_REDIRECT_URL=http://localhost:5001/api/solapi/auth/callback

# Frontend
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

## Critical Implementation Details

### Dynamic Google Sheets System
- **Never hardcode column names** - uses actual sheet headers dynamically
- **DeliveryOrder interface**: `[key: string]: any` for flexible properties
- **Date-based sheets**: YYYYMMDD format for daily orders
- **Staff detection**: Korean names 2-4 characters (`/^[가-힣]{2,4}$/`)
- **Status Flow**: 5-stage system: `주문 완료` → `상품 준비중` → `배송 준비중` → `배송 출발` → `배송 완료`

### Staff Mobile Interface Logic
- **Access Pattern**: `/delivery/:date/:staffName` with optional QR token
- **Status Button Logic**: Only enabled in `배송 준비중` and `배송 출발` states
- **Progressive Flow**: One-step progression: `배송 준비중` → `배송 출발` → `배송 완료`
- **Helper Function**: Use `getOrderStatus(order)` for reliable status access, not direct `order[statusColumn.value]`

### Token Management & Security
- **Auto-refresh middleware**: `requireGoogleAuth` refreshes tokens 5 minutes before expiry
- **QR Code Security**: JWT tokens with SHA256 hash, 24-hour expiration
- **Session tracking**: Google tokens stored with `expiryDate` for lifecycle management

### SOLAPI Implementation
**CRITICAL**: Uses **SOLAPI OAuth2 flow**, NOT SDK. Direct HTTP API calls to SOLAPI endpoints for token exchange, refresh, and KakaoTalk messaging.

### API Route Patterns
- Date-based sheets: `/api/sheets/date/:date` (YYYYMMDD format)
- Staff-grouped data: `/api/sheets/date/:date/by-staff`
- Individual staff data: `/api/sheets/date/:date/staff/:staffName`
- Status updates: `PUT /api/sheets/data/:date/status`
- Mock endpoints available in development mode

## Development Guidelines

### Language & Communication (from .claude.json)
- **Response Language**: 한글로 답변
- **Comment Language**: 영어로 주석 작성
- **Design Principles**: Follow SOLID principles for all modifications

### Testing Approach
- **Critical**: Use Playwright MCP tools for browser automation, never `npx playwright test`
- **Analysis**: 반드시 신중하게 분석하고 검토 (hard think)
- Always refresh data from server after status updates to maintain sync

### Important Development Rules
- **Port Configuration**: Never modify frontend (5173) or backend (5001) port settings
- **Data Integrity**: After status updates, always refresh data from server to maintain sync with Google Sheets
- **Status Synchronization**: Use proper helper functions for status access to avoid undefined values
- **Task Management**: Update tasks.md when todos are completed
- **Dynamic System**: Never assume specific column names - always use actual sheet data

## Common Patterns

### Status Update Flow
1. User clicks status button in StaffMobileView
2. `updateOrderStatus()` sends PUT request to `/api/sheets/data/:date/status`
3. Backend updates Google Sheets via GoogleSheetsService
4. Frontend calls `loadDeliveryData()` to refresh from server
5. UI updates with new status and appropriate button states

### Error Handling
- Google API errors trigger automatic token refresh and retry
- QR token verification includes expiry and staff name validation
- Dynamic header detection falls back to column index if header matching fails