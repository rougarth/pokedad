# Security Plan

## Data Handling Rules

Never store:

- Credit card numbers.
- CVV.
- Full payment details.
- Retailer passwords.
- Retailer cookies.
- Retailer session tokens.
- Raw browser storage.

Never log:

- Passwords.
- Cookies.
- Tokens.
- Card data.
- Session data.
- Authorization headers.

## Authentication

- Dashboard password hashing: Argon2id preferred, bcrypt acceptable.
- Session cookies: `HttpOnly`, `Secure` in production, `SameSite=Lax` or stricter.
- Helper authentication: separate local helper token, rotatable from Security Settings.
- Future SaaS: add MFA and role-based access controls.

## Secret Storage

- Use a secrets service abstraction.
- Encrypt sensitive alert tokens with AES-256-GCM.
- Master key comes from environment variable only.
- Store IV and auth tag alongside ciphertext.
- Support key rotation with key version metadata.

## Logging

- Structured audit logs for:
  - Login success/failure.
  - Password changes.
  - Alert channel changes.
  - Monitor changes.
  - Cart-assist attempts.
  - Human-check stop states.
  - Data export/delete actions.

Logs must be sanitized before write.

## Input Validation

- Validate every API payload with schemas.
- Reject payloads containing forbidden key names such as `password`, `cookie`, `authorization`, `cvv`, `cardNumber`, or `sessionToken` except in explicitly allowed dashboard auth endpoints.
- Normalize prices with integer cents.

## Network Controls

- Rate limit login and helper endpoints.
- Restrict CORS to configured dashboard origins.
- Use HTTPS in non-local deployments.
- Disable verbose errors in production.

## Cart Assist Safety

- The backend stores only command metadata and status.
- Helper must re-check seller and price before assist.
- Helper must stop on CAPTCHA, queue, waiting room, login/MFA, purchase-limit prompts, or ambiguous UI.
- No checkout automation exists in the system.

