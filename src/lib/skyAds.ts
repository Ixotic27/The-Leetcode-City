export type AdVehicle = "plane" | "blimp" | "billboard" | "rooftop_sign" | "led_wrap";

export interface SkyAd {
  id: string;
  text: string;
  brand?: string;
  description?: string;
  color: string;
  bgColor: string;
  link?: string;
  vehicle: AdVehicle;
  priority: number;
}

export const MAX_PLANES = 8;
export const MAX_BLIMPS = 4;
export const MAX_BILLBOARDS = 10;
export const MAX_ROOFTOP_SIGNS = 10;
export const MAX_LED_WRAPS = 10;
export const MAX_TEXT_LENGTH = 80;

const ALLOWED_LINK_PATTERN = /^(https:\/\/|mailto:)/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isBuildingAd(vehicle: string): vehicle is "billboard" | "rooftop_sign" | "led_wrap" {
  return vehicle === "billboard" || vehicle === "rooftop_sign" || vehicle === "led_wrap";
}

export function validateAds(ads: SkyAd[]): SkyAd[] {
  return ads
    .filter((ad) => {
      if (ad.text.length > MAX_TEXT_LENGTH) return false;
      if (ad.link && !ALLOWED_LINK_PATTERN.test(ad.link)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.color)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.bgColor)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

export function getActiveAds(ads: SkyAd[]) {
  const valid = validateAds(ads);
  return {
    planeAds: valid.filter((a) => a.vehicle === "plane").slice(0, MAX_PLANES),
    blimpAds: valid.filter((a) => a.vehicle === "blimp").slice(0, MAX_BLIMPS),
    billboardAds: valid.filter((a) => a.vehicle === "billboard").slice(0, MAX_BILLBOARDS),
    rooftopSignAds: valid.filter((a) => a.vehicle === "rooftop_sign").slice(0, MAX_ROOFTOP_SIGNS),
    ledWrapAds: valid.filter((a) => a.vehicle === "led_wrap").slice(0, MAX_LED_WRAPS),
  };
}

/** Append UTM params to an ad link. Skips mailto: links. */
export function buildAdLink(ad: SkyAd): string | undefined {
  if (!ad.link) return undefined;
  if (ad.link.startsWith("mailto:")) return ad.link;
  try {
    const url = new URL(ad.link);
    url.searchParams.set("utm_source", "leetcodecity");
    url.searchParams.set("utm_medium", "sky_ad");
    url.searchParams.set("utm_campaign", ad.id);
    url.searchParams.set("utm_content", ad.vehicle);
    return url.toString();
  } catch (err) { console.warn("[lib/skyAds.ts] error:", err); return ad.link;
   }
}

/** Fire a tracking beacon to the sky-ads track API (non-blocking). */
export function trackAdEvent(adId: string, eventType: "impression" | "click" | "cta_click", githubLogin?: string) {
  const body = JSON.stringify({ ad_id: adId, event_type: eventType, ...(githubLogin && { github_login: githubLogin }) });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/sky-ads/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/sky-ads/track", { method: "POST", body, keepalive: true }).catch(() => { });
  }
}

/** Fire multiple event types in a single beacon (saves rate limit budget). */
export function trackAdEvents(adId: string, eventTypes: ("impression" | "click" | "cta_click")[], githubLogin?: string) {
  const body = JSON.stringify({ ad_id: adId, event_types: eventTypes, ...(githubLogin && { github_login: githubLogin }) });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/sky-ads/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/sky-ads/track", { method: "POST", body, keepalive: true }).catch(() => { });
  }
}

export const DEFAULT_SKY_ADS: SkyAd[] = [
  {
    id: "leetcodecity",
    text: "THEleetcodecity.TECH ★ YOUR CODE, YOUR CITY ★ THEleetcodecity.TECH",
    brand: "LeetCode City",
    description: "A city built from GitHub contributions. Search your username and find your building among thousands of developers.",
    color: "#f8d880",
    bgColor: "#1a1018",
    link: "https://theleetcodecity.tech",
    vehicle: "plane",
    priority: 100,
  },
  {
    id: "keepcoding",
    text: "KEEP CODING, KEEP SHINING ★ LEETCODE CITY ★",
    brand: "LeetCode City",
    description: "Every commit builds the skyline. Never stop committing!",
    color: "#40ff80",
    bgColor: "#081a10",
    link: "https://theleetcodecity.tech",
    vehicle: "plane",
    priority: 90,
  },
  {
    id: "findyourbuilding",
    text: "YOUR GITHUB CITY AWAITS ★ FIND YOUR BUILDING!",
    brand: "LeetCode City",
    description: "Search your username and locate your personal high-rise building.",
    color: "#00e0ff",
    bgColor: "#081420",
    link: "https://theleetcodecity.tech",
    vehicle: "plane",
    priority: 80,
  },
  {
    id: "advertise",
    text: "ADD YOUR AD HERE ★ PLANES & BLIMPS ★ ADVERTISE NOW",
    brand: "Sky Ads",
    description: "Want your brand flying over LeetCode City? Planes, blimps, your colors. Get in touch!",
    color: "#ffc0ff",
    bgColor: "#18081a",
    link: "https://theleetcodecity.tech/advertise",
    vehicle: "plane",
    priority: 10,
  },
  {
    id: "blimp1",
    text: "NEVER GIVE UP ON YOUR CODE ★ SKY DIRIGIBLE ★",
    brand: "Dirigible",
    description: "Majestic blimps floating outside the city borders.",
    color: "#ff8040",
    bgColor: "#1c0c08",
    link: "https://theleetcodecity.tech",
    vehicle: "blimp",
    priority: 70,
  },
  {
    id: "blimp2",
    text: "DISCOVER NEW HORIZONS ★ LEETCODE CITY ★",
    brand: "Dirigible",
    description: "Cruising in the high atmosphere above the endless ocean.",
    color: "#ffff80",
    bgColor: "#181808",
    link: "https://theleetcodecity.tech",
    vehicle: "blimp",
    priority: 60,
  },
  {
    id: "blimp3",
    text: "SHAPE THE FUTURE ★ CODE BY CODE ★",
    brand: "Dirigible",
    description: "Every solved challenge brightens the city light.",
    color: "#ff40c0",
    bgColor: "#180814",
    link: "https://theleetcodecity.tech",
    vehicle: "blimp",
    priority: 50,
  },
  {
    id: "blimp4",
    text: "GREETINGS TO ALL CODER CITIZENS! ★",
    brand: "Dirigible",
    description: "Floating smoothly outside city limits.",
    color: "#c040ff",
    bgColor: "#10081c",
    link: "https://theleetcodecity.tech",
    vehicle: "blimp",
    priority: 40,
  },
];
