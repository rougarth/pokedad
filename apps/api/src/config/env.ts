import { z } from "zod";
import "./load-env.js";
import { formatMissingDatabaseUrlMessage } from "./load-env.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  PUBLIC_APP_URL: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string({ required_error: formatMissingDatabaseUrlMessage() }).min(1, formatMissingDatabaseUrlMessage()),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SESSION_SECRET: z.string().min(24).default("local-dev-session-secret-change-me"),
  ENCRYPTION_KEY: z.string().length(32, "ENCRYPTION_KEY must be exactly 32 characters for AES-256-GCM").optional(),
  SECRETS_MASTER_KEY_BASE64: z.string().optional(),
  HELPER_SHARED_TOKEN: z.string().min(16).default("development-helper-token-change-me"),
  ADMIN_EMAIL: z.string().email().default("admin@pokedad.local"),
  ADMIN_PASSWORD: z.string().min(8).default("pokedad-dev-password"),
  BEST_BUY_API_KEY: z.string().trim().max(256).optional().default(""),
  DISCORD_CLIENT_ID: z.string().optional().default(""),
  DISCORD_CLIENT_SECRET: z.string().optional().default(""),
  DISCORD_REDIRECT_URI: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().default("http://127.0.0.1:4000/discord/oauth/callback")
  )
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const databaseUrlIssue = parsed.error.issues.find((issue) => issue.path.join(".") === "DATABASE_URL");
  if (databaseUrlIssue) {
    console.error(formatMissingDatabaseUrlMessage());
  }
  throw parsed.error;
}

export const env = parsed.data;
