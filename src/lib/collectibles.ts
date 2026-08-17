import type { CollectibleDef } from "@/components/CityCanvas";

export interface MiniMapCollectible {
  x: number;
  y: number;
  z: number;
  type: "common" | "rare" | "epic";
  collected: boolean;
}

let items: CollectibleDef[] = [];
let collected: Uint8Array = new Uint8Array(0);

let revision = 0;

const listeners = new Set<() => void>();

export function setMinimapCollectibles(
  nextItems: CollectibleDef[],
  nextCollected: Uint8Array,
) {
  items = nextItems;
  collected = nextCollected;
  revision++;

  for (const listener of listeners) {
    listener();
  }
}

export function notifyMinimapCollectiblesChanged() {
  revision++;

  for (const listener of listeners) {
    listener();
  }
}

export function getMinimapCollectibles(): MiniMapCollectible[] {
  return items.map((item, index) => ({
    x: item.x,
    y: item.y,
    z: item.z,
    type: item.type,
    collected: collected[index] === 1,
  }));
}

export function getMinimapCollectibleRevision() {
  return revision;
}

export function subscribeMinimapCollectibles(
  listener: () => void,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}