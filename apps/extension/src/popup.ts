const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const previewElement = document.querySelector<HTMLPreElement>("#preview");
const captureButton = document.querySelector<HTMLButtonElement>("#capture");
const saveButton = document.querySelector<HTMLButtonElement>("#save");
const settingsButton = document.querySelector<HTMLButtonElement>("#save-settings");
const tokenInput = document.querySelector<HTMLInputElement>("#helper-token");
const apiInput = document.querySelector<HTMLInputElement>("#api-base-url");
let pendingSignal: unknown;

function setStatus(message: string): void {
  if (statusElement) statusElement.textContent = message;
}

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get(["apiBaseUrl", "helperToken", "lastStatus"]);
  if (apiInput) apiInput.value = typeof stored.apiBaseUrl === "string" ? stored.apiBaseUrl : "https://flavored-flint-hardcore.ngrok-free.dev";
  if (tokenInput) tokenInput.value = "";
  setStatus(typeof stored.lastStatus === "string" ? stored.lastStatus : "Ready for explicit capture.");
}

settingsButton?.addEventListener("click", async () => {
  const updates: { apiBaseUrl?: string; helperToken?: string } = { apiBaseUrl: apiInput?.value.trim() };
  const newToken = tokenInput?.value.trim();
  if (newToken) updates.helperToken = newToken;
  await chrome.storage.local.set(updates);
  tokenInput && (tokenInput.value = "");
  setStatus("Settings saved. Token remains in extension-local storage and is not displayed again.");
});

captureButton?.addEventListener("click", async () => {
  setStatus("Reading the currently open page...");
  const response = await chrome.runtime.sendMessage({ type: "POKEDAD_CAPTURE_ACTIVE_TAB" });
  if (!response?.ok || !response.signal) {
    setStatus(`Capture stopped: ${response?.error ?? "unsupported page"}`);
    return;
  }
  pendingSignal = response.signal;
  const signal = response.signal as Record<string, unknown>;
  if (previewElement) previewElement.textContent = [signal.storeKey, signal.productName, signal.priceCents == null ? "Price unknown" : `$${(Number(signal.priceCents) / 100).toFixed(2)}`, signal.stockStatus].join("\n");
  if (saveButton) saveButton.disabled = false;
  setStatus("Preview ready. Confirm Save Signal to persist it.");
});

saveButton?.addEventListener("click", async () => {
  if (!pendingSignal) return;
  const response = await chrome.runtime.sendMessage({ type: "POKEDAD_SAVE_SIGNAL", signal: pendingSignal });
  if (!response?.ok) {
    setStatus(`Save failed safely: ${response?.error ?? "unknown error"}`);
    return;
  }
  setStatus("Real page signal saved. No retailer request was made by the backend.");
  pendingSignal = undefined;
  if (saveButton) saveButton.disabled = true;
});

loadSettings();
