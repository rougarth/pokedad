# Dashboard Page Plan

## 1. Login Page

- Email/password or single-user username/password.
- Secure session cookie.
- Clear error states.
- No social login in MVP.

## 2. Home Dashboard

Key cards:

- Stores connected.
- Active monitors.
- Products found today.
- Cart-ready items.
- Human action needed.
- Overpriced products skipped.
- Last scan time.
- Recent alerts.

## 3. Stores Page

Table columns:

- Store name.
- Login/session status.
- Monitoring enabled.
- Cart assist enabled.
- Seller rule.
- Price tolerance rule.
- Last successful check.
- Last error.

Actions:

- Open store login.
- Test session.
- Enable/disable monitoring.

## 4. Radar Rules Page

Controls:

- Monitor all sealed Pokemon TCG products.
- Category selection.
- New releases toggle.
- Ignore singles.
- Ignore third-party sellers.
- Shipping preferred.
- Pickup preferred.
- Pickup ZIP/radius.
- Quantity wanted per product.
- Max quantity per store/product.

## 5. Price Rules Page

Sections:

- MSRP database by product type.
- Product-specific max prices.
- Store-specific tolerances.
- Category-specific tolerances.
- Membership store exceptions.
- Custom alert thresholds.

## 6. Live Finds Page

Real-time table columns:

- Image.
- Product name.
- Store.
- Price.
- MSRP.
- Accepted max price.
- Seller.
- Stock status.
- Shipping/pickup status.
- Cart assist status.
- Alert status.

Actions:

- Open Product.
- Open Cart.
- Ignore.
- Mark Bought.
- Snooze.

## 7. Cart Queue Page

Status lanes:

- Cart Ready.
- Add to Cart Failed.
- Login Needed.
- Human Check Needed.
- Sold Out.
- Price Changed.
- Quantity Limit.

Actions:

- Open Cart.
- Retry where safe.
- Stop.

## 8. Alerts Page

Channels:

- Telegram.
- Discord webhook.
- SMS.
- Email.
- Browser notification.

Alert types:

- MSRP found.
- Acceptable price found.
- Cart ready.
- Human action needed.
- Login expired.
- Price changed.
- Sold out.
- Error.

## 9. History Page

Filters:

- Date range.
- Store.
- Category.
- Stock status.
- Alert status.
- Cart assist status.
- Skip reason.

Columns:

- Product.
- Store.
- Price.
- MSRP.
- Time found.
- Time sold out.
- Alert sent.
- Cart assist worked.
- Bought marker.
- Skip reason.

## 10. Security Settings Page

Sections:

- Change dashboard password.
- Manage encrypted alert tokens.
- View audit logs.
- Session/device management.
- Clear local/store session references.
- Export/delete app data.

