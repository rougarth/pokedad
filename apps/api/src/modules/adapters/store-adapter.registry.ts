import { assertSafeAdapterRegistration } from "./adapter-safety.js";
import type { StoreAdapter } from "./store-adapter.interface.js";

export class StoreAdapterRegistry {
  private readonly adapters = new Map<string, StoreAdapter>();

  register(adapter: StoreAdapter): void {
    assertSafeAdapterRegistration(adapter);
    this.adapters.set(adapter.storeKey, adapter);
  }

  list(): StoreAdapter[] {
    return [...this.adapters.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  get(storeKey: string): StoreAdapter | undefined {
    return this.adapters.get(storeKey);
  }
}
