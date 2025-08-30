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

# Production build with custom API URL
VITE_API_BASE_URL=https://your-worker.your-subdomain.workers.dev npm run build
```

### Testing
- **Playwright E2E**: Use Playwright MCP tools, NOT `npx playwright test`
- **Backend Tests**: Jest framework  
- **Test Page**: `http://localhost:5173/test` for development testing
- **Individual Tests**: 
  ```bash
  # Frontend specific test
  cd frontend && npm run test -- --run specific-test-name
  # Backend specific test  
  cd backend-hono && npm test -- --testNamePattern="specific test"
  ```

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

### Authentication Architecture (Dual Authentication System)

This system implements a **dual authentication structure** designed for different user roles:

#### 1. **Admin Authentication** (Google OAuth2)
- **Flow**: Browser → Google OAuth → Backend → KV Storage → httpOnly Cookie
- **Storage**: Cloudflare KV (production) / In-memory (development)
- **Session**: Persistent with auto-refresh (expires 1 hour, refreshed 5 minutes before expiry)
- **Security**: httpOnly cookies prevent XSS, SameSite=Strict prevents CSRF
- **Usage**: Admin dashboard, Google Sheets management

**Key Files**:
- `backend-hono/src/routes/auth.ts`: OAuth endpoints and callback handling
- `backend-hono/src/middleware/auth.ts`: `requireGoogleAuth` middleware
- `frontend/src/stores/auth.ts`: Pinia store for auth state management

**OAuth Flow**:
```
1. /api/auth/google → Google authorization page
2. /api/auth/google/callback → Token exchange + secure session creation
3. /api/auth/status → Session validation with auto-refresh
4. /api/auth/logout → Session cleanup
```

#### 2. **Delivery Staff Authentication** (QR Token System)
- **Flow**: QR Code → JWT Token → Header Authorization → Backend Bypass → Google Sheets
- **Access Pattern**: `/delivery/:date/:staffName?token=jwt_token`
- **Token**: JWT with SHA256 hash, 24-hour expiration
- **Scope**: Limited to staff's assigned delivery data only
- **Security**: Time-limited, staff-specific, no persistent session

**Key Implementation**:
- **QR Bypass Logic** (`sheets.ts` middleware):
```typescript
// Skip Google auth for staff endpoints when QR token is present
if (c.req.path.includes('/staff/') && c.req.method === 'GET') {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');
  if (token) {
    await next(); // Skip Google auth, handle QR token in endpoint
    return;
  }
}
```

- **Mobile Interface** (`StaffMobileView.vue`):
```typescript
const requestHeaders: { [key: string]: string } = {};
if (token) {
  requestHeaders['Authorization'] = `Bearer ${token}`;
}
```

#### 3. **Authentication Flows Summary**
1. **Google OAuth2**: Spreadsheet access (`/api/auth/google`)
2. **SOLAPI OAuth2**: KakaoTalk messaging (`/api/solapi/auth/login`)
3. **QR Authentication**: JWT tokens for staff (`/api/delivery/qr/`)

#### 4. **Security Principles**
- **Session Separation**: Admin sessions and staff tokens are completely isolated
- **Time Limitation**: QR tokens auto-expire after 24 hours
- **Scope Limitation**: Staff can only access their assigned delivery data
- **Transport Security**: HTTPS + Authorization headers
- **Local Storage Prohibition**: All auth data managed server-side or via httpOnly cookies
- **Cross-Device Support**: QR tokens work on separate mobile devices without admin sessions

### Frontend Views (`frontend/src/views/`)
- **AdminView.vue**: Main admin configuration and data management
- **StaffMobileView.vue**: Mobile-optimized staff delivery interface with progressive status workflow
- **DeliveryAuthView.vue**: QR authentication flow
- **TestView.vue**: Development testing interface

## Configuration

### Environment Variables

**Node.js Version Requirement**: >= 22.0.0 (specified in frontend/package.json)

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

#### Google OAuth Token Management
- **Auto-refresh middleware**: `requireGoogleAuth` refreshes tokens 5 minutes before expiry
- **Session tracking**: Google tokens stored with `expiryDate` for lifecycle management
- **Secure Storage**: httpOnly cookies (frontend) + KV storage (backend)
- **Token Lifecycle**: 1-hour access tokens, persistent refresh tokens

#### QR Token Security System
- **JWT Structure**: Contains `staffName`, `date`, `exp` (24-hour expiration)
- **Security Hash**: SHA256 with `QR_SECRET_KEY`
- **Scope Validation**: Token must match requested staff name and date
- **Cross-Device Support**: Works on mobile devices without admin Google sessions
- **Admin Session Pooling**: QR requests use existing admin Google tokens for Sheets API access

#### Session Management Architecture
| Component | Development | Production |
|-----------|-------------|------------|
| **Admin Sessions** | In-memory Map | Cloudflare KV |
| **Client Cookies** | httpOnly (localhost) | httpOnly (secure domain) |
| **QR Tokens** | JWT verification | JWT verification |
| **Local Storage** | **Prohibited** | **Prohibited** |

#### Authentication Bypass Logic
The system allows QR token holders to bypass Google authentication for specific endpoints:

```typescript
// middleware in sheets.ts
if (c.req.path.includes('/staff/') && c.req.method === 'GET') {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');
  if (token) {
    // Skip requireGoogleAuth middleware
    await next();
    return;
  }
}
// Apply Google auth for all other requests
return requireGoogleAuth(c, next);
```

This enables delivery staff to access their assigned data from separate mobile devices while maintaining security through time-limited, scope-restricted JWT tokens.

### SOLAPI Implementation
**CRITICAL**: Uses **SOLAPI OAuth2 flow**, NOT SDK. Direct HTTP API calls to SOLAPI endpoints for token exchange, refresh, and SMS/KakaoTalk messaging.

**Key Endpoints**:
- OAuth Authorization: `https://api.solapi.com/oauth2/v1/authorize`
- Token Exchange: `https://api.solapi.com/oauth2/v1/access_token`
- SMS Send: `https://api.solapi.com/messages/v4/send`
- Account Balance: `https://api.solapi.com/cash/v1/balance`
- Message Pricing: `https://api.solapi.com/pricing/v1/messaging`
- App Pricing: `https://api.solapi.com/pricing/v1/messaging/combined`
- Active Sender IDs: `https://api.solapi.com/senderid/v1/numbers/active`

**Implementation Files**:
- `backend-hono/src/routes/solapi.ts`: OAuth flow, account info, and SMS API endpoints
- `backend-hono/src/services/solapiAuth.ts`: Token refresh service with 30-minute buffer
- SMS endpoint: `POST /api/solapi/message/send` (requires authenticated session)
- Account endpoints: `GET /api/solapi/account/{balance,pricing,app-pricing,sender-ids}`
- Authentication: `GET /api/solapi/auth/status`, `POST /api/solapi/auth/logout`

**OAuth Scopes Required**:
- `message:write` - SMS/KakaoTalk message sending
- `cash:read` - Account balance inquiry
- `pricing:read` - Message/app pricing inquiry
- `senderid:read` - Sender ID management
- **Scope Format**: Space-separated with URL encoding (`message:write%20cash:read%20pricing:read%20senderid:read`)

**Token Management**:
- **Access Token Lifecycle**: 24 hours (SOLAPI standard)
- **Auto-refresh Logic**: 30-minute buffer before expiry in `SolapiAuthService`
- **Session Integration**: SOLAPI tokens stored alongside Google tokens in same session
- **Independent Logout**: Can disconnect SOLAPI without affecting Google authentication

**Testing Requirements**:
- **발신번호**: Must use SOLAPI-registered sender numbers (e.g., 010-3091-7061)
- **Message Format**: JSON with `{message: {type, from, to, text}}` structure
- **Authentication**: OAuth2 Bearer tokens via session management

### Automation System Architecture

**CRITICAL**: This system implements spreadsheetId-based multi-user automation rules to prevent cross-user rule triggers.

#### Core Components
- **AutomationRule Interface**: Defines automation rules with spreadsheetId-based user isolation
- **Webhook Processing**: `/api/automation/trigger` endpoint processes Google Sheets change events
- **Multi-user Support**: Each user's Google Sheets identified by unique spreadsheetId
- **Message Templates**: Variable substitution using `#{columnName}` syntax

#### Key Implementation Details

**AutomationRule Structure**:
```typescript
interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  spreadsheetId?: string; // 특정 스프레드시트만 대상 (사용자별 구분)
  targetDate?: string; // 특정 날짜 시트만 대상 (YYYYMMDD 형식, 선택적)
  conditions: {
    columnName: string; // 감시할 컬럼명
    triggerValue: string; // 트리거 값 (예: "배송 완료")
    operator: 'equals' | 'contains' | 'changes_to';
  };
  actions: {
    type: 'sms' | 'kakao';
    senderNumber: string;
    recipientColumn: string; // 수신자 전화번호 컬럼
    messageTemplate: string; // 메시지 템플릿 with 변수
  };
}
```

**Multi-user Isolation Logic**:
```typescript
// Only execute rules matching the webhook's spreadsheetId
if (rule.spreadsheetId && spreadsheetId && rule.spreadsheetId !== spreadsheetId) {
  console.log(`Rule ${rule.name} skipped: spreadsheetId ${rule.spreadsheetId} != ${spreadsheetId}`);
  continue;
}
```

**Google Apps Script Integration**:
```javascript
function onEdit(e) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = spreadsheet.getId(); // Critical for user isolation
  
  const payload = {
    sheetName: sheet.getName(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheetId, // Required for multi-user support
    columnName: columnName,
    oldValue: oldValue,
    newValue: newValue,
    rowData: rowData,
    timestamp: new Date().toISOString()
  };
  
  UrlFetchApp.fetch('http://localhost:5001/api/automation/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload)
  });
}
```

#### Automation API Routes
- Create rule: `POST /api/automation/rules`
- List rules: `GET /api/automation/rules`
- Webhook trigger: `POST /api/automation/trigger`
- Manual test: `POST /api/automation/webhook/test`

#### Message Variable System
- Template format: `#{columnName}` (e.g., `#{고객명}`, `#{주문번호}`)
- Runtime substitution with actual row data from Google Sheets
- Example: `#{고객명}님, 주문해주셔서 대단히 감사합니다.` → `1번 고객님, 주문해주셔서 대단히 감사합니다.`

#### Testing & Validation
- **Test Command**: Use curl for webhook testing (see tests.md for examples)
- **Verification**: Check backend logs for rule matching and SMS sending
- **Multi-user Testing**: Verified that different spreadsheetIds trigger only their respective rules

### API Route Patterns
- Date-based sheets: `/api/sheets/date/:date` (YYYYMMDD format)
- Staff-grouped data: `/api/sheets/date/:date/by-staff`
- Individual staff data: `/api/sheets/date/:date/staff/:staffName`
- Status updates: `PUT /api/sheets/data/:date/status`
- Automation rules: `/api/automation/rules` (CRUD operations)
- Webhook trigger: `POST /api/automation/trigger` (Google Sheets webhook endpoint)
- Mock endpoints available in development mode

## Development Guidelines

### Language & Communication (from .claude.json)
- **Response Language**: 한글로 답변
- **Comment Language**: 영어로 주석 작성
- **Design Principles**: Follow SOLID principles for all modifications
- **Dark Mode**: UI supports dark mode (design requirement)
- **Responsive Design**: Support PC, Tablet, Mobile with both landscape and portrait orientations

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
- **Authentication Security**: 
  - **Local Storage Prohibition**: All session management server-side only (local storage session 사용 금지)
  - **httpOnly Cookies**: Prevent XSS attacks by using httpOnly cookies for admin sessions
  - **QR Token Validation**: Always verify JWT token scope matches requested staff/date
  - **Cross-Device Authentication**: Support QR access from mobile devices without admin sessions
- **Automation System**:
  - **Multi-user Isolation**: Always include spreadsheetId in automation rules for user separation
  - **Webhook Testing**: Use `POST /api/automation/trigger` with proper spreadsheetId for testing
  - **Variable Templates**: Use `#{columnName}` format for message template variables
  - **Google Apps Script**: Must include `spreadsheet.getId()` in webhook payload for user isolation

## Common Patterns

### Status Update Flow
1. User clicks status button in StaffMobileView
2. `updateOrderStatus()` sends PUT request to `/api/sheets/data/:date/status`
3. Backend updates Google Sheets via GoogleSheetsService
4. Frontend calls `loadDeliveryData()` to refresh from server
5. UI updates with new status and appropriate button states

### Automation Workflow
1. Admin creates automation rule in AdminView with conditions and actions
2. Rule saved with current spreadsheetId for user isolation
3. Google Sheets onEdit trigger sends webhook to `/api/automation/trigger`
4. Backend matches webhook spreadsheetId with user's automation rules
5. Matching rules execute: variable substitution → SOLAPI SMS sending
6. Response includes execution results and message delivery status

**Critical**: Google Apps Script must include `spreadsheetId` in webhook payload for multi-user support.

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

### Cross-Domain Cookie Limitations (Cloudflare Workers + Pages)
When using Cloudflare Workers (backend) + Cloudflare Pages (frontend) with different domains:

- **SameSite=Strict 제한사항**: 서로 다른 도메인 간에는 `SameSite=Strict` 설정으로 쿠키 전송 불가
- **Cross-Domain 쿠키 정책**: 브라우저 보안 정책으로 인해 서로 다른 도메인의 쿠키는 자동으로 차단됨
- **해결 방안**: 
  - `SameSite=None; Secure` 설정 사용 (HTTPS 필수)
  - 또는 동일 도메인/서브도메인 구조로 배포 권장
  - JWT 토큰 기반 헤더 인증 방식 활용 고려

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
- frontend, backend 포트 변경 금지
- solapi 구현은 https://developers.solapi.com/references/authentication/oauth2-3/oauth2 참고
- solapi 발신번호는 여기 참고 https://developers.solapi.com/references/senderid/getActivatedSenderIds, 메시지 단가 조회는 https://developers.solapi.com/references/pricing/getMessagePrice 참고
- 앱의 단가조회는 https://developers.solapi.com/references/pricing/getMessagePriceByApp 참고