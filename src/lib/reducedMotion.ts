export const REDUCED_MOTION_STORAGE_KEY = "leetcodecity_reduced_motion";

/**
 * Resolves initial reduced motion preference:
 * 1. Explicit localStorage override ("1" = true, "0" = false)
 * 2. System preference window.matchMedia("(prefers-reduced-motion: reduce)")
 * 3. Default fallback (false)
 */
export function getInitialReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch (err) {
    console.warn("[reducedMotion] Failed to read localStorage:", err);
  }
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

/**
 * Persists user's manual reduced motion setting to localStorage
 */
export function persistReducedMotion(reduced: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, reduced ? "1" : "0");
  } catch (err) {
    console.warn("[reducedMotion] Failed to persist preference:", err);
  }
}
