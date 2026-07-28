import Link from "next/link";
import Skeleton from "@/components/Skeleton";

const ACCENT = "#ffa116";

export default function LeaderboardLoading() {
  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-muted transition-colors hover:text-cream"
          >
            &larr; Back to City
          </Link>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl text-cream md:text-4xl">
            Leader<span style={{ color: ACCENT }}>board</span>
          </h1>
          <p className="mt-3 text-xs text-muted normal-case">
            Top developers ranked in LeetCode City
          </p>
        </div>

        {/* Mode toggle skeleton */}
        <div className="mt-6 flex justify-center">
          <div className="flex border-[2px] border-border bg-bg-raised/50">
            <span className="px-5 py-2 text-[11px] text-muted opacity-60">
              Developers
            </span>
            <span className="border-l-[2px] border-border px-5 py-2 text-[11px] text-muted opacity-60">
              Game
            </span>
            <span className="border-l-[2px] border-border px-5 py-2 text-[11px] text-muted opacity-60">
              Dailies
            </span>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="mt-6 flex flex-wrap justify-center gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-3 py-1.5 border-[2px] border-border bg-bg-raised/20"
            >
              <Skeleton variant="text" width={60} height={10} />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="mt-6 border-[3px] border-border">
          {/* Header row */}
          <div className="flex items-center gap-4 border-b-[3px] border-border bg-bg-card px-5 py-3 text-xs text-muted">
            <span className="w-10 text-center">#</span>
            <span className="flex-1">Developer</span>
            <span className="hidden w-24 text-right sm:block">Language</span>
            <span className="w-28 text-right">Metric</span>
          </div>

          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/50 px-5 py-3.5"
            >
              <span className="w-10 text-center">
                <Skeleton
                  variant="text"
                  width={16}
                  height={12}
                  className="mx-auto"
                />
              </span>

              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <Skeleton
                  variant="circle"
                  width={36}
                  height={36}
                  className="flex-shrink-0"
                />
                <div className="flex-1 space-y-1.5">
                  <Skeleton variant="text" width="60%" height={12} />
                  <Skeleton variant="text" width="40%" height={8} />
                </div>
              </div>

              <span className="hidden w-24 text-right sm:block">
                <Skeleton
                  variant="text"
                  width={50}
                  height={10}
                  className="ml-auto"
                />
              </span>

              <span className="w-28 text-right">
                <Skeleton
                  variant="rectangular"
                  width={70}
                  height={14}
                  className="ml-auto"
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
