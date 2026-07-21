import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const root = process.cwd();
const failures = [];

loadDotenv({ path: path.join(root, ".env"), quiet: true });
loadDotenv({ path: path.join(root, "apps/api/.env"), override: false, quiet: true });

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}

function checkTrackedEnvFiles() {
  try {
    const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);

    const forbidden = new Set([
      ".env",
      ".env.production",
      ".env.home-server",
      ".env.ngrok",
      "apps/api/.env",
      "apps/api/.env.production",
      "apps/api/.env.home-server",
      "apps/api/.env.ngrok",
      "apps/web/.env",
      "apps/web/.env.production",
      "apps/web/.env.home-server",
      "apps/web/.env.ngrok"
    ]);

    for (const file of tracked) {
      if (forbidden.has(file.replaceAll("\\", "/"))) {
        fail(`Tracked secret-bearing env file detected: ${file}`);
      }
    }
  } catch {
    console.warn("security:check warning: git is unavailable; skipped tracked env file check.");
  }
}

function checkPrivateComposePorts() {
  for (const composePath of ["docker-compose.production.yml", "docker-compose.home-server.yml", "docker-compose.ngrok.yml"]) {
    if (!existsSync(path.join(root, composePath))) {
      fail(`${composePath} is missing.`);
      continue;
    }

    const compose = read(composePath);
    if (/["']?\d+\.\d+\.\d+\.\d+:5432:5432["']?|["']?5432:5432["']?/.test(compose)) {
      fail(`${composePath} appears to publish PostgreSQL.`);
    }
    if (/["']?\d+\.\d+\.\d+\.\d+:6379:6379["']?|["']?6379:6379["']?/.test(compose)) {
      fail(`${composePath} appears to publish Redis.`);
    }
  }
}

function checkSchemaForPaymentStorage() {
  const schema = read("apps/api/prisma/schema.prisma");
  const suspicious = [
    /\bcardNumber\b/i,
    /\bcvv\b/i,
    /\bcvc\b/i,
    /\bpaymentData\b/i,
    /\bretailerPassword\b/i,
    /\bretailerCookie\b/i,
    /\bretailerSession\b/i
  ];

  for (const pattern of suspicious) {
    if (pattern.test(schema)) {
      fail(`Forbidden payment/retailer credential field detected in Prisma schema: ${pattern}`);
    }
  }
}

async function checkEncryptedSecrets() {
  if (!process.env.DATABASE_URL) {
    console.warn("security:check warning: DATABASE_URL is not set; skipped database secret probe.");
    return;
  }

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const [channels, secrets] = await Promise.all([
        prisma.alertChannel.findMany({
          select: {
            destinationHint: true,
            lastError: true
          },
          take: 100
        }),
        prisma.encryptedSecret.findMany({
          select: {
            name: true,
            cipherTextBase64: true,
            ivBase64: true,
            authTagBase64: true
          },
          take: 100
        })
      ]);

      const plaintextPatterns = [
        /discord(?:app)?\.com\/api\/webhooks/i,
        /api\.telegram\.org\/bot/i,
        /BEST_BUY_API_KEY/i,
        /client_secret/i,
        /access_token/i,
        /refresh_token/i
      ];

      const publicChannelText = JSON.stringify(channels);
      for (const pattern of plaintextPatterns) {
        if (pattern.test(publicChannelText)) {
          fail(`Potential plaintext secret detected in alert channel metadata: ${pattern}`);
        }
      }

      for (const secret of secrets) {
        const secretText = JSON.stringify(secret);
        for (const pattern of plaintextPatterns) {
          if (pattern.test(secretText)) {
            fail(`Potential plaintext secret detected in encrypted secret record ${secret.name}.`);
          }
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.warn(`security:check warning: database secret probe skipped (${error instanceof Error ? error.message : "unknown error"}).`);
  }
}

checkTrackedEnvFiles();
checkPrivateComposePorts();
checkSchemaForPaymentStorage();
await checkEncryptedSecrets();

if (failures.length > 0) {
  console.error("security:check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("security:check passed: no obvious committed env files, public DB/Redis ports, payment fields, or plaintext alert secrets found.");
