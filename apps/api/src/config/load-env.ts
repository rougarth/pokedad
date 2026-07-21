import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = resolve(apiRoot, "../..");

for (const envPath of [resolve(projectRoot, ".env"), resolve(apiRoot, ".env")]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

export function formatMissingDatabaseUrlMessage(): string {
  return [
    "DATABASE_URL is required for PokeDad Radar.",
    "Create apps/api/.env from apps/api/.env.example, then start PostgreSQL.",
    'Default local value: DATABASE_URL="postgresql://pokedad:pokedad@localhost:55433/pokedad?schema=public"'
  ].join(" ");
}
