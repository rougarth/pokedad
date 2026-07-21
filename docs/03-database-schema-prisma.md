# Database Schema / Prisma Model Plan

The canonical implementation lives in `apps/api/prisma/schema.prisma`.

## Design Notes

- Retailer session data is represented only as status metadata.
- Sensitive alert tokens are stored encrypted as `EncryptedSecret`.
- `CartAssistAttempt` stores URLs and status metadata, not browser cookies, tokens, or payment data.
- Audit logs are structured but intentionally sanitized.
- `ownerId` is included on user-owned records to keep a future multi-user path open.

## Core Models

- `User`: dashboard account with hashed password.
- `Store`: supported retailer configuration.
- `StoreSessionStatus`: high-level login/session state.
- `ProductCategory`: sealed product category.
- `ProductMSRP`: MSRP by category or product.
- `ProductWatchRule`: what to monitor.
- `PriceRule`: global/store/category/product price tolerance.
- `RetailerProduct`: normalized product listing.
- `StockCheckResult`: a scan result.
- `CartAssistAttempt`: local helper/cart attempt state.
- `AlertChannel`: configured notification channel.
- `AlertEvent`: sent/failed/suppressed alert records.
- `AuditLog`: sanitized action log.
- `AppSetting`: app-wide settings.
- `EncryptedSecret`: encrypted token values and metadata.

## Important Enums

- `StoreSessionState`
- `ProductCategoryKind`
- `SellerPolicy`
- `FulfillmentPreference`
- `StockStatus`
- `CartAssistStatus`
- `AlertChannelType`
- `AlertEventType`
- `AuditAction`
- `SkipReason`

## Indexing Strategy

- Index `RetailerProduct` by `(storeId, externalId)` and product URL.
- Index `StockCheckResult` by `checkedAt`, `storeId`, `stockStatus`, and `accepted`.
- Index `CartAssistAttempt` by `createdAt`, `status`, and `stockCheckResultId`.
- Index `AuditLog` by `createdAt`, `actorUserId`, and `action`.
- Use unique constraints for one MSRP/rule where the domain requires it.

## Migration Strategy

1. Initial Prisma schema.
2. Seed private-use store/category defaults.
3. Add real adapter-specific metadata only after adapter implementation.
4. Keep migration history committed once the database is initialized.

