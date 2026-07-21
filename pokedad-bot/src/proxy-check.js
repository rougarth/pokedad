import { config } from "./config.js";
import { checkProxy, loadProxyPool } from "./proxy.js";

if (!config.proxyEnabled) {
  console.log("Proxy configured: no");
  process.exit(1);
}

try {
  const pool = await loadProxyPool(config.proxyFile);
  const result = await checkProxy(pool[0]);
  console.log("Proxy configured: yes");
  console.log(`Proxy count: ${pool.length}`);
  console.log(`Proxy connectivity: ${result.ok ? "passed" : "failed"}`);
  process.exit(result.ok ? 0 : 2);
} catch {
  console.log("Proxy configured: no");
  console.log("Proxy connectivity: failed");
  process.exit(2);
}
