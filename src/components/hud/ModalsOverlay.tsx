/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useCity } from "@/context/CityContext";
import Link from "next/link";
import UserProfile from "@/components/UserProfile";
import { buildAdLink, trackAdEvents } from "@/lib/skyAds";
import { trackSkyAdCtaClick } from "@/lib/himetrica";
import { track } from "@vercel/analytics";

// Lazy-load heavier overlays to optimize load performance and bypass SSR errors
const CodexModal = dynamic(() => import("@/components/CodexModal"), { ssr: false });
const RelicModal = dynamic(() => import("@/components/RelicModal"), { ssr: false });
const PillModal = dynamic(() => import("@/components/PillModal"), { ssr: false });
const EArcadeCard = dynamic(() => import("@/components/EArcadeCard"), { ssr: false });
const ZenCodingModal = dynamic(() => import("@/components/ZenCodingModal"), { ssr: false });
const CodeForgeModal = dynamic(() => import("@/components/CodeForgeModal"), { ssr: false });
const SolanaModal = dynamic(() => import("@/components/SolanaModal"), { ssr: false });
const FounderMessage = dynamic(() => import("@/components/FounderMessage"), { ssr: false });

/* ─── Free Gift Celebration Modal Helper ─── */
function GiftClaimModal({
  onClose,
  accent,
  shadow,
  shopHref,
  myBuilding,
  setFocusedBuilding,
  setSelectedBuilding,
  setExploreMode,
}: {
  onClose: () => void;
  accent: string;
  shadow: string;
  shopHref: string;
  myBuilding: any;
  setFocusedBuilding: (login: string) => void;
  setSelectedBuilding: (b: any) => void;
  setExploreMode: (b: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-7 animate-[gift-bounce_0.5s_ease-out]"
        style={{ borderColor: accent + "60" }}
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
            {[
              { emoji: "\uD83C\uDF3F", name: "Garden", price: "$0.75" },
              { emoji: "\u2728", name: "Neon", price: "$1.00" },
              { emoji: "\uD83D\uDD25", name: "Fire", price: "$1.00" },
            ].map((item) => (
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
                  style={{ color: accent }}
                >
                  {item.price}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            onClick={() => {
              onClose();
              if (myBuilding) {
                setFocusedBuilding(myBuilding.login);
                setSelectedBuilding(myBuilding);
                setExploreMode(true);
              }
            }}
            className="btn-press px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: accent,
              boxShadow: `3px 3px 0 0 ${shadow}`,
            }}
          >
            View in City
          </button>
          <Link
            href={shopHref}
            onClick={onClose}
            className="btn-press border-[3px] border-border px-5 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
          >
            Visit Shop {"→"}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Share Profile Card Modal Helper ─── */
function ShareCardModal({
  shareData,
  accent,
  shadow,
  onClose,
  buildings,
  setSelectedBuilding,
  setFocusedBuilding,
  setExploreMode,
}: {
  shareData: any;
  accent: string;
  shadow: string;
  onClose: () => void;
  buildings: any[];
  setSelectedBuilding: (b: any) => void;
  setFocusedBuilding: (login: string) => void;
  setExploreMode: (b: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative mx-3 border-[3px] border-border bg-bg-raised p-4 text-center sm:mx-0 sm:p-6">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
        >
          &#10005;
        </button>
        <UserProfile shareData={shareData} theme={{ accent }} />
        <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5 sm:flex-row sm:justify-center sm:gap-3">
          <button
            onClick={() => {
              const b = buildings.find(
                (x) => x.login.toLowerCase() === shareData.login.toLowerCase()
              );
              if (b) {
                setSelectedBuilding(b);
                setFocusedBuilding(b.login);
              }
              onClose();
              setExploreMode(true);
            }}
            className="btn-press px-4 py-2 text-[10px] text-bg"
            style={{
              backgroundColor: accent,
              boxShadow: `3px 3px 0 0 ${shadow}`,
            }}
          >
            Explore Building
          </button>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `My LeetCode just turned into a city building! ${shareData.contributions.toLocaleString()} LeetCode algorithms solved, Rank #${shareData.rank ?? "?"}. What does yours look like?`
            )}&url=${encodeURIComponent(
              `${window.location.origin}/dev/${shareData.login}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
          >
            Share on X
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/dev/${shareData.login}`
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="btn-press border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <a
          href={`/dev/${shareData.login}`}
          className="mt-4 inline-block text-[9px] text-muted transition-colors hover:text-cream normal-case"
        >
          View full profile &rarr;
        </a>
      </div>
    </div>
  );
}

/* ─── Sky Ad Detail Modal Helper ─── */
function AdDetailModal({
  clickedAd,
  accent,
  shadow,
  onClose,
  authLogin,
  trackAdEvents,
  trackSkyAdCtaClick,
}: {
  clickedAd: any;
  accent: string;
  shadow: string;
  onClose: () => void;
  authLogin: string;
  trackAdEvents: any;
  trackSkyAdCtaClick: any;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="pointer-events-none flex h-full items-end sm:items-center sm:justify-center">
        <div
          className="pointer-events-auto relative w-full border-t-[3px] border-border bg-bg-raised/95 backdrop-blur-sm
            sm:w-[340px] sm:mx-4 sm:border-[3px]
            animate-[slide-up_0.2s_ease-out] sm:animate-[fade-in_0.15s_ease-out]"
          onClick={(e) => e.stopPropagation()}
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
                borderColor: clickedAd.color,
                color: clickedAd.color,
              }}
            >
              <span className="text-sm">
                {clickedAd.vehicle === "blimp"
                  ? "\u25C6"
                  : clickedAd.vehicle === "billboard"
                    ? "\uD83D\uDCCB"
                    : clickedAd.vehicle === "rooftop_sign"
                      ? "\uD83D\uDD04"
                      : clickedAd.vehicle === "led_wrap"
                        ? "\uD83D\uDCA1"
                        : "\u2708"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {clickedAd.brand && (
                <p className="truncate text-sm text-cream">
                  {clickedAd.brand}
                </p>
              )}
              <p className="text-[9px] text-dim">Sponsored</p>
            </div>
          </div>
          <div className="mx-4 mb-3 h-px bg-border" />
          {clickedAd.description && (
            <p className="mx-4 mb-4 text-xs text-cream normal-case leading-relaxed">
              {clickedAd.description}
            </p>
          )}
          {clickedAd.link &&
            (() => {
              const ctaHref = buildAdLink(clickedAd) ?? clickedAd.link;
              const isMailto = clickedAd.link.startsWith("mailto:");
              return (
                <div className="px-4 pb-5 sm:pb-4">
                  <a
                    href={ctaHref}
                    target={isMailto ? undefined : "_blank"}
                    rel={isMailto ? undefined : "noopener noreferrer"}
                    className="btn-press block w-full py-2.5 text-center text-[10px] text-bg"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `4px 4px 0 0 ${shadow}`,
                    }}
                    onClick={() => {
                      track("sky_ad_click", {
                        ad_id: clickedAd.id,
                        vehicle: clickedAd.vehicle,
                        brand: clickedAd.brand ?? "",
                      });
                      trackAdEvents(
                        clickedAd.id,
                        ["cta_click"],
                        authLogin || undefined
                      );
                      trackSkyAdCtaClick(clickedAd.id, clickedAd.vehicle);
                    }}
                  >
                    {isMailto
                      ? "Send Email \u2192"
                      : `Visit ${new URL(clickedAd.link!).hostname.replace("www.", "")} \u2192`}
                  </a>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

export default function ModalsOverlay() {
  const {
    isCodexOpen,
    setIsCodexOpen,
    theme,
    isRelicModalOpen,
    setIsRelicModalOpen,
    equippedRelicId,
    handleEquipRelic,
    giftClaimed,
    setGiftClaimed,
    shareData,
    setShareData,
    pillModalOpen,
    setPillModalOpen,
    eArcadeOpen,
    setEArcadeOpen,
    zenCodingOpen,
    setZenCodingOpen,
    codeForgeOpen,
    setCodeForgeOpen,
    solanaOpen,
    setSolanaOpen,
    clickedAd,
    setClickedAd,
    session,
    relics,
    relicFocus,
    setRelicFocus,
    myBuilding,
    setFocusedBuilding,
    setSelectedBuilding,
    setExploreMode,
    buildings,
    shopHref,
    handleSignIn,
    rabbitProgress,
    setRabbitSighting,
    setRabbitCinematic,
    rabbitCinematic,
    rabbitCinematicPhase,
    endRabbitCinematic,
    onRabbitCaught,
    rabbitSighting,
  } = useCity();

  const [founderMessageOpen, setFounderMessageOpen] = useState(false);

  const authLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const selfLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const linkedLeetCodeUsername = useCity().linkedLeetCodeUsername;

  return (
    <>
      {/* Codex Modal */}
      {isCodexOpen && (
        <CodexModal
          isOpen={isCodexOpen}
          onClose={() => setIsCodexOpen(false)}
          accentColor={theme.accent}
          shadowColor={theme.shadow}
        />
      )}

      {/* Relic Vault Modal */}
      {isRelicModalOpen && (
        <RelicModal
          isOpen={isRelicModalOpen}
          onClose={() => setIsRelicModalOpen(false)}
          equippedRelicId={equippedRelicId}
          onEquip={handleEquipRelic}
          relics={relics}
          accentColor={theme.accent}
          shadowColor={theme.shadow}
        />
      )}

      {/* Gift Unboxed Claim Popover */}
      {giftClaimed && (
        <GiftClaimModal
          onClose={() => setGiftClaimed(false)}
          accent={theme.accent}
          shadow={theme.shadow}
          shopHref={shopHref}
          myBuilding={myBuilding}
          setFocusedBuilding={setFocusedBuilding}
          setSelectedBuilding={setSelectedBuilding}
          setExploreMode={setExploreMode}
        />
      )}

      {/* Share / Profile Card Generator Modal */}
      {shareData && (
        <ShareCardModal
          shareData={shareData}
          accent={theme.accent}
          shadow={theme.shadow}
          onClose={() => setShareData(null)}
          buildings={buildings}
          setSelectedBuilding={setSelectedBuilding}
          setFocusedBuilding={setFocusedBuilding}
          setExploreMode={setExploreMode}
        />
      )}

      {/* Pill Modal */}
      {pillModalOpen && (
        <PillModal
          rabbitCompleted={rabbitProgress >= 5}
          onRedPill={() => {
            setPillModalOpen(false);
            setFounderMessageOpen(true);
          }}
          onBluePill={() => {
            setPillModalOpen(false);
            if (rabbitProgress >= 5) return;
            setRabbitSighting(rabbitProgress + 1);
            setRabbitCinematic(true);
          }}
          onClose={() => setPillModalOpen(false)}
        />
      )}

      {/* Founder Message Modal */}
      {founderMessageOpen && (
        <FounderMessage onClose={() => setFounderMessageOpen(false)} />
      )}

      {/* E-Arcade Card Modal */}
      {eArcadeOpen && (
        <EArcadeCard
          onClose={() => setEArcadeOpen(false)}
          onEnter={() => {
            window.location.href = "/arcade";
          }}
          session={session}
          onSignIn={handleSignIn}
        />
      )}

      {/* Zen Coding Modal */}
      {zenCodingOpen && (
        <ZenCodingModal onClose={() => setZenCodingOpen(false)} />
      )}

      {/* Code Forge Modal */}
      {codeForgeOpen && (
        <CodeForgeModal onClose={() => setCodeForgeOpen(false)} />
      )}

      {/* Solana Wallet Modal */}
      {solanaOpen && (
        <SolanaModal onClose={() => setSolanaOpen(false)} />
      )}

      {/* Sky/Billboard Ad Modal */}
      {clickedAd && (
        <AdDetailModal
          clickedAd={clickedAd}
          accent={theme.accent}
          shadow={theme.shadow}
          onClose={() => setClickedAd(null)}
          authLogin={authLogin}
          trackAdEvents={trackAdEvents}
          trackSkyAdCtaClick={trackSkyAdCtaClick}
        />
      )}
    </>
  );
}
