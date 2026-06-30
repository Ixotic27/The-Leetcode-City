"use client";

import Link from "next/link";

interface FlyResults {
  score: number;
  collected: number;
  maxCombo: number;
  timeBonus: number;
  rank: number;
  totalPilots: number;
  isNewPB: boolean;
}

interface PostFlightResultsModalProps {
  results: FlyResults;
  theme: {
    accent: string;
    shadow: string;
  };
  onClose: () => void;
  onFlyAgain: () => void;
}

export default function PostFlightResultsModal({
  results,
  theme,
  onClose,
  onFlyAgain,
}: PostFlightResultsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-7 animate-[gift-bounce_0.5s_ease-out]"
        style={{ borderColor: theme.accent + "60", minWidth: 280 }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
        >
          ESC
        </button>

        <p className="text-[9px] tracking-widest text-muted mb-1">
          FLIGHT COMPLETE
        </p>
        <div
          className="text-3xl sm:text-4xl font-bold"
          style={{ color: theme.accent }}
        >
          {results.score}
        </div>
        <p className="text-[9px] text-muted mt-0.5">points</p>

        {results.isNewPB && (
          <div
            className="mt-2 inline-block rounded-sm px-2.5 py-0.5 text-[9px] font-bold text-bg animate-pulse"
            style={{ backgroundColor: theme.accent }}
          >
            NEW PERSONAL BEST!
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-sm font-bold text-cream">
              {results.collected}
            </div>
            <div className="text-[8px] text-muted">Collected</div>
          </div>
          <div>
            <div className="text-sm font-bold text-cream">
              {results.maxCombo}x
            </div>
            <div className="text-[8px] text-muted">Max Combo</div>
          </div>
          <div>
            <div className="text-sm font-bold text-cream">
              +{results.timeBonus}
            </div>
            <div className="text-[8px] text-muted">Time Bonus</div>
          </div>
        </div>

        {results.rank > 0 && (
          <div className="mt-3 border-t border-border/40 pt-3">
            <span className="text-[9px] text-muted">Rank </span>
            <span className="text-sm font-bold" style={{ color: theme.accent }}>
              #{results.rank}
            </span>
            {results.totalPilots > 0 && (
              <span className="text-[9px] text-muted">
                {" "}
                of {results.totalPilots}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            onClick={onFlyAgain}
            className="btn-press px-5 py-2 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `3px 3px 0 0 ${theme.shadow}`,
            }}
          >
            Fly Again
          </button>
          <Link
            href="/leaderboard?mode=game"
            onClick={onClose}
            className="btn-press border-[2px] border-border px-5 py-2 text-[10px] transition-colors hover:border-border-light"
            style={{ color: theme.accent }}
          >
            See Leaderboard
          </Link>
          <button
            onClick={onClose}
            className="text-[9px] text-muted transition-colors hover:text-cream"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
