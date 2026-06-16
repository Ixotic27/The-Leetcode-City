// ─── Seeded PRNG ────────────────────────────────────────────────
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Improved noise for terrain ─────────────────────────────────
export function noise2D(x: number, z: number, scale: number, seed: number): number {
  const sx = x * scale + seed;
  const sz = z * scale + seed * 1.3;
  return (
    Math.sin(sx * 1.2 + sz * 0.8) * 0.4 +
    Math.sin(sx * 0.5 - sz * 1.5) * 0.3 +
    Math.sin(sx * 2.1 + sz * 2.3) * 0.15 +
    Math.sin(sx * 0.3 + sz * 0.7) * 0.15
  );
}

// fbm-style layered noise for mountains
export function fbmNoise(x: number, z: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 0.002;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x, z, frequency, seed + i * 73.1) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value / maxVal;
}

// ─── Per-zone terrain height ────────────────────────────────────
// Inline getZone to avoid circular dep with zones.ts
function _getZone(x: number, z: number): number {
  const ZONE_COUNT = 6;
  const angle = Math.atan2(z, x);
  const normalized = ((angle + Math.PI) / (Math.PI * 2)) * ZONE_COUNT;
  return Math.floor(normalized) % ZONE_COUNT;
}

export function getTerrainHeight(x: number, z: number, zone?: number): number {
  if (isNaN(x) || isNaN(z)) return 0;

  const zn = zone ?? _getZone(x, z);

  // Base terrain
  const base = fbmNoise(x, z, 5, 42);

  switch (zn) {
    case 0: {
      // JUNGLE — rolling hills, moderate height
      const jungle = base * 50 + noise2D(x, z, 0.008, 77) * 25;
      return jungle * 0.8 + 5;
    }
    case 1: {
      // VOLCANIC — low cracked plateau with lava channels
      const volcanic = base * 30;
      // Lava channels as sine-wave valleys
      const lavaChannel = Math.abs(Math.sin(x * 0.005 + z * 0.003)) * 20;
      return volcanic * 0.4 + lavaChannel - 5;
    }
    case 2: {
      // FROZEN — dramatic tall mountains, clamped to [20, 260]
      const raw = Math.abs(base) * 180 + noise2D(x, z, 0.004, 33) * 60
                + Math.abs(noise2D(x, z, 0.015, 55)) * 40 + 20;
      return Math.max(20, Math.min(260, raw));
    }
    case 3: {
      // VOID — floating chunks, base terrain is low
      return base * 15 - 30;
    }
    case 4: {
      // WORLD TREE — gentle rolling around the tree
      const treeDist = Math.sqrt((x) * (x) + (z + 800) * (z + 800));
      const rootBump = Math.max(0, 1 - treeDist / 400) * 30;
      return base * 20 + rootBump;
    }
    case 5: {
      // DESERT — sine-wave dunes
      const dunes = Math.sin(x * 0.008 + 1.5) * Math.sin(z * 0.006 + 0.7) * 25;
      const smallDunes = noise2D(x, z, 0.02, 88) * 8;
      return dunes + smallDunes + 3;
    }
    default:
      return base * 40;
  }
}
