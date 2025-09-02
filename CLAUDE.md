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

### Key Services
- **GoogleSheetsService**: Spreadsheet CRUD operations with dynamic header system
- **GoogleAuthService**: Google OAuth2 token management with auto-refresh
- **SolapiAuthService**: SOLAPI OAuth2 integration (**HTTP API, not SDK**)
- **UnifiedUserService**: SHA-256 hash-based unified user data management (**Global Instance Pattern**)

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

#### 3. **Unified User Service Architecture** (**Current Implementation**)
**Critical Architecture**: The system uses **UnifiedUserService** with SHA-256 hashed email keys and **global instance pattern** for secure, unified data management.

**Key Components**:
- **UnifiedUserService** (`backend-hono/src/services/unifiedUserService.ts`): Manages all user data with hash-based security
- **Primary Key**: SHA-256 hash of email + salt (`unified_user:${emailHash}`)
- **Security**: Email hash with configurable salt prevents email enumeration attacks
- **Data Structure**: Single unified record per user containing:
  - Google OAuth tokens with auto-refresh
  - SOLAPI OAuth tokens 
  - Automation rules (max 20 per user)
  - User metadata and timestamps

**Storage Strategy**:
```typescript
// Unified user data (1 year TTL)
unified_user:${sha256Hash} → {
  email: string,
  emailHash: string,
  googleTokens: GoogleTokens,
  solapiTokens?: SolapiTokens,
  automationRules: AutomationRule[],
  createdAt: string,
  updatedAt: string
}

// Automation user index for webhook processing
automation_users_index → [email1, email2, ...]
```

**Benefits**:
- **Enhanced Security**: SHA-256 hashing prevents email enumeration attacks
- **Unified Management**: All user data in single service with consistent interface
- **Data Persistence**: 1-year retention for all user data including automation rules
- **Webhook Optimization**: Dedicated user index for efficient webhook processing
- **Multi-Device Access**: Same Google account accesses same unified data
- **Token Integration**: SOLAPI and Google tokens managed together
- **Performance Optimization**: Global instance pattern eliminates duplicate service creation (21+ instances → 1 per request)

#### 4. **Authentication Flows Summary**
1. **Google OAuth2**: Spreadsheet access (`/api/auth/google`)
2. **SOLAPI OAuth2**: KakaoTalk messaging (`/api/solapi/auth/login`)
3. **QR Authentication**: JWT tokens for staff (`/api/delivery/qr/`)

#### 5. **Security Principles**
- **Session Separation**: Admin sessions and staff tokens are completely isolated
- **Time Limitation**: QR tokens auto-expire after 24 hours
- **Scope Limitation**: Staff can only access their assigned delivery data
- **Transport Security**: HTTPS + Authorization headers
- **Local Storage Prohibition**: All auth data managed server-side or via httpOnly cookies
- **Cross-Device Support**: QR tokens work on separate mobile devices without admin sessions
- **Account-Based Isolation**: Each Google account has completely isolated data storage

### Automation System Architecture

The automation system provides rule-based message sending triggered by Google Sheets changes.

#### Automation Rule Management
- **Storage**: Google account-based with 1-year persistence
- **Maximum Limit**: 20 rules per Google account
- **User Isolation**: Rules are filtered by userEmail during execution
- **Persistence**: Rules survive session expiration and token refresh cycles

**Key Features**:
- **Rule Display**: Shows all user rules with spreadsheetId, sheet name, and owner email
- **Manual Management**: Users can view and delete rules manually
- **Rule Validation**: Each rule includes userEmail for ownership verification
- **Cross-Sheet Rules**: Rules can target different spreadsheets and dates

**AutomationRule Interface**:
```typescript
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  spreadsheetId?: string; // 특정 스프레드시트만 대상 (사용자별 구분)
  targetDate?: string; // 특정 날짜 시트만 대상 (YYYYMMDD 형식)
  userEmail?: string; // 규칙을 생성한 Google 계정 이메일
  conditions: {
    columnName: string; // 감시할 컬럼명
    triggerValue: string; // 트리거 값
    operator: 'equals' | 'contains' | 'changes_to';
  };
  actions: {
    type: 'sms' | 'kakao';
    senderNumber: string;
    recipientColumn: string; // 수신자 전화번호 컬럼
    messageTemplate: string; // 메시지 템플릿 with 변수
  };
  createdAt: string;
  updatedAt: string;
}
```

### Frontend Views (`frontend/src/views/`)
- **AdminView.vue**: Main admin configuration and data management with automation rules display
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

### UnifiedUserService Global Pattern
**IMPORTANT**: All routes use a global middleware pattern to provide UnifiedUserService instances for optimal performance and consistency.

**Implementation Pattern**:
```typescript
// Each route file (auth.ts, solapi.ts, automation.ts)
const router = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware - creates one instance per request
router.use('*', async (c, next) => {
  c.set('unifiedUserService', new UnifiedUserService(c.env));
  await next();
});

// Route handlers access via context
const unifiedUserService = c.get('unifiedUserService');
```

**Key Benefits**:
- **Request-Scoped Security**: Each HTTP request gets isolated service instance
- **Performance**: Eliminates 21+ duplicate service instantiations per request
- **Type Safety**: Full TypeScript support via Variables interface
- **Consistency**: Uniform service access pattern across all routes

**Variables Interface** (`src/types/index.ts`):
```typescript
export interface Variables {
  sessionData: GoogleTokens;
  sessionId: string;
  unifiedUserService: import('../services/unifiedUserService').UnifiedUserService;
}
```

### Unified Storage Architecture (2025 Update)
**CRITICAL**: The system uses **unified storage with session delegation** pattern for optimal data management:

```typescript
// Session keys store only metadata (1 day TTL)
session_user:${sessionId} → { email, sessionId, createdAt }

// Unified keys store all actual data (1 year TTL)
unified_user:${emailHash} → { email, googleTokens, solapiTokens, automationRules, ... }

// Session-based methods delegate to unified storage
await unifiedUserService.getSessionBasedUserData(sessionId); // → getUserData(email)
await unifiedUserService.saveSessionBasedUserData(sessionId, userData); // → saveUserData(userData)
await unifiedUserService.getAutomationRulesBySession(sessionId); // → getAutomationRules(email)
```

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
- **Required Scopes**: 
  ```typescript
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email', // 사용자 이메일 접근 권한
  ];
  ```

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
| **Account Data** | Google email-based KV keys | Google email-based KV keys |

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

#### Automation API Routes
- Create rule: `POST /api/automation/rules`
- List rules: `GET /api/automation/rules`
- ~~Webhook trigger~~ (removed - now uses direct SMS integration)
- ~~Manual webhook test~~ (removed - direct SMS integration replaces webhooks)

#### Message Variable System
- Template format: `#{columnName}` (e.g., `#{고객명}`, `#{주문번호}`)
- Runtime substitution with actual row data from Google Sheets
- Example: `#{고객명}님, 주문해주셔서 대단히 감사합니다.` → `1번 고객님, 주문해주셔서 대단히 감사합니다.`

### API Route Patterns
- Date-based sheets: `/api/sheets/date/:date` (YYYYMMDD format)
- Staff-grouped data: `/api/sheets/date/:date/by-staff`
- Individual staff data: `/api/sheets/date/:date/staff/:staffName`
- Status updates: `PUT /api/sheets/data/:date/status`
- Automation rules: `GET /api/automation/rules`, `POST /api/automation/rules`
- Mock endpoints available in development mode

## Development Guidelines

### Project Coding Rules
**IMPORTANT**: All development work must follow these comprehensive guidelines:

#### Communication Standards
- **Korean responses**: All explanations and responses in Korean
- **English comments**: All code comments in English only

#### SOLID Principles
All code must strictly follow SOLID principles:
- **SRP**: Single responsibility per class/module
- **OCP**: Open for extension, closed for modification
- **LSP**: Substitutable subclasses without breaking functionality
- **ISP**: Small, focused interfaces over large ones
- **DIP**: Depend on abstractions, not concrete implementations

#### Critical Development Rules
- **Code Comments**: Update comments when modifying code
- **Feature Duplication**: Always check if feature already exists before adding
- **Session Management**: Server-side only (KV storage), never local storage
- **Task Tracking**: Update tasks.md when completing todos

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
- **Service Architecture**:
  - **Global UnifiedUserService**: ALWAYS use `c.get('unifiedUserService')` instead of creating new instances
  - **Variables Interface**: All new route files must include Variables type in Hono declaration
  - **Unified Storage**: All data stored in `unified_user:${emailHash}` keys, sessions only store metadata
  - **Session Delegation**: Session-based methods automatically delegate to unified storage via email lookup
- **Authentication Security**: 
  - **Local Storage Prohibition**: All session management server-side only (local storage session 사용 금지)
  - **httpOnly Cookies**: Prevent XSS attacks by using httpOnly cookies for admin sessions
  - **QR Token Validation**: Always verify JWT token scope matches requested staff/date
  - **Cross-Device Authentication**: Support QR access from mobile devices without admin sessions
  - **Account-Based Storage**: Use Google email as primary key for persistent data storage

## Common Patterns

### Status Update Flow (With Direct SMS Integration)
1. User clicks status button in StaffMobileView
2. `updateOrderStatus()` sends PUT request to `/api/sheets/data/:date/status`
3. Backend updates Google Sheets via GoogleSheetsService
4. **Direct SMS Integration**: `checkAndSendAutomationSMS()` immediately processes automation rules
   - Retrieves all users with automation rules from `automation_users_index`
   - Checks rules matching the status change (e.g., "배송 완료")
   - Sends SMS/LMS directly via SOLAPI API (bypasses webhooks)
   - Auto-detects SMS vs LMS based on message byte length
5. Frontend calls `loadDeliveryData()` to refresh from server
6. UI updates with new status and appropriate button states

### Automation Rule Management Flow
1. Admin creates automation rule in AdminView
2. Rule stored with Google account email as owner identifier
3. Rules persist for 1 year regardless of session expiration
4. UI displays all rules with owner email and spreadsheet information
5. Users can manually delete rules they no longer need

### Error Handling
- Google API errors trigger automatic token refresh and retry
- QR token verification includes expiry and staff name validation
- Dynamic header detection falls back to column index if header matching fails
- SOLAPI OAuth token refresh with 30-minute buffer before expiry

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
- `EMAIL_HASH_SALT` (for secure email hashing)
- `JWT_SECRET` (for QR token signing)

### Cross-Domain Cookie Limitations (Cloudflare Workers + Pages)
When using Cloudflare Workers (backend) + Cloudflare Pages (frontend) with different domains:

- **SameSite=Strict 제한사항**: 서로 다른 도메인 간에는 `SameSite=Strict` 설정으로 쿠키 전송 불가
- **Cross-Domain 쿠키 정책**: 브라우저 보안 정책으로 인해 서로 다른 도메인의 쿠키는 자동으로 차단됨
- **해결 방안**: 
  - `SameSite=None; Secure` 설정 사용 (HTTPS 필수)
  - 또는 동일 도메인/서브도메인 구조로 배포 권장
  - JWT 토큰 기반 헤더 인증 방식 활용 고려

## Development Workflow

### Getting Started
1. **Clone and Setup**:
   ```bash
   git clone [repository-url]
   cd deliver_mgmt
   npm install
   cd backend-hono && npm install
   cd ../frontend && npm install
   ```

2. **Environment Configuration**:
   ```bash
   # backend-hono/.env
   cp backend-hono/.env.example backend-hono/.env
   # Add your Google OAuth, SOLAPI credentials, and JWT_SECRET
   ```

3. **Development Server**:
   ```bash
   # From root directory - runs both servers concurrently
   npm run dev
   # Backend: http://localhost:5001
   # Frontend: http://localhost:5173
   ```

### Key Development Principles
- **Never modify ports**: Frontend (5173) and backend (5001) ports are fixed
- **Always use UnifiedUserService**: Access via `c.get('unifiedUserService')` in route handlers
- **Session-based storage**: All user data stored with Google email as primary key
- **QR Authentication**: JWT tokens with 24-hour expiry, staff name validation
- **Direct SMS**: Status updates trigger immediate SMS sending (no webhook dependency)

### Testing
- **E2E**: Use MCP Playwright tools, NOT `npx playwright test`
- **Unit**: Run via `npm test` in respective directories
- **Manual**: Access `http://localhost:5173/test` for development testing

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

## Recent Architectural Improvements

### Direct SMS Integration (2025)
**Problem**: Google Apps Script `onChange` triggers don't reliably detect API-based spreadsheet changes, causing webhook-based SMS automation to fail when delivery staff update status via mobile interface.

**Solution**: Complete replacement of webhook system with direct SMS integration:
- **Direct Integration**: SMS sent immediately after Google Sheets status updates in `/api/sheets/data/:date/status` endpoint
- **Auto Message Type**: Automatic SMS/LMS selection based on message byte length (90+ bytes → LMS)
- **Template Variables**: Full support for `#{columnName}` variable substitution
- **Error Isolation**: SMS failures don't block status updates
- **Performance**: Eliminates webhook roundtrip and external trigger dependencies

**Key Changes**:
```typescript
// sheets.ts - After successful status update
await checkAndSendAutomationSMS(env, unifiedUserService, spreadsheetId, sheetName, rowIndex, status, sheetsService);
```

**Files Modified**:
- `backend-hono/src/routes/sheets.ts`: Added direct SMS integration after status updates
- `backend-hono/src/routes/automation.ts`: Removed obsolete `/trigger` webhook endpoint
- Webhook endpoints cleaned up, reducing backend complexity

### Unified Storage Migration (2025)
**Problem**: Automation rules were stored separately in session storage and unified storage, causing webhooks to fail because they couldn't find rules in unified storage while session-based APIs worked correctly.

**Solution**: Complete migration to unified storage with session delegation:
- **Unified Storage**: All user data (Google tokens, SOLAPI tokens, automation rules) stored in `unified_user:${emailHash}`
- **Lightweight Sessions**: Sessions only store metadata (`email`, `sessionId`, `createdAt`) with 1-day TTL
- **Automatic Delegation**: Session-based methods (`getSessionBasedUserData`, `addAutomationRuleBySession`) automatically delegate to unified storage
- **Webhook Compatibility**: Webhooks now successfully find automation rules in unified storage

**Key Changes**:
```typescript
// Before: Dual storage causing webhook failures
session_user:${sessionId} → { googleTokens, solapiTokens, automationRules }  // Used by APIs
unified_user:${emailHash} → { empty or incomplete data }  // Used by webhooks

// After: Single source of truth
session_user:${sessionId} → { email, sessionId, createdAt }  // Metadata only
unified_user:${emailHash} → { googleTokens, solapiTokens, automationRules, ... }  // All data
```

**Files Modified**:
- `backend-hono/src/services/unifiedUserService.ts`: Updated session methods to delegate to unified storage
- Session-based methods now extract email from session and operate on unified storage

**Testing Verification**: Webhooks now successfully trigger automation rules and send SMS messages via SOLAPI integration.

## Current Development Status

### Architecture Status
- **Backend**: Hono-based Cloudflare Workers architecture (stable)
- **Authentication**: Dual system (Google OAuth + QR tokens) implemented
- **Storage**: Unified user data architecture with session delegation
- **SMS Integration**: Direct SOLAPI integration (no webhook dependency)
- **Testing**: Playwright E2E test suite available

### UnifiedUserService Refactoring (2024)
**Problem**: Multiple instances of UnifiedUserService were being created per request (21+ instances), causing performance degradation and potential memory issues.

**Solution**: Implemented global middleware pattern across all routes:
- **Global Middleware**: Each route now uses middleware to provide single UnifiedUserService instance per request
- **TypeScript Safety**: Added Variables interface for type-safe context access
- **Performance**: Reduced service instantiation from 21+ per request to 1 per request

**Files Modified**:
- `src/types/index.ts`: Added Variables interface with unifiedUserService
- `src/routes/{auth,solapi,automation}.ts`: Added global middleware and converted to context-based access
- `src/services/automationService.ts`: Fixed variable scoping issues
- `src/local.ts`: Enhanced KV namespace compatibility for development

**Security Verification**: The global pattern maintains request-scoped isolation - each HTTP request receives its own service instance with proper environment and session context, ensuring no cross-request data leakage.

## Google Sheets Webhook System

### Critical Implementation Details
The system uses Google Apps Script to trigger webhooks when spreadsheet data changes. **Two types of triggers** are required for complete coverage:

- **`onEdit` Trigger**: Detects manual user edits in the spreadsheet UI
- **`onChange` Trigger**: Detects API-based changes (from mobile staff interface)

**Key Files**:
- `googleSheetWebhook.js`: Complete webhook library with dual trigger support
- Setup function: `setupWebhookLibrary(webhookUrl, options)`

**Webhook Payload Structure**:
```javascript
{
  sheetName: "시트1",
  spreadsheetName: "20250901", 
  spreadsheetId: "1Xb0jJIAl1VO8e6vhPifnr-XX2Jo03bGZHwaYzMut7WU",
  columnName: "배송상태",
  rowIndex: 4,
  oldValue: "배송 준비중",
  newValue: "배송 완료",
  rowData: { /* complete row data with headers as keys */ }
}
```

### QR Authentication Fix (2025)
**Problem**: Staff QR token access was failing because the admin session lookup logic was incorrect for the unified storage architecture.

**Root Cause**: QR token authentication was looking for `accessToken` directly in session data, but the unified storage architecture stores tokens in `googleTokens` nested object.

**Solution**: Updated QR token authentication to use UnifiedUserService for proper admin session lookup:

```typescript
// OLD: Incorrect session structure assumption
if (parsed.accessToken && parsed.refreshToken) { /* ... */ }

// NEW: Proper unified storage access
const userData = await unifiedUserService.getUserData(sessionMetadata.email);
if (userData && userData.googleTokens?.accessToken && userData.googleTokens?.refreshToken) { /* ... */ }
```

**Files Modified**:
- `backend-hono/src/routes/sheets.ts`: Updated QR token admin session lookup logic
- Both staff data access and status update endpoints fixed

**Testing Verification**: QR tokens now work correctly for mobile staff access without requiring Google authentication on the mobile device.

### Direct SMS Integration (2025)
**Problem**: Staff status updates were relying on Google Apps Script webhooks, which had reliability issues and added unnecessary complexity.

**Solution**: Implemented direct SMS sending after status updates, bypassing webhook system:

**Key Implementation**:
```typescript
// In sheets.ts status update endpoint
await checkAndSendAutomationSMS(
  c.env, unifiedUserService, date, rowIndex, statusColumn.name, status
);

// Direct SOLAPI integration
async function sendSMSForRule(env: any, userData: any, rule: any, rowData: any, newStatus: string) {
  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userData.solapiTokens.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        type: messageByteSize > 90 ? 'LMS' : 'SMS', // Auto-detect based on length
        from: rule.actions.senderNumber,
        to: recipientNumber,
        text: processedMessage
      }
    })
  });
}
```

**Benefits**:
- **Reliability**: Direct integration eliminates webhook dependency
- **Performance**: Immediate SMS sending without external webhook delays
- **Auto-detection**: SMS/LMS type automatically determined by message length
- **Unified Storage**: All automation rules stored in unified storage for consistency

**Files Modified**:
- `backend-hono/src/routes/sheets.ts`: Added direct SMS integration to status update endpoint
- Status updates now trigger automation rules immediately without webhook dependency

**Testing Verification**: SMS messages are sent immediately after status updates, with automatic SMS/LMS type detection based on message length.

### Webhook Trigger Coverage Fix (2025)
**Problem**: Mobile staff status updates (via API) were not triggering webhooks, only manual spreadsheet edits worked.

**Root Cause**: Google Apps Script `onEdit` triggers only fire for manual UI edits, not API changes.

**Solution**: Added dual trigger system with `onChange` trigger that detects API-based modifications:

```javascript
// Create both triggers during setup
ScriptApp.newTrigger('onEditInstallable').onEdit().create();
ScriptApp.newTrigger('onChangeInstallable').onChange().create();
```

**Key Functions Added**:
- `onChangeInstallable()`: Handles API-triggered changes 
- `checkSheetForChanges_()`: Compares current sheet state with stored snapshots

**Note**: This approach has been superseded by the direct SMS integration for better reliability.