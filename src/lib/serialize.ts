export function serializeDeveloper(dev: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Keep these vital fields as-is
  const alwaysKeep = ["id", "github_login", "contributions", "total_stars", "public_repos"];
  for (const key of alwaysKeep) {
    if (dev[key] !== undefined) {
      result[key] = dev[key];
    }
  }

  // Iterate over all other fields
  for (const key of Object.keys(dev)) {
    if (alwaysKeep.includes(key)) continue;

    const val = dev[key];

    // Omit null/undefined
    if (val === null || val === undefined) continue;

    // Omit empty arrays
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      result[key] = val;
      continue;
    }

    // Omit empty/default objects
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (key === "loadout") {
        const isDefault = !obj.crown && !obj.roof && !obj.aura && !obj.faces;
        if (isDefault) continue;
      }
      if (key === "active_raid_tag") {
        if (!obj.attacker_login) continue;
      }
    }

    result[key] = val;
  }

  return result;
}
