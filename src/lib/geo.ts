/**
 * Lightweight Brazil geolocation detection module.
 *
 * Provides utilities to determine whether a client request originates from Brazil,
 * enabling localized features such as PIX payment options.
 *
 * Detection evaluates three signals in hierarchical order of reliability:
 *   1. Server-detected country (Vercel `x-vercel-ip-country` header), passed via prop
 *   2. Browser timezone (e.g. `America/Sao_Paulo`) — set by the OS, independent of UI language
 *   3. Browser language (`navigator.language`) — fallback signal for Portuguese language preference
 */

/**
 * Set of IANA timezone identifiers corresponding to Brazilian time zones.
 * Used as the primary client-side detection signal derived from system settings.
 */
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
 * Client-side check to determine if the user is located in Brazil.
 *
 * Evaluates detection signals in order of decreasing reliability:
 * 1. `serverCountry` parameter (e.g., from Vercel `x-vercel-ip-country` header)
 * 2. System/Browser timezone matching against `BR_TIMEZONES`
 * 3. Browser preferred language starting with `"pt"` (Portuguese)
 *
 * @param serverCountry - Optional ISO 3166-1 alpha-2 country code string passed from server headers (e.g., `"BR"`).
 * @returns `true` if the client is detected to be in Brazil, `false` otherwise.
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
