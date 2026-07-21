# Technical Architecture

## Architecture Summary

PokeDad Radar uses a TypeScript monorepo:

- `apps/web`: Vue 3 dashboard.
- `apps/api`: Fastify API, Prisma ORM, BullMQ workers, WebSocket/SSE events.
- `apps/extension`: browser helper for local session-aware cart assist.
- `packages/shared`: shared domain enums, DTOs, and rule helpers.
- `docs`: planning and implementation notes.

The backend owns durable app data. The browser helper owns browser-session interactions. Retailer credentials, cookies, and session tokens never cross into the backend.

## Major Boundaries

### Dashboard

The dashboard manages private app settings, rules, stores, alerts, live finds, history, and security settings. It does not directly inspect retailer cookies or passwords.

### Backend API

The backend stores:

- Users and hashed dashboard passwords.
- Store settings and high-level session status.
- Product/category/watch rules.
- MSRP and accepted price rules.
- Stock check results.
- Cart-assist attempt metadata.
- Alert channels and encrypted alert tokens.
- Audit logs.

The backend must not store:

- Retailer passwords.
- Retailer cookies.
- Retailer session tokens.
- Credit card numbers.
- CVV.
- Full payment account data.

### Queue Workers

Workers run monitoring jobs through safe adapters. In MVP, the first adapter should be a mock/manual ingestion adapter. Real store adapters should be introduced only after store-specific rules are documented.

Workers publish live events to Redis and the API pushes them to the dashboard by SSE or WebSocket.

### Browser Extension / Local Helper

The helper can:

- Open retailer login pages.
- Open product URLs.
- Open known cart URLs.
- Report coarse session status such as logged in, login needed, queue detected, or human check detected.
- Attempt add-to-cart only when store policy and local adapter rules allow it.

The helper must stop when:

- CAPTCHA is visible.
- Queue or waiting room is detected.
- Login/MFA is required.
- A purchase-limit prompt appears.
- Price changed from the accepted backend price.
- Seller changed from the accepted seller.
- Page state is ambiguous.

## Event Flow

1. Monitor job checks an enabled product/store adapter.
2. Adapter returns normalized `RetailerProduct` and `StockCheckResult` data.
3. Price engine evaluates against `PriceRule` and `ProductMSRP`.
4. Backend writes result and audit log.
5. If accepted, alert service sends notifications.
6. If cart assist is enabled, backend emits a cart-assist request event.
7. Browser helper receives or polls for the request.
8. Helper opens/assists safely using the local browser session.
9. Helper reports final status without sending secrets.
10. Dashboard updates live views.

## Monitoring Adapter Policy

Every adapter must include a policy file documenting:

- Allowed data source.
- Rate limits.
- Whether cart assist is disabled, open-only, or add-to-cart capable.
- Human-check signatures.
- Seller validation rules.
- Price recheck requirements.
- Known manual-only states.

Adapters must prefer official APIs, public product metadata, retailer-provided feeds, or manual/browser-local checks. Fragile or aggressive scraping should be avoided.

## Future Multi-User Path

The schema includes `ownerId` fields and tenant-ready patterns where practical. SaaS/community alerts would require:

- Per-tenant encryption keys or key hierarchy.
- Role-based access controls.
- Explicit alert-sharing consent.
- Store adapter legal review.
- Stronger rate limiting and abuse monitoring.
- Removal or strict gating of cart assist for shared deployments.

