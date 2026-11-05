"use client";

import Link from "next/link";
import { useCity } from "@/context/CityContext";
import SearchBar from "./SearchBar";

export default function CityWelcomePanel({ onStartDrive }: { onStartDrive?: () => void }) {
  const city = useCity();
  const { theme, buildings, stats, session, shopHref, flyStartTime: flyStartTimeRef, flyPausedAt: flyPausedAtRef, flyTotalPauseMs: flyTotalPauseMsRef } = city;
  const ready = buildings.length > 0;

  function startFlight() {
    city.setFocusedBuilding(null);
    city.setFlyScore({ score: 0, earned: 0, combo: 0, collected: 0, maxCombo: 1 });
    flyStartTimeRef.current = Date.now();
    flyPausedAtRef.current = 0;
    flyTotalPauseMsRef.current = 0;
    city.setFlyElapsedSec(0);
    city.setQuotaReached(false);
    city.setQuotaNotified(false);
    city.setQuotaDismissed(false);
    try {
      city.setFlyPersonalBest(Number(localStorage.getItem("leetcodecity_fly_pb")) || 0);
      if (!localStorage.getItem("leetcodecity_fly_controls_seen")) city.setShowFlyControls(true);
    } catch { city.setShowFlyControls(true); }
    city.setFlyMode(true);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end p-3 pb-24 sm:items-center sm:p-6 sm:pb-24">
      <section aria-label="Welcome to LeetCode City" className="pointer-events-auto max-h-[calc(100dvh-10rem)] w-full overflow-y-auto border-2 border-border-light bg-bg/95 p-5 shadow-[6px_6px_0_#0005] sm:max-w-[390px] sm:p-6">
        <h1 className="text-2xl leading-tight text-cream sm:text-3xl">LeetCode City</h1>
        <p className="mt-3 text-[11px] leading-6 text-warm normal-case">Your practice builds the skyline. Find your building, explore the islands, or take a lap.</p>
        <div className="my-4 flex flex-wrap gap-x-4 gap-y-1 border-y border-border py-3 text-[10px] normal-case text-muted tabular-nums">
          <span><strong className="text-cream">{stats.total_developers.toLocaleString()}</strong> developers</span>
          <span><strong className="text-cream">{city.districtZones.length}</strong> districts</span>
        </div>
        <label htmlFor="city-search-input" className="mb-2 block text-[10px] text-cream normal-case">Find a LeetCode username</label>
        <SearchBar inline />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button disabled={!ready} onClick={() => city.setExploreMode(true)} className="min-h-14 px-2 text-[10px] text-bg disabled:opacity-40 transition-colors hover:brightness-110" style={{ backgroundColor: theme.accent }}>Explore<span className="mt-1 block text-[8px] normal-case opacity-75">The city</span></button>
          <button disabled={!ready} onClick={startFlight} className="min-h-14 border-2 border-border-light bg-bg-raised px-2 text-[10px] text-cream disabled:opacity-40 transition-colors hover:border-lime">Fly<span className="mt-1 block text-[8px] text-muted normal-case">Collect PX</span></button>
          <button disabled={!ready || !onStartDrive} onClick={onStartDrive} className="min-h-14 border-2 border-border-light bg-bg-raised px-2 text-[10px] text-cream disabled:opacity-40 transition-colors hover:border-lime">Race<span className="mt-1 block text-[8px] text-muted normal-case">Time trial</span></button>
        </div>
        {city.hasFreeGift && <button onClick={city.handleClaimFreeGift} disabled={city.claimingGift} className="mt-3 min-h-11 w-full border border-lime px-3 text-[10px] text-lime disabled:opacity-50">{city.claimingGift ? "Opening gift..." : "Open your free gift"}</button>}
        <nav aria-label="City activities" className="mt-4 grid grid-cols-3 gap-x-2 text-[9px] text-cream normal-case">
          <button onClick={() => city.setEArcadeOpen(true)} className="min-h-11 text-left hover:text-lime">Arcade</button>
          {[['/arena', 'Arena'], ['/leaderboard', 'Leaderboard'], [shopHref, 'Shop'], ['/compare', 'Compare'], ['/roadmap', 'Roadmap']].map(([href, label]) => <Link key={label} href={href} className="flex min-h-11 items-center hover:text-lime">{label}</Link>)}
          <button onClick={() => city.setIsRelicModalOpen(true)} className="min-h-11 text-left hover:text-lime">Relics</button>
          <Link href="/advertise" className="flex min-h-11 items-center hover:text-lime">Advertise</Link>
          <button onClick={() => city.setIsCodexOpen(true)} className="min-h-11 text-left hover:text-lime">Codex</button>
        </nav>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[9px] normal-case">
          {!session ? <button onClick={city.handleSignIn} className="min-h-11 text-lime hover:underline">Sign in with GitHub</button> : city.needsToLink ? <button onClick={() => city.setShowLinkModal(true)} className="min-h-11 text-lime hover:underline">Link LeetCode profile</button> : <Link href={`/dev/${encodeURIComponent(city.linkedLeetCodeUsername ?? '')}`} className="flex min-h-11 items-center text-lime hover:underline">My profile</Link>}
          <Link href="/support" className="flex min-h-11 items-center text-muted hover:text-cream">Support the city</Link>
          {session && <button onClick={city.handleSignOut} className="min-h-11 text-muted hover:text-cream">Sign out</button>}
        </div>
        <p className="mt-2 text-[8px] leading-4 text-muted normal-case">Built by <a href="https://github.com/Ixotic27" target="_blank" rel="noopener noreferrer" className="underline hover:text-cream">Ixotic</a>. Inspired by <a href="https://github.com/srizzon/git-city" target="_blank" rel="noopener noreferrer" className="underline hover:text-cream">Git City</a>.</p>
      </section>
    </div>
  );
}
