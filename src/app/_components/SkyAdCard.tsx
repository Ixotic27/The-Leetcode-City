"use client";

interface SkyAd {
  id: string;
  vehicle: string;
  brand?: string | null;
  description?: string | null;
  link?: string | null;
  color: string;
}

interface SkyAdCardProps {
  ad: SkyAd;
  ctaHref: string | null;
  theme: {
    accent: string;
    shadow: string;
  };
  onClose: () => void;
  onCtaClick: () => void;
}

function getVehicleIcon(vehicle: string) {
  if (vehicle === "blimp") return "\u25C6";
  if (vehicle === "billboard") return "\uD83D\uDCCB";
  if (vehicle === "rooftop_sign") return "\uD83D\uDD04";
  if (vehicle === "led_wrap") return "\uD83D\uDCA1";
  return "\u2708";
}

function getCtaText(link: string) {
  if (link.startsWith("mailto:")) return "Send Email \u2192";
  return `Visit ${new URL(link).hostname.replace("www.", "")} \u2192`;
}

export default function SkyAdCard({
  ad,
  ctaHref,
  theme,
  onClose,
  onCtaClick,
}: SkyAdCardProps) {
  const isMailto = ad.link?.startsWith("mailto:") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="pointer-events-none flex h-full items-end sm:items-center sm:justify-center">
        <div
          className="pointer-events-auto relative w-full border-t-[3px] border-border bg-bg-raised/95 backdrop-blur-sm
            sm:w-[340px] sm:mx-4 sm:border-[3px]
            animate-[slide-up_0.2s_ease-out] sm:animate-[fade-in_0.15s_ease-out]"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream z-10 cursor-pointer"
          >
            ESC
          </button>

          <div className="flex justify-center py-2 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          <div className="flex items-center gap-3 px-4 pb-3 sm:pt-4">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center border-[2px]"
              style={{
                borderColor: ad.color,
                color: ad.color,
              }}
            >
              <span className="text-sm">{getVehicleIcon(ad.vehicle)}</span>
            </div>
            <div className="min-w-0 flex-1">
              {ad.brand && (
                <p className="truncate text-sm text-cream">{ad.brand}</p>
              )}
              <p className="text-[9px] text-dim">Sponsored</p>
            </div>
          </div>

          <div className="mx-4 mb-3 h-px bg-border" />

          {ad.description && (
            <p className="mx-4 mb-4 text-xs text-cream normal-case leading-relaxed">
              {ad.description}
            </p>
          )}

          {ad.link && ctaHref && (
            <div className="px-4 pb-5 sm:pb-4">
              <a
                href={ctaHref}
                target={isMailto ? undefined : "_blank"}
                rel={isMailto ? undefined : "noopener noreferrer"}
                className="btn-press block w-full py-2.5 text-center text-[10px] text-bg"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                }}
                onClick={onCtaClick}
              >
                {getCtaText(ad.link)}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
