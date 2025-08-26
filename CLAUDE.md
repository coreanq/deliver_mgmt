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
- **GoogleSheetsService**: Spreadsheet CRUD operations
- **GoogleAuthService**: Google OAuth2 token management
- **SolapiAuthService**: SOLAPI OAuth2 integration (**HTTP API, not SDK**)

### Authentication Flows
1. **Google OAuth2**: Spreadsheet access (`/api/auth/google`)
2. **SOLAPI OAuth2**: KakaoTalk messaging (`/api/solapi/auth/login`)
3. **QR Authentication**: JWT tokens for staff (`/api/delivery/qr/`)

### API Routes
- **Authentication**: `/api/auth/*` - OAuth flows
- **Sheets**: `/api/sheets/*` - Spreadsheet operations
- **Delivery**: `/api/delivery/*` - QR codes, status updates
- **SOLAPI**: `/api/solapi/*` - Messaging, account management
- **Test**: `GET /api/sheets/test` - Development mock data

### Frontend Views (`frontend/src/views/`)
- **AdminView.vue**: Main admin configuration
- **DeliveryView.vue**: Staff delivery dashboard
- **DeliveryAuthView.vue**: QR authentication
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

## SOLAPI Implementation

**CRITICAL**: Uses **SOLAPI OAuth2 flow**, NOT SDK. Follow https://developers.solapi.com/references/authentication/oauth2-3/oauth2

Implementation in `backend/src/services/solapiAuth.ts`:
- Direct HTTP API calls to SOLAPI endpoints
- OAuth2 token exchange and refresh
- KakaoTalk message sending
- Account and sender management

## Data Model

### Google Sheets Structure
- **Dynamic header system**: Uses actual sheet headers without hardcoding
- **DeliveryOrder interface**: `[key: string]: any` for dynamic properties from sheet headers
- **Date-based sheets**: YYYYMMDD format sheets for daily orders
- **Staff grouping**: Automatic detection of Korean staff names (2-4 characters) in headers
- **Status column detection**: Flexible status column identification
- **Status Flow**: `대기` → `준비중` → `출발` → `완료`

### QR Code Security (`backend/src/utils/qrGenerator.ts`)
- **JWT tokens** with SHA256 hash verification
- **Hash**: SHA256(staffName + timestamp + secretKey)
- **Expiration**: 24-hour lifecycle
- **Two-step auth**: QR scan + name verification

## Testing Approach

### Playwright MCP (E2E)
- **Use Playwright MCP tools** instead of `npx playwright test`
- Test files in `/tests/` directory
- Critical flows: admin setup, staff authentication, delivery management

### Development Testing
- **Test page**: `http://localhost:5173/test`
- **API testing**: `curl http://localhost:5001/api/sheets/test`
- **Mock endpoints**: Available in development mode

## Implementation Status

✅ **Completed Features**:
- Google OAuth2 authentication system
- SOLAPI OAuth2 integration (OAuth2 method)
- QR code generation and verification
- Google Sheets API connectivity
- Admin configuration UI
- Delivery staff interface
- Basic Playwright E2E tests
- TypeScript configuration and build system

⏳ **Remaining MVP Tasks**:
- Automatic message sending on delivery completion
- Real-time synchronization improvements
- Production deployment configuration

## Token Management & Security

### Automatic Token Refresh System
- **Auto-refresh middleware**: `backend/src/middleware/auth.ts` with `requireGoogleAuth`
- **Pre-emptive refresh**: Tokens refresh 5 minutes before expiry
- **Retry mechanism**: `handleGoogleApiError` function retries API calls after token refresh
- **Session tracking**: Google tokens stored with `expiryDate` for lifecycle management
- **Development testing**: `POST /api/auth/force-token-expiry` for testing token refresh (dev only)

### Token Lifecycle
1. **Initial auth**: 1-hour expiry set during OAuth callback
2. **Middleware check**: Every API call checks token expiry status  
3. **Auto-refresh**: Transparent refresh when tokens near expiry
4. **Retry on 401**: Failed API calls automatically retry after token refresh
5. **Session update**: Refreshed tokens immediately saved to session

## Important Notes

1. **SOLAPI**: Always use OAuth2 flow, never the SDK
2. **Testing**: Use Playwright MCP tools for browser automation
3. **Google Sheets**: Primary database - handle with care
4. **QR Codes**: 24-hour expiration for security
5. **Environment**: Backend port changes require CORS_ORIGIN updates
6. **Todo Updates**: Update tasks.md when todos are completed (as per .claude.json)
7. **Dynamic Data System**: Never hardcode column names - use actual sheet headers
8. **Filter System**: Dynamic filter system allows users to filter by any sheet column
9. **Korean Guidelines**: 한글로 답변, 영어로 주석 작성 (per .claude.json)
10. **SOLID Principles**: Follow SOLID design principles for all code modifications
11. **Token Security**: Automatic token refresh prevents service interruption during long sessions

## Critical Implementation Details

### Dynamic Headers System
- `GoogleSheetsService.getDeliveryOrders()` maps sheet headers directly to order objects
- `DeliveryOrder` interface uses `[key: string]: any` for flexible properties
- Filter system in AdminView allows selecting any column for filtering
- Never assume specific column names - always use actual sheet data

### Staff Detection Logic
- `isLikelyStaffName()`: Korean names 2-4 characters (`/^[가-힣]{2,4}$/`)
- `isStandardHeader()`: Recognizes standard headers to avoid treating them as staff names
- `getDeliveryOrdersByStaff()`: Groups orders by detected staff names or data values

### API Route Patterns
- Date-based sheets: `/api/sheets/date/:date` (YYYYMMDD format)
- Staff-grouped data: `/api/sheets/date/:date/by-staff`
- Session-based authentication with `requireGoogleAuth` middleware
- Mock endpoints available in development mode (`NODE_ENV=development`)

### Dependencies Note
- **Backend**: Uses `solapi` package (v4.0.0) but implements OAuth2 flow directly via HTTP API, NOT SDK
- **Frontend**: Includes QR code libraries (`qrcode-reader`, `html5-qrcode`) for staff authentication
- **Testing**: Vitest (frontend) and Jest (backend) frameworks configured

### Important Development Rules
- **Port Configuration**: Never modify frontend (5173) or backend (5001) port settings
- **Task Management**: When adding/changing features, update tasks.md file accordingly
- **Language Guidelines**: 한글로 답변, 영어로 주석 작성 (as per .claude.json)
- **SOLID Principles**: Follow SOLID design principles for all code modifications