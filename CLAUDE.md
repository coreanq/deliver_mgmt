# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Sheets-based delivery management system with Vue.js frontend and dual backend architecture. Uses Google Sheets as primary database, QR code staff authentication, and SOLAPI OAuth2 for KakaoTalk messaging. **MVP status: Core features implemented and tested.**

### Backend Architecture
- **Hono Backend** (`backend-hono/`): Modern Cloudflare Workers-compatible backend for both local development and production deployment
- **Note**: Previous Express backend (`backend/`) has been migrated to Hono architecture

## Development Commands

### Root Level (runs both servers concurrently)
```bash
npm run dev              # Start both backend (5001) and frontend (5173)
npm run build            # Conditional build based on BUILD_TARGET env var
npm run build:full       # Build both backend and frontend
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only
npm run test             # Run all tests
npm run test:e2e         # Run Playwright E2E tests (use MCP tools instead)
npm run test:e2e:ui      # Playwright UI mode
npm run lint             # Lint both projects
npm run typecheck        # Type check both projects
npm run deploy:backend   # Deploy backend to Cloudflare Workers
```


### Hono Backend (`backend-hono/`)
```bash
cd backend-hono && npm run local    # Local Node.js server (port 5001)
cd backend-hono && npm run dev      # Wrangler dev server (Cloudflare Workers env)
cd backend-hono && npm run build    # TypeScript compilation
cd backend-hono && npm run typecheck # Type checking only
cd backend-hono && npm run deploy   # Deploy to Cloudflare Workers
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
- **Backend**: Hono 4.x, Cloudflare Workers, TypeScript 5.x, KV storage
- **Frontend**: Vue.js 3 Composition API, Vuetify 3, Vite, PWA support
- **Database**: Google Sheets (primary), Sessions (KV storage)
- **Authentication**: Google OAuth2, SOLAPI OAuth2, JWT QR tokens
- **Testing**: Playwright E2E tests, Vitest unit tests
- **Deployment**: Cloudflare Workers (backend) + Cloudflare Pages (frontend)

### Key Services (Both Backends)
- **GoogleSheetsService**: Spreadsheet CRUD operations with dynamic header system
- **GoogleAuthService**: Google OAuth2 token management with auto-refresh
- **SolapiAuthService**: SOLAPI OAuth2 integration (**HTTP API, not SDK**)

### Development vs Production Environments
| Feature | Local Development | Cloudflare Workers Production |
|---------|----------------|-------------||
| **Session Storage** | In-memory storage | Cloudflare KV (persistent) |
| **Environment** | Node.js runtime | Cloudflare Workers |
| **Development** | `npm run local` (port 5001) | `npm run deploy` |
| **Logging** | console.log | Cloudflare Workers logs |

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

### Environment Variables

Both backends require similar environment variables:


**Hono Backend** (`.env` in `backend-hono/`):
```bash
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Same Google and SOLAPI credentials as above
# For Cloudflare Workers: Set in dashboard instead of .env
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
- **Port Configuration**: Never modify frontend (5173) or backend (5001) port settings (다른 포트 사용 금지)
- **Data Integrity**: After status updates, always refresh data from server to maintain sync with Google Sheets
- **Status Synchronization**: Use proper helper functions for status access to avoid undefined values
- **Task Management**: Update tasks.md when todos are completed
- **Dynamic System**: Never assume specific column names - always use actual sheet data
- **Session Management**: Local development uses in-memory storage; production uses Cloudflare KV

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

## Cloudflare Workers Deployment (Hono Backend)

### Prerequisites
1. Cloudflare account with Workers enabled
2. Wrangler CLI installed and authenticated
3. KV namespace created for sessions

### Deployment Steps
```bash
cd backend-hono

# Login to Cloudflare (one-time setup)
npx wrangler auth login

# Create KV namespace for sessions
npx wrangler kv:namespace create "SESSIONS"
npx wrangler kv:namespace create "SESSIONS" --preview

# Update wrangler.toml with KV namespace IDs
# Set environment variables in Cloudflare dashboard

# Deploy
npm run deploy
```

### Environment Variables (Cloudflare Dashboard)
Set these in the Cloudflare Workers dashboard:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URL` (with your Workers domain)
- `SOLAPI_CLIENT_ID`
- `SOLAPI_CLIENT_SECRET`
- `SOLAPI_REDIRECT_URL` (with your Workers domain)
- `FRONTEND_URL` (your frontend domain)

## Testing

### E2E Testing with Playwright
- **Critical**: Use Playwright MCP tools for browser automation, NOT `npx playwright test`
- **Test Directory**: `/tests/` contains E2E test specifications
- **Base URL**: Tests run against `http://localhost:5173`
- **Available Tests**:
  - `admin-settings.spec.ts`: Admin dashboard functionality
  - `delivery-auth.spec.ts`: QR authentication flow
  - `delivery-dashboard.spec.ts`: Staff delivery interface
  - `example.spec.ts`: Basic functionality tests

### Unit Testing
- **Frontend**: Vitest framework for Vue.js components
- **Commands**: `cd frontend && npm run test`

## Project Files

### Configuration Files
- `playwright.config.ts`: E2E test configuration
- `frontend/vite.config.ts`: Vite build configuration
- `backend-hono/wrangler.toml`: Cloudflare Workers configuration
- `backend-hono/tsconfig.json`: TypeScript configuration
- `.gitignore`: Git ignore rules including MCP config

### Documentation Files
- `CLOUDFLARE_DEPLOYMENT.md`: Detailed Cloudflare deployment guide
- `prd.md`: Product Requirements Document (MVP specifications)
- `tasks.md`: Development task tracking and checklist
- local server 와 운영 서버 간의 url 을 동적으로 설정할수 있도록 해야함