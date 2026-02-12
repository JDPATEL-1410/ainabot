# YourApp - WhatsApp Business Messaging Platform (SaaS)

## Problem Statement
Build a multi-tenant web application enabling businesses to connect WhatsApp Business, send/receive messages, manage contacts/conversations/teams, use templates/broadcasts/campaigns, automate replies, integrate via API + webhooks, and manage billing per workspace.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui + Recharts (dark "Obsidian Command Center" theme)
- **Backend**: FastAPI (Python) with modular routes (auth, inbox, messaging, admin, billing, extras)
- **Database**: MongoDB (motor async driver)
- **Auth**: JWT (email/password) with password change support
- **Billing**: Stripe (emergentintegrations library, test key)
- **WhatsApp**: MOCKED (simulated embedded signup + messaging)

## User Personas
- **Owner**: Full access (billing, settings, all features)
- **Admin**: Templates, automations, campaigns, team management
- **Agent**: Inbox, contacts, assigned conversations
- **Viewer**: Read-only analytics

## Core Requirements (Static)
1. Multi-tenant workspaces with RBAC
2. WhatsApp embedded signup (mocked for MVP)
3. Message inbox with real-time polling (send/receive)
4. Contacts + tags + CSV import/export
5. Template management + submission/approval
6. Broadcast campaigns with analytics + confirmation dialogs
7. Basic automation rules (triggers + actions)
8. Billing (trial + Starter/Pro/Enterprise plans via Stripe)
9. API keys + webhook endpoints
10. Super admin panel
11. Plan enforcement (message limits, agent limits, trial expiry)
12. Audit logging for sensitive actions
13. Security: password change, RBAC enforcement
14. Quick replies for agent efficiency
15. Conversation notes (internal)

## What's Been Implemented (Feb 2026)

### Iteration 1 - MVP
- Full auth system (register, login, JWT)
- Workspace creation with demo data seeding
- 12 frontend pages with dark theme
- All CRUD endpoints for contacts, conversations, templates, campaigns, automations
- Stripe billing integration
- WhatsApp mocked connection
- Testing: 25/25 backend, 100% frontend

### Iteration 2 - Production Hardening
- Plan/trial enforcement on key actions (send, invite, campaigns)
- Audit logging on workspace creation, templates, campaigns, WhatsApp connect, password change
- Password change endpoint + Security tab in Settings
- Contact CSV export
- Conversation notes (internal notes per conversation)
- Quick replies management
- Dashboard with Recharts charts (message activity area chart, usage meters, campaign performance)
- Inbox auto-refresh polling (5s interval)
- Confirmation dialog for campaign sends
- Usage meters in Billing page
- Unread message badge in sidebar (10s polling)
- Error boundary component
- Testing: 38/38 backend (100%), 95% frontend

### Current File Structure
Backend:
- /app/backend/server.py - Main FastAPI app
- /app/backend/helpers.py - JWT, auth, utilities
- /app/backend/routes/auth.py - Auth + Workspace + Team (12 endpoints)
- /app/backend/routes/inbox.py - Contacts + Conversations + Messages (11 endpoints)
- /app/backend/routes/messaging.py - Templates + Campaigns + WhatsApp (10 endpoints)
- /app/backend/routes/admin.py - Automations + Settings + Dashboard + Admin (15 endpoints)
- /app/backend/routes/billing.py - Stripe billing (5 endpoints)
- /app/backend/routes/extras.py - Audit logs + Password + Export + Notes + Quick Replies + Analytics (10 endpoints)

Frontend:
- /app/frontend/src/App.js - Router with error boundary
- /app/frontend/src/pages/ - 12 pages (Login, Signup, Setup, Dashboard, Inbox, Contacts, Templates, Campaigns, Automations, Team, Settings, Billing, Admin)
- /app/frontend/src/components/ - Sidebar, Layout, ErrorBoundary
- /app/frontend/src/contexts/AuthContext.js - Auth state management
- /app/frontend/src/lib/api.js - Axios API client

## Prioritized Backlog

### P0 (Critical - Next Sprint)
- Real WhatsApp Cloud API integration (replace mocks with Meta credentials)
- Webhook event processing (inbound messages, delivery status updates)
- WebSocket/SSE for true real-time inbox updates (replace polling)
- Message media support (images, PDFs, audio, video)

### P1 (Important)
- Trial expiry hard enforcement (read-only mode after expiry)
- Stripe subscription auto-renewal and cancellation
- Contact CSV mapping in campaigns
- Template variables mapping UI
- Agent assignment round-robin in automations
- OTP/MFA authentication option

### P2 (Nice-to-have - Phase 2)
- No-code chatbot/flow builder
- AI replies + summarization (LLM integration)
- CRM integrations (Zoho/HubSpot)
- Advanced analytics + reporting
- Multi-number/multi-WABA support
- SLA timer for conversations
- Mobile responsive optimization
- Data export/GDPR compliance
- IP restrictions
- Status page monitoring

## Next Tasks
1. Integrate real WhatsApp Cloud API (Meta App ID, Secret, Verify Token needed)
2. Implement WebSocket for real-time inbox
3. Add message media upload/download
4. Stripe subscription lifecycle (auto-renew, cancel, downgrade)
5. Template variable mapping in campaign creation
