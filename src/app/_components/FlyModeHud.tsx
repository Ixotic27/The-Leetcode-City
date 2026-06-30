"use client";

interface FlyModeHudProps {
  flyPaused: boolean;
  flyScore: {
    score: number;
    combo: number;
    collected: number;
  };
  flyVehicle: string;
  flyElapsedSec: number;
  flyPersonalBest: number;
  quotaReached: boolean;
  hud: {
    speed: number;
    altitude: number;
  };
  districtAnnouncement: {
    name: string;
    color: string;
    population: number;
  } | null;
  theme: {
    accent: string;
  };
  onVehicleChange: (vehicle: string) => void;
  onExit: () => void;
  onDismissQuota: () => void;
}

const FLY_VEHICLES = [
  { id: "airplane", label: "✈", title: "Airplane" },
  {
    id: "futuristic_jet",
    label: "🚀",
    title: "Futuristic Jet",
  },
] as const;

export default function FlyModeHud({
  flyPaused,
  flyScore,
  flyVehicle,
  flyElapsedSec,
  flyPersonalBest,
  quotaReached,
  hud,
  districtAnnouncement,
  theme,
  onVehicleChange,
  onExit,
  onDismissQuota,
}: FlyModeHudProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="inline-flex items-center gap-3 border-[3px] border-border bg-bg/70 px-5 py-2.5 backdrop-blur-sm">
          <span
            className={`h-2 w-2 flex-shrink-0 ${flyPaused ? "" : "blink-dot"}`}
            style={{
              backgroundColor: flyPaused ? "#f85149" : theme.accent,
            }}
          />
          <span className="text-[10px] text-cream">
            {flyPaused ? "Paused" : "Fly"}
          </span>
          <span className="mx-1 text-border">|</span>
          <span className="text-[10px]" style={{ color: theme.accent }}>
            {flyScore.score}
          </span>
          <span className="text-[10px] text-muted">PX</span>
          {flyScore.combo >= 2 && (
            <span
              className="animate-pulse text-[10px] font-bold"
              style={{ color: "#ffd700" }}
            >
              &times;
              {flyScore.combo >= 4 ? 3 : flyScore.combo >= 3 ? 2 : 1.5}
            </span>
          )}

          <span className="mx-1 text-border">|</span>
          {FLY_VEHICLES.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => onVehicleChange(vehicle.id)}
              title={vehicle.title}
              className="pointer-events-auto btn-press border px-1.5 py-0.5 text-[11px] transition-colors"
              style={{
                borderColor:
                  flyVehicle === vehicle.id
                    ? theme.accent
                    : "rgba(255,255,255,0.15)",
                backgroundColor:
                  flyVehicle === vehicle.id
                    ? theme.accent + "22"
                    : "transparent",
                color: flyVehicle === vehicle.id ? theme.accent : "#888",
              }}
            >
              {vehicle.label}
            </button>
          ))}
          <button
            onClick={onExit}
            className="pointer-events-auto btn-press ml-2 border border-border-light bg-bg-raised/80 px-2 py-1 text-[9px] font-bold text-cream transition-colors hover:bg-border"
          >
            EXIT
          </button>
        </div>
      </div>

      {quotaReached && (
        <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 animate-bounce-short">
          <div className="flex flex-col items-center gap-2 border-[3px] border-[#4ade80] bg-bg/90 p-4 text-center backdrop-blur-md shadow-lg">
            <div className="text-[12px] font-bold text-[#4ade80]">
              MISSION QUOTA MATCHED!
            </div>
            <div className="text-[10px] text-cream/80">
              You&apos;ve reached 50 PX. Exit now to complete quest?
            </div>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={onExit}
                className="pointer-events-auto btn-press bg-[#4ade80] px-3 py-1.5 text-[10px] font-bold text-bg transition-all hover:brightness-110"
              >
                EXIT NOW
              </button>
              <button
                type="button"
                onClick={onDismissQuota}
                className="pointer-events-auto btn-press border border-cream/30 bg-bg/50 px-3 py-1.5 text-[10px] text-cream transition-colors hover:bg-bg-raised"
              >
                KEEP FLYING
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-3 text-right text-[9px] text-muted sm:right-4 sm:text-[10px]">
        <div>{flyScore.collected}/40 collected</div>
        <div className="mt-1 flex h-[4px] w-24 items-center border border-border/40 bg-bg/50 ml-auto">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${(flyScore.collected / 40) * 100}%`,
              backgroundColor: theme.accent,
            }}
          />
        </div>
        <div className="mt-1.5 text-[8px]">
          <span className="text-muted">TIME </span>
          <span
            style={{
              color: flyElapsedSec < 900 ? theme.accent : "#f85149",
            }}
          >
            {Math.floor(flyElapsedSec / 60)}:
            {String(flyElapsedSec % 60).padStart(2, "0")} / 15:00
          </span>
        </div>
        {flyPersonalBest > 0 && (
          <div className="mt-0.5 text-[8px] text-muted">
            BEST: <span style={{ color: theme.accent }}>{flyPersonalBest}</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-14 left-3 text-[9px] leading-loose text-muted sm:left-4 sm:text-[10px]">
        <div className="flex items-center gap-2">
          <span>SPD</span>
          <span style={{ color: theme.accent }} className="w-6 text-right">
            {Math.round(hud.speed)}
          </span>
          <div className="flex h-[6px] w-20 items-center border border-border/60 bg-bg/50">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${Math.round(((hud.speed - 20) / 140) * 100)}%`,
                backgroundColor: theme.accent,
              }}
            />
          </div>
        </div>
        <div>
          ALT{" "}
          <span style={{ color: theme.accent }}>
            {Math.round(hud.altitude)}
          </span>
        </div>
      </div>

      {districtAnnouncement && (
        <div
          key={districtAnnouncement.name}
          className="absolute bottom-32 left-3 animate-district-in sm:left-4"
        >
          <div
            className="border-l-4 bg-bg/80 px-4 py-2 backdrop-blur-sm"
            style={{ borderColor: districtAnnouncement.color }}
          >
            <div className="text-[8px] uppercase tracking-widest text-muted">
              District
            </div>
            <div className="font-pixel text-sm text-cream">
              {districtAnnouncement.name}
            </div>
            <div className="text-[8px] text-muted">
              {districtAnnouncement.population.toLocaleString()} devs
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-[140px] right-3 text-right text-[8px] leading-loose text-muted sm:right-4 sm:text-[9px]">
        {flyPaused ? (
          <>
            <div>
              <span className="text-cream">Drag</span> orbit
            </div>
            <div>
              <span className="text-cream">Scroll</span> zoom
            </div>
            <div>
              <span className="text-cream">WASD</span> resume
            </div>
            <div>
              <span style={{ color: theme.accent }}>ESC</span> exit
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-cream">Mouse</span> steer
            </div>
            <div>
              <span className="text-cream">Shift</span> boost
            </div>
            <div>
              <span className="text-cream">Alt</span> slow
            </div>
            <div>
              <span className="text-cream">Scroll</span> base speed
            </div>
            <div>
              <span style={{ color: theme.accent }}>P</span> pause
            </div>
            <div>
              <span style={{ color: theme.accent }}>ESC</span> pause
            </div>
          </>
        )}
      </div>
    </div>
  );
}
