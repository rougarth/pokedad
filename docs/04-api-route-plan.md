# API Route Plan

All API routes are under `/api/v1`.

## Auth

- `POST /auth/login`: create dashboard session.
- `POST /auth/logout`: destroy dashboard session.
- `GET /auth/me`: return current user.
- `POST /auth/change-password`: rotate dashboard password.
- `GET /auth/sessions`: list dashboard sessions.
- `DELETE /auth/sessions/:id`: revoke a session.

## Stores

- `GET /stores`: list stores and session status.
- `POST /stores`: create a custom store.
- `PATCH /stores/:id`: update monitoring, cart assist, seller policy, and price tolerance.
- `POST /stores/:id/test-session`: request helper-side session test.
- `POST /stores/:id/open-login`: request helper to open login page.
- `POST /stores/:id/monitoring/enable`
- `POST /stores/:id/monitoring/disable`

## Radar Rules

- `GET /rules/watch`
- `POST /rules/watch`
- `PATCH /rules/watch/:id`
- `DELETE /rules/watch/:id`

## Price Rules

- `GET /price/msrp`
- `POST /price/msrp`
- `PATCH /price/msrp/:id`
- `DELETE /price/msrp/:id`
- `GET /price/rules`
- `POST /price/rules`
- `PATCH /price/rules/:id`
- `DELETE /price/rules/:id`
- `POST /price/evaluate`: dry-run a candidate listing through the price engine.

## Live Finds

- `GET /finds/live`: current live finds.
- `GET /finds/stream`: SSE stream for live dashboard updates.
- `POST /finds/:id/ignore`
- `POST /finds/:id/mark-bought`
- `POST /finds/:id/snooze`
- `POST /finds/:id/open-product`: helper request.
- `POST /finds/:id/open-cart`: helper request.

## Cart Queue

- `GET /cart-queue`
- `POST /cart-queue/:id/retry`: only when safe and adapter allows retry.
- `POST /cart-queue/:id/stop`
- `POST /cart-queue/:id/open-cart`
- `POST /helper/cart-attempts/:id/status`: helper callback with sanitized status.

## Alerts

- `GET /alerts/channels`
- `POST /alerts/channels`
- `PATCH /alerts/channels/:id`
- `DELETE /alerts/channels/:id`
- `POST /alerts/channels/:id/test`
- `GET /alerts/events`

## History

- `GET /history/finds`
- `GET /history/cart-attempts`
- `GET /history/alerts`

## Security

- `GET /security/audit-logs`
- `GET /security/secrets`
- `PUT /security/secrets/:name`
- `DELETE /security/secrets/:name`
- `POST /security/export`
- `DELETE /security/app-data`: requires confirmation.

## Helper API

Helper endpoints are authenticated with a separate local helper token.

- `POST /helper/register`
- `POST /helper/heartbeat`
- `GET /helper/commands`
- `POST /helper/commands/:id/complete`
- `POST /helper/session-status`
- `POST /helper/cart-attempts/:id/status`

The helper API must reject payloads containing cookies, passwords, tokens, card data, or CVV-shaped fields.

