# MVP Development Roadmap

## Phase 0: Foundation

- Create monorepo scaffold.
- Add docs, shared domain types, Prisma schema, and environment examples.
- Add Docker Compose for PostgreSQL and Redis.
- Add safe mock/manual monitor adapter.

## Phase 1: Private Dashboard Core

- Implement dashboard auth.
- Implement store settings.
- Implement watch rules.
- Implement MSRP and price rules.
- Implement history tables.
- Implement SSE live updates.

## Phase 2: Alerts

- Add encrypted alert channel secrets.
- Add Telegram, Discord, email, SMS, and browser-notification channel abstractions.
- Add alert-event history.
- Add test alert actions.

## Phase 3: Helper MVP

- Add Manifest V3 extension shell.
- Implement helper registration and heartbeat.
- Implement open login/product/cart commands.
- Implement generic stop-state detection.
- Keep real stores open-only by default.

## Phase 4: Safe Store Adapters

- Implement one store at a time.
- Start with read-only public listing checks where permitted.
- Document adapter policy before enabling.
- Add price/seller recheck before any add-to-cart attempt.
- Keep CAPTCHA/queue/login/manual prompts as stop states.

## Phase 5: Hardening

- Add test coverage for price logic, sanitizer, secret encryption, and cart-assist state transitions.
- Add dashboard security settings.
- Add data export/delete.
- Add deployment notes.

## Phase 6: Future Community/SaaS Exploration

- Separate tenants.
- Add RBAC and MFA.
- Add stronger abuse controls.
- Add legal/policy review for each adapter.
- Consider community alerts without cart assist.

