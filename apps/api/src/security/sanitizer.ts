const forbiddenKeyPatterns = [
  /password/i,
  /cookie/i,
  /authorization/i,
  /session.*token/i,
  /access.*token/i,
  /refresh.*token/i,
  /bot.*token/i,
  /chat.*id/i,
  /webhook/i,
  /secret/i,
  /encrypted.*config/i,
  /card.*number/i,
  /credit.*card/i,
  /cvv/i,
  /cvc/i
];

export function assertNoSensitiveKeys(value: unknown, path = "payload"): void {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeyPatterns.some((pattern) => pattern.test(key))) {
      throw new Error(`Sensitive field rejected at ${childPath}`);
    }
    assertNoSensitiveKeys(child, childPath);
  }
}

export function sanitizeForAudit(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForAudit(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (forbiddenKeyPatterns.some((pattern) => pattern.test(key))) {
        return [key, "[REDACTED]"];
      }
      return [key, sanitizeForAudit(child)];
    })
  );
}
