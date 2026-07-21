import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_PASSWORD, { type: argon2.argon2id });
  const result = await prisma.user.updateMany({ where: { email }, data: { passwordHash } });
  if (result.count !== 1) throw new Error("Configured admin user was not found.");
  console.log("Admin password hash updated successfully.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin password reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
