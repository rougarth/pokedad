# Phase 7: Real Private Alerts

## Goal

Phase 7 delivers private PokeDad Radar alerts through the official Telegram Bot API and Discord incoming webhooks. Alert delivery is one-way and read-only. It does not interact with retailer carts, checkout, accounts, or purchase flows.

## Telegram setup

1. Open the official `@BotFather` account in Telegram and create a bot.
2. Keep the bot token private.
3. Start a conversation with the bot or add it to the private destination chat.
4. Determine the destination chat ID using Telegram's supported bot update tooling.
5. In PokeDad Radar, open **Alerts**, select **Telegram**, and enter the channel name, bot token, and chat ID.
6. Save, then use **Send test alert**.

PokeDad Radar sends HTTPS JSON requests through the Bot API `sendMessage` method. It does not configure an incoming webhook or read chat history.

Official references:

- https://core.telegram.org/bots/features#botfather
- https://core.telegram.org/bots/api#sendmessage

## Discord setup

1. In the private Discord server, open the target channel settings.
2. Create an incoming webhook under Integrations and copy its webhook URL.
3. In PokeDad Radar, open **Alerts**, select **Discord**, and enter the channel name and webhook URL.
4. Save, then use **Send test alert**.

PokeDad Radar executes the incoming webhook with a text payload and disables automatic mentions. It does not install a Discord bot or read server messages.

Official reference: https://docs.discord.com/developers/resources/webhook#execute-webhook

## Secret storage

- Telegram bot tokens, Telegram chat IDs, and Discord webhook URLs are serialized together per channel and encrypted using AES-256-GCM.
- `ENCRYPTION_KEY` must be exactly 32 characters, or `SECRETS_MASTER_KEY_BASE64` must decode to exactly 32 bytes.
- PostgreSQL stores ciphertext, IV, authentication tag, and key version only.
- API reads return a masked configuration label, never decrypted values.
- Replacing credentials creates a new encrypted payload. Saved values are never repopulated into the browser.
- API logging and audit metadata redact secret, token, chat ID, webhook, authorization, cookie, password, and payment fields.

Changing the encryption key makes existing alert channel secrets unreadable. Replace each affected channel configuration after a key change.

## Delivery workflow

1. A qualifying Best Buy result creates an `AlertEvent` after duplicate suppression.
2. If **Send alerts automatically** is enabled, the event is offered to enabled Telegram and Discord channels.
3. Each attempt creates an `AlertDelivery` with `PENDING`, `SENT`, `FAILED`, `SUPPRESSED`, `CHANNEL_DISABLED`, or `CONFIGURATION_NEEDED` status.
4. Provider errors are reduced to a sanitized summary. Delivery does not aggressively retry.
5. Unknown-MSRP and scan-failure alerts remain off by default.

## Troubleshooting

- `CONFIGURATION_NEEDED`: save provider credentials and verify `ENCRYPTION_KEY`.
- Telegram HTTP 400/401/403: verify the bot token, chat ID, and that the bot can message the chat.
- Discord HTTP 401/404: recreate or recopy the incoming webhook URL.
- `CHANNEL_DISABLED`: enable the channel before testing.
- A failed test is persisted with a sanitized error and can be safely retried after correcting configuration.

## Limitations and safety

- Phase 7 supports Telegram and Discord delivery only. Email and browser delivery remain future work.
- Delivery is immediate and conservative; no aggressive retry worker is enabled.
- No retailer credentials, cookies, sessions, card data, CVV, or payment data are stored.
- No add-to-cart, checkout, auto-purchase, CAPTCHA bypass, queue bypass, waiting-room bypass, rate-limit bypass, login-protection bypass, or purchase-limit bypass exists.
