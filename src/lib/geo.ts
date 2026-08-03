/**
 * Lightweight Brazil detection.
 *
 * Combines three signals in order of reliability:
 *   1. Server-detected country (Vercel `x-vercel-ip-country` header), passed via prop
 *   2. Browser timezone (e.g. `America/Sao_Paulo`) — set by the OS, not by language
 *   3. Browser language (`navigator.language`) — least reliable for devs with English OS
 */

/** Set of IANA timezone identifiers covering Brazilian territory. */
const BR_TIMEZONES = new Set([
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Bahia",
  "America/Manaus",
  "America/Recife",
  "America/Belem",
  "America/Maceio",
  "America/Cuiaba",
  "America/Boa_Vista",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/Araguaina",
  "America/Eirunepe",
  "America/Noronha",
  "America/Campo_Grande",
  "America/Santarem",
]);

/**
 * Detects whether the current user is likely in Brazil.
 *
 * Checks three signals in order of reliability:
 *   1. `serverCountry` — the Vercel `x-vercel-ip-country` header (most reliable)
 *   2. Browser `Intl.DateTimeFormat().resolvedOptions().timeZone` against BR timezones
 *   3. Browser `navigator.language` starting with "pt" (least reliable)
 *
 * Returns `true` as soon as any signal matches. Safe to call on both
 * server and client (guards against `navigator` being undefined on the server).
 *
 * @param serverCountry - The country code detected server-side, or null/undefined.
 * @returns `true` if Brazil is detected, `false` otherwise.
 */
export function isBrazilClient(serverCountry?: string | null): boolean {
  if (serverCountry && serverCountry.toUpperCase() === "BR") return true;
  if (typeof navigator === "undefined") return false;

  // Timezone is the strongest client signal — independent of UI language.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && BR_TIMEZONES.has(tz)) return true;
  } catch {
    /* fallthrough */
  }

  const lang = navigator.language || "";
  if (lang.toLowerCase().startsWith("pt")) return true;

  return false;
}
