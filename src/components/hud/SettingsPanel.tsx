"use client";

import { useSyncExternalStore } from "react";
import ActionToolbar from "@/components/ActionToolbar";
import { useCity, THEMES } from "@/context/CityContext";

export default function SettingsPanel() {
  const city = useCity();
  // The radio slot must not exist in SSR markup: GlobalRadio hydrates first and would portal into it.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (city.flyMode || city.introMode || city.rabbitCinematic) return null;
  return (
    <details className="group pointer-events-auto fixed bottom-10 left-3 z-[35] max-w-[calc(100vw-1.5rem)] text-cream sm:left-6">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-3 border-2 border-border-light bg-bg/95 px-4 text-[10px] transition-colors hover:border-lime focus-visible:outline-2 focus-visible:outline-lime">
        <span aria-hidden="true">⚙</span> Settings <span className="text-muted group-open:rotate-180" aria-hidden="true">⌃</span>
      </summary>
      <div className="absolute bottom-full mb-2 max-h-[60dvh] w-[min(360px,calc(100vw-1.5rem))] overflow-y-auto border-2 border-border-light bg-bg/95 p-3 shadow-lg [&_button]:min-h-11 [&_button]:border-2">
        <ActionToolbar cycleTheme={city.cycleTheme} replayIntro={city.replayIntro} theme={city.theme} themeIndex={city.themeIndex} themesLength={THEMES.length} isMounted={mounted} dayNightCycleActive={city.dayNightCycleActive} setDayNightCycleActive={city.setDayNightCycleActive} neonGridActive={city.neonGridActive} setNeonGridActive={city.setNeonGridActive} weatherMode={city.weatherMode} cycleWeather={city.cycleWeather} reducedMotion={city.reducedMotion} setReducedMotion={city.setReducedMotion} />
      </div>
    </details>
  );
}