const defaultApiBaseUrl = "https://flavored-flint-hardcore.ngrok-free.dev";

async function settings(): Promise<{ apiBaseUrl: string; helperToken?: string }> {
  const stored = await chrome.storage.local.get(["apiBaseUrl", "helperToken"]);
  return {
    apiBaseUrl: typeof stored.apiBaseUrl === "string" && stored.apiBaseUrl ? stored.apiBaseUrl.replace(/\/$/, "") : defaultApiBaseUrl,
    helperToken: typeof stored.helperToken === "string" ? stored.helperToken : undefined
  };
}

function helperUrl(apiBaseUrl: string, route: string): string {
  const url = new URL(apiBaseUrl);
  const prefix = url.hostname === "127.0.0.1" || url.hostname === "localhost" ? "" : "/api";
  return `${apiBaseUrl}${prefix}/v1/helper/${route}`;
}

async function heartbeat(): Promise<void> {
  const config = await settings();
  if (!config.helperToken) {
    await chrome.storage.local.set({ lastStatus: "Helper token is required." });
    return;
  }
  const response = await fetch(helperUrl(config.apiBaseUrl, "heartbeat"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-helper-token": config.helperToken },
    body: JSON.stringify({ helperId: "local-browser-extension", status: "LOCAL_CAPTURE_READY", message: "User-triggered capture only." })
  });
  await chrome.storage.local.set({ lastStatus: response.ok ? "Connected" : `Heartbeat failed: ${response.status}` });
}

async function activeTabCapture(): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("NO_ACTIVE_TAB");
  return chrome.tabs.sendMessage(tab.id, { type: "POKEDAD_CAPTURE_VISIBLE_SIGNAL" });
}

async function saveSignal(signal: unknown): Promise<unknown> {
  const config = await settings();
  if (!config.helperToken) throw new Error("HELPER_TOKEN_REQUIRED");
  const response = await fetch(helperUrl(config.apiBaseUrl, "signals"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-helper-token": config.helperToken },
    body: JSON.stringify(signal)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`SAVE_FAILED_${response.status}`);
  return result;
}

chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ lastStatus: "Installed: explicit local capture only.", safetyLevel: "USER_TRIGGERED" }));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = message?.type === "POKEDAD_HEARTBEAT"
    ? heartbeat().then(() => ({ ok: true }))
    : message?.type === "POKEDAD_CAPTURE_ACTIVE_TAB"
      ? activeTabCapture()
      : message?.type === "POKEDAD_SAVE_SIGNAL"
        ? saveSignal(message.signal).then((result) => ({ ok: true, result }))
        : null;
  if (!task) return false;
  task.then(sendResponse).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "REQUEST_FAILED" }));
  return true;
});
