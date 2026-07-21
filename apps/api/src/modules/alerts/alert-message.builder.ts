import type { AlertMessageInput } from "./types.js";

function money(cents?: number | null): string {
  return cents == null ? "Unknown" : `$${(cents / 100).toFixed(2)}`;
}

export function buildAlertMessage(input: AlertMessageInput): string {
  if (!input.productName) {
    return `[PokeDad Radar]\n\n${input.fallbackMessage}`;
  }

  return [
    `[${input.heading}]`,
    "",
    `${input.storeName ?? "Store"} - ${input.productName}`,
    `Price: ${money(input.priceCents)}`,
    `MSRP: ${money(input.msrpCents)}`,
    `Max accepted: ${money(input.acceptedMaxPriceCents)}`,
    `Stock: ${input.stockStatus ?? "Unknown"}`,
    `Price status: ${input.priceStatus ?? "Unknown"}`,
    input.productUrl ? "" : null,
    input.productUrl ? "Open Product:" : null,
    input.productUrl ?? null
  ].filter((line): line is string => line != null).join("\n");
}
