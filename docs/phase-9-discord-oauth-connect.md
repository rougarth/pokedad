# Phase 9: Discord OAuth Connect

## What it does

Discord Connect uses Discord's official OAuth2 authorization-code flow with the `webhook.incoming` scope. Discord shows its own authorization screen, where the user selects the server and channel. PokeDad Radar receives the resulting incoming webhook and connects it to the existing encrypted alert delivery system.

No Discord username or password is requested or stored.

## Discord Developer Portal setup

1. Create or select an application in the official Discord Developer Portal.
2. Open the application's OAuth2 settings.
3. Add this redirect URI exactly:

   ```text
   http://127.0.0.1:4000/discord/oauth/callback
   ```

4. Save the application's client ID and client secret only in the local environment files.

Official OAuth2 documentation: https://docs.discord.com/developers/topics/oauth2#webhooks

## Local configuration

Add these values to both `.env` and `apps/api/.env`:

```env
DISCORD_CLIENT_ID="your-application-client-id"
DISCORD_CLIENT_SECRET="your-local-client-secret"
DISCORD_REDIRECT_URI="http://127.0.0.1:4000/discord/oauth/callback"
```

Restart the API after editing the environment. When any required value is missing, the app remains healthy and the Alerts page shows a setup-needed message.

## Connect

1. Sign in to PokeDad Radar.
2. Open **Alerts**.
3. Select **Connect Discord**.
4. Discord displays its official authorization screen.
5. Choose the destination server and channel and approve the `webhook.incoming` scope.
6. Discord returns to the configured callback, and PokeDad Radar redirects back to **Alerts**.

OAuth state is random, signed in an HttpOnly SameSite cookie, bound to the logged-in local user, limited to ten minutes, compared in constant time, and cleared after callback handling.

## Secret storage

The OAuth access and refresh tokens are discarded immediately. The resulting webhook ID/token is converted into a Discord webhook URL and encrypted through the existing AES-256-GCM `EncryptedSecret` service. PostgreSQL stores ciphertext, IV, authentication tag, and key version. Frontend responses contain only masked configuration and non-secret guild/channel identifiers.

## Test and disconnect

- **Send Test Alert** uses the existing Discord provider and records normal alert delivery status.
- **Disconnect** attempts to remove the remote Discord webhook, deletes the local alert channel, and deletes its encrypted secret reference and safe metadata.
- Accepted-price alerts, duplicate suppression, and cooldown rules are unchanged.

## Troubleshooting

- **Setup needed:** verify all three `DISCORD_*` variables and restart the API.
- **Redirect mismatch:** the Developer Portal redirect URI must exactly match `http://127.0.0.1:4000/discord/oauth/callback`.
- **Invalid state:** restart the connection from the Alerts page; OAuth state expires after ten minutes and is single-use.
- **Authorization denied:** reconnect and select a server/channel where incoming webhooks are permitted.
- **Test failed:** review the sanitized last-error status. The webhook URL and provider tokens are never shown.

## Safety

- No Discord passwords, plaintext webhooks, OAuth tokens, or client secrets are stored or logged.
- No retailer credentials, cookies, sessions, payment data, card data, or CVV are stored.
- No checkout, add-to-cart, auto-purchase, CAPTCHA bypass, queue bypass, waiting-room bypass, rate-limit bypass, anti-bot bypass, login-protection bypass, or purchase-limit bypass exists.
- Retailer behavior remains open-product/open-cart/manual only.
