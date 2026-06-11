import React from 'react';

interface ActionToolbarProps {
  cycleTheme: () => void;
  replayIntro: () => void;
  theme: {
    accent: string;
    name: string;
  };
  themeIndex: number;
  themesLength: number;
  isMounted: boolean;
  dayNightCycleActive: boolean;
  setDayNightCycleActive: React.Dispatch<React.SetStateAction<boolean>>;
  weatherMode?: "sunny" | "rainy" | "windy" | "stormy" | "snowy";
  cycleWeather?: () => void;
}

const ActionToolbar: React.FC<ActionToolbarProps> = ({
  cycleTheme,
  replayIntro,
  theme,
  themeIndex,
  themesLength,
  isMounted,
  dayNightCycleActive,
  setDayNightCycleActive,
  weatherMode = "sunny",
  cycleWeather = () => {},
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Theme Cycle Button */}
      <button
        onClick={cycleTheme}
        className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
        aria-label={`Cycle theme: currently ${theme.name}`}
      >
        <span style={{ color: theme.accent }} aria-hidden="true">&#9654;</span>
        <span className="text-cream">{theme.name}</span>
        <span className="text-dim">{themeIndex + 1}/{themesLength}</span>
      </button>
 
      {/* Day/Night Cycle Button */}
      <button
        onClick={() => {
          setDayNightCycleActive((prev) => {
            const next = !prev;
            try {
              localStorage.setItem("leetcodecity_daynight_cycle", next ? "1" : "0");
            } catch {}
            return next;
          });
        }}
        className={`btn-press flex items-center gap-1.5 border-[3px] px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors ${
          dayNightCycleActive
            ? "border-amber-500/80 bg-amber-500/10 text-amber-400 hover:border-amber-400"
            : "border-border bg-bg/70 text-cream hover:border-border-light"
        }`}
        aria-label={dayNightCycleActive ? "Turn off day/night cycle" : "Turn on day/night cycle"}
      >
        <span style={{ color: theme.accent }} aria-hidden="true">&#9654;</span>
        <span>{dayNightCycleActive ? "CYCLE ON" : "CYCLE OFF"}</span>
      </button>
 
      {/* Weather Selector Button */}
      <button
        onClick={cycleWeather}
        className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light text-cream"
        aria-label={`Cycle weather: currently ${weatherMode}`}
      >
        <span style={{ color: theme.accent }} aria-hidden="true">&#9654;</span>
        <span>WEATHER: {weatherMode.toUpperCase()}</span>
      </button>

      {/* Audio/Radio Slot if mounted */}
      {isMounted && <div id="gc-radio-slot" />}

      {/* Replay Intro Button */}
      <button
        onClick={replayIntro}
        className="btn-press flex items-center gap-1 border-[3px] border-border bg-bg/70 px-2 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
        title="Replay intro"
        aria-label="Replay intro"
      >
        <span style={{ color: theme.accent }} aria-hidden="true">&#9654;</span>
        <span className="text-cream">Intro</span>
      </button>
    </div>
  );
};

export default ActionToolbar;