import { OwnershipResolver } from "./ownershipResolver";

export interface EntitlementEvaluationOptions {
  developerId: number;
  itemIds: string[];
  inventoryTable?: string;
  purchasesTable?: string;
}

export interface EntitlementEvaluationResult {
  owned: string[];
  missing: string[];
}

export interface EntitlementQueryOptions {
  inventoryTable?: string;
  purchasesTable?: string;
  ownerColumn?: string;
}

export class EntitlementService {
  private readonly resolver = new OwnershipResolver();

  async ownsItem(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    return this.resolver.ownsItem(developerId, itemId, options);
  }

  async ownsInventoryItem(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    return this.resolver.ownsInventoryItem(developerId, itemId, options);
  }

  async hasEntitlement(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    if (options.inventoryTable) {
      try {
        const inventoryOwned = await this.ownsInventoryItem(developerId, itemId, options);
        if (inventoryOwned) return true;
      } catch {
        // Fall back to purchase ownership below.
      }
    }

    return this.ownsItem(developerId, itemId, options);
  }

  async canAccess(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    return this.hasEntitlement(developerId, itemId, options);
  }

  async evaluate(
    options: EntitlementEvaluationOptions
  ): Promise<EntitlementEvaluationResult> {
    const owned: string[] = [];
    const missing: string[] = [];

    for (const itemId of options.itemIds) {
      const isOwned = await this.hasEntitlement(options.developerId, itemId, {
        inventoryTable: options.inventoryTable,
        purchasesTable: options.purchasesTable,
      });

      if (isOwned) {
        owned.push(itemId);
      } else {
        missing.push(itemId);
      }
    }

    return { owned, missing };
  }

  async listOwnedItems(
    developerId: number,
    options: EntitlementQueryOptions = {}
  ): Promise<string[]> {
    return this.resolver.listOwnedItems(developerId, options);
  }
}
