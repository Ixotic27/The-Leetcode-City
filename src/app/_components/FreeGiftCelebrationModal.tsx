"use client";

import Link from "next/link";

interface FreeGiftCelebrationModalProps {
  shopHref: string;
  theme: {
    accent: string;
    shadow: string;
  };
  onClose: () => void;
  onViewCity: () => void;
}

const UPGRADE_ITEMS = [
  { emoji: "\uD83C\uDF3F", name: "Garden", price: "$0.75" },
  { emoji: "\u2728", name: "Neon", price: "$1.00" },
  { emoji: "\uD83D\uDD25", name: "Fire", price: "$1.00" },
];

export default function FreeGiftCelebrationModal({
  shopHref,
  theme,
  onClose,
  onViewCity,
}: FreeGiftCelebrationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-7 animate-[gift-bounce_0.5s_ease-out]"
        style={{ borderColor: theme.accent + "60" }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
        >
          ESC
        </button>

        <div className="text-3xl sm:text-4xl mb-3">{"\uD83C\uDF89"}</div>
        <p className="text-sm text-cream sm:text-base">Gift Unlocked!</p>

        <div className="mt-4 inline-flex items-center gap-3 border-[2px] border-border bg-bg-card px-5 py-3">
          <span className="text-2xl">{"\uD83C\uDFC1"}</span>
          <div className="text-left">
            <p className="text-xs text-cream">Flag</p>
            <p className="text-[9px] text-muted normal-case">
              A flag on top of your building
            </p>
          </div>
        </div>

        <div className="mt-5 w-full max-w-[280px]">
          <p className="mb-2 text-[9px] tracking-widest text-muted uppercase">
            Upgrade your building
          </p>
          <div className="grid grid-cols-3 gap-2">
            {UPGRADE_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={shopHref}
                onClick={onClose}
                className="flex flex-col items-center gap-1 border-[2px] border-border bg-bg-card px-2 py-2.5 transition-colors hover:border-border-light"
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[8px] text-cream leading-tight">
                  {item.name}
                </span>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: theme.accent }}
                >
                  {item.price}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            onClick={onViewCity}
            className="btn-press px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `3px 3px 0 0 ${theme.shadow}`,
            }}
          >
            View in City
          </button>
          <Link
            href={shopHref}
            onClick={onClose}
            className="btn-press border-[3px] border-border px-5 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
          >
            Visit Shop {"â†’"}
          </Link>
        </div>
      </div>
    </div>
  );
}
