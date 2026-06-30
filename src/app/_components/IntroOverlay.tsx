"use client";

/* eslint-disable react-hooks/purity */

interface IntroOverlayProps {
  introPhase: number;
  introConfetti: boolean;
  theme: {
    accent: string;
    shadow: string;
  };
  onSkip: () => void;
}

export default function IntroOverlay({
  introPhase,
  introConfetti,
  theme,
  onSkip,
}: IntroOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className="absolute inset-x-0 top-0 origin-top bg-black/80 transition-transform duration-1000"
        style={{
          height: "12%",
          transform: introPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 origin-bottom bg-black/80 transition-transform duration-1000"
        style={{
          height: "18%",
          transform: introPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center"
        style={{ height: "18%" }}
      >
        {[
          "Inside the digital arena of logic...",
          "Problem solvers became towers",
          "And submissions became towers' floors",
        ].map((text, i) => (
          <p
            key={i}
            className="absolute text-center font-pixel normal-case text-cream"
            style={{
              fontSize: "clamp(0.85rem, 3vw, 1.5rem)",
              letterSpacing: "0.05em",
              opacity: introPhase === i ? 1 : 0,
              transition: "opacity 0.7s ease-in-out",
            }}
          >
            {text}
          </p>
        ))}

        <div
          className="absolute flex flex-col items-center gap-1"
          style={{
            opacity: introPhase === 3 ? 1 : 0,
            transform: introPhase === 3 ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
          }}
        >
          <p
            className="text-center font-pixel uppercase text-cream"
            style={{ fontSize: "clamp(1.2rem, 5vw, 2.8rem)" }}
          >
            Welcome to <span style={{ color: theme.accent }}>LeetCode City</span>
          </p>
        </div>
      </div>

      {introConfetti && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 25 }).map((_, i) => {
            const colors = [
              theme.accent,
              "#fff",
              theme.shadow,
              "#f0c060",
              "#e040c0",
              "#60c0f0",
            ];
            const color = colors[i % colors.length];
            const left = 10 + Math.random() * 80;
            const delay = Math.random() * 0.6;
            const duration = 2.5 + Math.random() * 1.5;
            const w = 3 + Math.random() * 5;
            const h = Math.random() > 0.5 ? w : w * 0.35;
            const drift = (Math.random() - 0.5) * 80;
            const rotation = Math.random() * 720;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: "-8px",
                  width: `${w}px`,
                  height: `${h}px`,
                  backgroundColor: color,
                  animation: `introConfettiFall ${duration}s ${delay}s ease-in forwards`,
                  transform: `rotate(${rotation}deg) translateX(${drift}px)`,
                  opacity: 0,
                }}
              />
            );
          })}
        </div>
      )}

      <button
        className="pointer-events-auto absolute top-4 right-4 font-pixel text-[10px] uppercase text-cream/40 transition-colors hover:text-cream sm:text-xs"
        onClick={onSkip}
      >
        Skip &gt;
      </button>
    </div>
  );
}
