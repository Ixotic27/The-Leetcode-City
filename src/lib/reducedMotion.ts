import { useState, useEffect } from "react";
import { useCitySafe } from "@/context/CityContext";

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

/**
 * Custom hook to safely get reduced motion state inside or outside CityProvider
 */
export function useReducedMotion(propReducedMotion?: boolean): boolean {
  const cityContext = useCitySafe();
  const [systemMotion, setSystemMotion] = useState<boolean>(() => getInitialReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) === null) {
          setSystemMotion(e.matches);
        }
      } catch {
        setSystemMotion(e.matches);
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  if (propReducedMotion !== undefined) return propReducedMotion;
  if (cityContext?.reducedMotion !== undefined) return cityContext.reducedMotion;
  return systemMotion;
}
