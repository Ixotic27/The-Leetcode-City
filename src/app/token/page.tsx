"use client";

import Link from "next/link";

const ACCENT = "#ffa116";

function A({ children }: { children: React.ReactNode }) {
  return <span style={{ color: ACCENT }}>{children}</span>;
}

export default function TokenPage() {
  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-cream sm:mb-8"
        >
          &larr; Back to City
        </Link>

        <h1 className="text-2xl text-cream sm:text-3xl">
          $LCC <span style={{ color: ACCENT }}>Token</span>
        </h1>

        {/* The story */}
        <div className="mt-8 border-[3px] border-border bg-bg-raised p-5 sm:p-8">
          <p className="text-base text-cream sm:text-lg">About $LCC</p>
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted normal-case sm:text-base">
            <p>
              I created LeetCode City. The <A>community is planning</A> the $LCC token.
              I did <A>not create, launch, or request</A> the creation of this
              token.
            </p>
            <p>
              Once launched, transaction fees from the token can help
              support the development of LeetCode City. I&apos;m grateful to the
              community for believing in this project and supporting it.
            </p>
            <p>
              That said, I <A>don&apos;t control</A> the token. Not the supply,
              not the price, not the listings, not any aspect of its market. My
              focus is <A>building LeetCode City</A>. The community will manage the token.
            </p>
          </div>
        </div>

        {/* What I don't do */}
        <div className="mt-5 border-[3px] border-border bg-bg-raised p-5 sm:p-8">
          <p className="text-base text-cream sm:text-lg">What I don&apos;t do</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted normal-case sm:text-base">
            <p><span style={{ color: ACCENT }}>+</span> Make price predictions or promises about the token&apos;s future</p>
            <p><span style={{ color: ACCENT }}>+</span> Manage or endorse groups, channels, or communities related to the token</p>
            <p><span style={{ color: ACCENT }}>+</span> Handle listings, partnerships, or marketing for the token</p>
            <p><span style={{ color: ACCENT }}>+</span> Provide financial advice of any kind</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-5 border-[3px] border-border bg-bg-raised p-5 sm:p-8">
          <p className="text-base text-cream sm:text-lg">Disclaimer</p>
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted normal-case sm:text-base">
            <p>
              This is <A>not financial advice</A>. The token can{" "}
              <A>lose all of its value</A>. If you choose to interact with the
              token, you do so entirely <A>at your own risk</A>.
            </p>
            <p>
              LeetCode City makes no promises, guarantees, or representations about
              the token&apos;s value, future performance, or utility.
            </p>
            <p>
              Be aware that <A>scam tokens</A> may exist using similar names.
              Always verify before interacting with any token.
            </p>
          </div>
        </div>

        {/* Token info */}
        <div className="mt-5 border-[3px] border-border bg-bg-raised p-5 sm:p-8">
          <p className="text-base text-cream sm:text-lg">Token Info</p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted normal-case sm:text-base">
            <div className="flex items-start gap-3">
              <span className="shrink-0" style={{ color: ACCENT }}>Network</span>
              <span>Base (TBD)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0" style={{ color: ACCENT }}>CA</span>
              <span>TBD (To Be Launched by Community)</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
