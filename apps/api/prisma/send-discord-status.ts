import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AlertDeliveryService } from "../src/modules/alerts/alert-delivery.service.js";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

const message = `Hello everyone!

PokeDad Radar is online, and the safe bot worker is healthy. The dashboard, API, PostgreSQL, Redis, ngrok tunnel, Discord connection, and 10 Webshare proxies are running.

The Best Buy read-only scan is currently paused because BEST_BUY_API_KEY is not configured. No retailer request was made.

Next steps:
1. Add the approved Best Buy API key to the production environment.
2. Restart the API so it loads the key.
3. Run the manual readiness check.
4. Run one controlled read-only scan.
5. Review Live Finds, MSRP Mapping, Discord alerts, and Notification History.

All retailer actions remain manual and Open Product only. No cart or checkout automation is enabled.`;

async function main(): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL.toLowerCase() } });
  if (!owner) throw new Error("Configured admin user was not found.");

  const channel = await prisma.alertChannel.findFirst({
    where: { ownerId: owner.id, type: "DISCORD_WEBHOOK", enabled: true, encryptedSecretId: { not: null } },
    orderBy: { updatedAt: "desc" }
  });
  if (!channel) throw new Error("No enabled encrypted Discord channel is configured.");

  const event = await prisma.alertEvent.create({
    data: {
      ownerId: owner.id,
      alertChannelId: channel.id,
      type: "ERROR",
      templateType: "CONFIGURATION_NEEDED",
      title: "PokeDad Radar Status Update",
      priority: "LOW",
      status: "PENDING",
      message
    }
  });

  const result = await new AlertDeliveryService(prisma).deliverEvent(owner.id, event.id, channel.id);
  const delivery = result.deliveries[0];
  console.log(JSON.stringify({ delivered: delivery?.status === "SENT", status: delivery?.status ?? "NOT_ATTEMPTED" }));
  if (delivery?.status !== "SENT") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Discord status delivery failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
