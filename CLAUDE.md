# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A Google Sheets-based delivery management system (MVP) that allows managers to manage orders via Google Spreadsheets and delivery staff to access their assignments through QR codes with name verification. Customer notifications are sent only upon delivery completion via SOLAPI KakaoTalk integration.

## Technology Stack (Planned)
- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: Vue.js 3 (Composition API) + Vite + Vuetify 3
- **State Management**: Pinia
- **Authentication**: Google OAuth2 + SOLAPI OAuth2
- **Data Storage**: Google Sheets as primary data store
- **Messaging**: SOLAPI for KakaoTalk notifications
- **QR Generation**: qrcode library
- **Logging**: Winston

## Project Structure (To Be Created)
```
deliver_mgmt/
├── backend/                 # Node.js Express API server
│   ├── src/
│   │   ├── routes/         # API routes (/api/auth, /api/sheets, /api/solapi, /api/delivery)
│   │   ├── services/       # Google Sheets, SOLAPI services
│   │   ├── middleware/     # Authentication, CORS, logging
│   │   └── utils/          # QR generation, JWT helpers
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Vue.js 3 SPA
│   ├── src/
│   │   ├── components/     # Admin settings, delivery UI components
│   │   ├── views/          # Admin dashboard, delivery staff interface
│   │   ├── stores/         # Pinia state management
│   │   └── router/         # Vue Router configuration
│   ├── package.json
│   └── vite.config.ts
└── docs/                   # Additional documentation
```

## Key Architecture Concepts

### Authentication Flow
- **Google OAuth2**: For spreadsheet access and admin authentication
- **SOLAPI OAuth2**: For KakaoTalk message sending permissions
- **QR + Name Verification**: Two-step authentication for delivery staff
  1. QR scan with URL format: `?staff=김배달&token=HASH_TOKEN`
  2. Name input verification (must match sheet name exactly)

### Data Model
- **Primary Data Store**: Google Sheets with separate sheets per delivery staff
- **Sheet Structure**: A:Customer Name | B:Phone | C:Address | D:Delivery Status
- **Status Values**: "대기" → "준비중" → "출발" → "완료"
- **Notification Trigger**: Only on "완료" status (delivery complete)

### API Structure (Planned)
```
/api/auth/*          # OAuth2 authentication (Google + SOLAPI)
/api/sheets/*        # Google Sheets management
/api/solapi/*        # SOLAPI integration and messaging
/api/delivery/*      # Delivery management (QR, status updates)
```

## Development Commands (To Be Set Up)

### Backend Development
```bash
cd backend
npm install
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run test         # Run Jest tests
npm run lint         # ESLint
npm run typecheck    # TypeScript checking
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # ESLint
npm run typecheck    # Vue TypeScript checking
```

## Important Implementation Notes

### Security Requirements
- QR tokens must use hash-based security: `HASH(sheet_name + secret_key + date)`
- OAuth2 tokens must be stored securely (backend only)
- Name verification must be case-sensitive and exact match
- Each delivery staff can only access their own sheet

### Korean Language Requirements
- All user-facing text should be in Korean
- Code comments should be in English
- API responses and error messages in Korean
- Customer notification messages in polite Korean

### Mobile Optimization
- PWA configuration for mobile app-like experience
- Touch-friendly UI components
- Responsive design for all screen sizes
- Support for both portrait and landscape orientations

### Integration Requirements
- Real-time synchronization with Google Sheets (polling or WebSocket)
- SOLAPI message sending only on delivery completion
- Template management for KakaoTalk messages
- Comprehensive error handling and retry logic

## Development Priorities
1. **Phase 1**: Admin settings UI, Google OAuth, SOLAPI OAuth2, basic sheet operations
2. **Phase 2**: QR system, delivery staff interface, status updates
3. **Phase 3**: Message sending, real-time sync, mobile optimization

## Key Files to Reference
- `prd.md`: Detailed product requirements and specifications
- `tasks.md`: Comprehensive development task checklist
- `.claude.json`: Project coding guidelines and SOLID principles

- todo 완료 될때마다 tasks.md 업데이트