import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ProxyAgent, fetch } from "undici";

function parseProxyLine(line) {
  const parts = line.trim().split(":");
  if (parts.length !== 4) return null;
  const [host, portText, username, password] = parts;
  const port = Number.parseInt(portText, 10);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !username || !password) return null;
  return { host, port, username, password };
}

export async function loadProxyPool(filePath) {
  const contents = await readFile(resolve(filePath), "utf8");
  const proxies = contents.split(/\r?\n/).map(parseProxyLine).filter(Boolean);
  if (proxies.length === 0) throw new Error("No valid proxies found in the configured file.");
  return proxies;
}

export function proxyUrl(proxy) {
  const username = encodeURIComponent(proxy.username);
  const password = encodeURIComponent(proxy.password);
  return `http://${username}:${password}@${proxy.host}:${proxy.port}`;
}

export async function checkProxy(proxy, timeoutMs = 10_000) {
  const dispatcher = new ProxyAgent(proxyUrl(proxy));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      dispatcher,
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
    await dispatcher.close();
  }
}
