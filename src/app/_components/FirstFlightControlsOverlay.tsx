"use client";

interface FirstFlightControlsOverlayProps {
  theme: {
    accent: string;
    shadow: string;
  };
  onDismiss: () => void;
}

export default function FirstFlightControlsOverlay({
  theme,
  onDismiss,
}: FirstFlightControlsOverlayProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/50 backdrop-blur-[2px]">
      <div
        className="border-[3px] border-border bg-bg-raised px-8 py-6 text-center animate-[fade-in_0.3s_ease-out]"
        style={{ borderColor: theme.accent + "60" }}
      >
        <p className="mb-4 text-xs tracking-widest text-muted">
          FLIGHT CONTROLS
        </p>
        <div className="flex flex-col gap-2.5 text-[11px]">
          <div className="flex items-center justify-between gap-6">
            <span className="text-cream">Mouse</span>
            <span className="text-muted">Steer</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-cream">Scroll</span>
            <span className="text-muted">Speed</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-cream">Shift / Alt</span>
            <span className="text-muted">Boost / Slow</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span style={{ color: theme.accent }}>ESC</span>
            <span className="text-muted">Pause &amp; Exit</span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="btn-press mt-5 px-6 py-2 text-[10px] text-bg"
          style={{
            backgroundColor: theme.accent,
            boxShadow: `3px 3px 0 0 ${theme.shadow}`,
          }}
        >
          Got it, let&apos;s fly!
        </button>
      </div>
    </div>
  );
}
