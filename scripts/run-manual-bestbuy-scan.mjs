import { readFileSync } from "node:fs";

function readLocalEnv(key) {
  for (const path of ["apps/api/.env.ngrok", ".env.ngrok"]) {
    try {
      const line = readFileSync(path, "utf8").split(/\r?\n/).find((value) => value.startsWith(`${key}=`));
      if (line) return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, "");
    } catch {
      // Try the next local environment file.
    }
  }
  return process.env[key];
}

const baseUrl = (readLocalEnv("PUBLIC_APP_URL") || "https://flavored-flint-hardcore.ngrok-free.dev").replace(/\/$/, "");
const email = readLocalEnv("ADMIN_EMAIL");
const password = readLocalEnv("ADMIN_PASSWORD");

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured locally.");
}

async function request(path, options = {}, cookie = "") {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(cookie ? { cookie } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const login = await request("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
if (!login.response.ok) throw new Error(`Login failed (${login.response.status}).`);

const cookie = login.response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
if (!cookie) throw new Error("Login succeeded but no session cookie was returned.");

const readiness = await request("/adapters/best-buy/manual-readiness", {
  method: "POST",
  body: "{}"
}, cookie);

const ready = readiness.body.readiness ?? {};
console.log(JSON.stringify({
  login: "PASS",
  configured: Boolean(ready.configured),
  readinessStatus: ready.status ?? "UNKNOWN",
  ready: Boolean(ready.ready),
  schedulerStopped: Boolean(ready.schedulerStopped),
  redisReady: Boolean(ready.redisReady)
}));

if (!ready.ready || !ready.readinessToken) {
  console.log(JSON.stringify({ scan: "NOT_RUN", reasons: Array.isArray(ready.reasons) ? ready.reasons : [] }));
  process.exit(2);
}

const scan = await request("/adapters/best-buy/run-scan", {
  method: "POST",
  body: JSON.stringify({
    readinessToken: ready.readinessToken,
    confirmReadOnly: true,
    approvalConfirmed: true,
    confirmationText: "RUN ONE READ-ONLY SCAN"
  })
}, cookie);

const state = scan.body.scanStatus ?? {};
console.log(JSON.stringify({
  scan: scan.response.ok ? "PASS" : "FAILED",
  httpStatus: scan.response.status,
  status: state.status ?? "UNKNOWN",
  requestCount: state.lastRequestCount ?? 0,
  productsChecked: state.lastProductsCheckedCount ?? 0,
  matches: state.lastMatchCount ?? 0,
  accepted: state.lastAcceptedCount ?? 0,
  overLimit: state.lastOverLimitCount ?? 0,
  unknownMsrp: state.lastUnknownMsrpCount ?? 0,
  alerts: state.lastAlertCount ?? 0,
  error: typeof scan.body.error === "string" ? scan.body.error : null
}));

process.exit(scan.response.ok ? 0 : 1);
