import { cp, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await cp(new URL("../public/manifest.json", import.meta.url), new URL("../dist/manifest.json", import.meta.url));
await cp(new URL("../public/popup.html", import.meta.url), new URL("../dist/popup.html", import.meta.url));
