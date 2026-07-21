# Phase 10: Mobile Alerts and Notification History

## Goal

Phase 10 makes private Discord alerts easier to scan on a phone and adds an authenticated notification history to the dashboard. Telegram uses the same compact text template when connected later.

## Alert Templates

Supported types are accepted price, MSRP match, price dropped into range, unknown MSRP mapping, human review, scan failed, configuration needed, and test alert. Discord receives a compact embed with optional image, MSRP details, availability, price status, and Open Product link. Tests are visibly labeled `TEST ALERT - PokeDad Radar`.

Priorities are `LOW`, `NORMAL`, `HIGH`, and `URGENT`. MSRP matches are urgent, accepted prices are high, review items are normal, and scan/configuration notices are low.

## Notification History

The authenticated `Notification History` page shows event status, priority, product, store, attempted channels, timestamps, and sanitized delivery errors. Filters cover delivery state, provider, priority, today, and the last seven days. Details show the rendered message, product pricing, delivery attempts, and related audit events without channel secrets.

## Preview and Settings

The Alerts page can preview any template against a recent product and optionally send one marked test message. Scan Settings controls compact formatting, product images, MSRP details, and Open Product links. Existing unknown-MSRP and scan-failure delivery settings still determine whether those event types are sent.

## Discord Cleanup

If setup created multiple test webhooks, open Discord Server Settings > Integrations > Webhooks, remove old entries, and keep the latest PokeDad Radar connection.

## Troubleshooting

- `CONFIGURATION_NEEDED`: connect or enable an alert channel.
- `CHANNEL_DISABLED`: enable the selected channel.
- `FAILED`: inspect the sanitized error in Notification History and test the channel once.
- Empty history: change the filter to All or seed the local demo database.

## Safety

Webhook URLs and provider tokens remain AES-256-GCM encrypted and are never returned in history, previews, audits, or UI. Phase 10 adds no cart action, checkout, purchase automation, retailer credential storage, CAPTCHA/queue bypass, or retailer session handling. Product actions remain open-only and manual.
