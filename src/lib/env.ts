type EnvNumberOptions = {
  min?: number;
  max?: number;
  outOfRange?: "fallback" | "clamp";
};

export function getEnvString(name: string, fallback = ""): string {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim().length === 0) return fallback;
  return raw;
}

export function getEnvBoolean(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim().length === 0) return fallback;

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return fallback;
}

export function getEnvNumber(
  name: string,
  fallback: number,
  options: EnvNumberOptions = {}
): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim().length === 0) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;

  const { min, max, outOfRange = "fallback" } = options;

  if (outOfRange === "clamp") {
    let value = parsed;
    if (typeof min === "number") value = Math.max(min, value);
    if (typeof max === "number") value = Math.min(max, value);
    return value;
  }

  if (typeof min === "number" && parsed < min) return fallback;
  if (typeof max === "number" && parsed > max) return fallback;

  return parsed;
}
