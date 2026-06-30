"use client";

import UserProfile from "@/components/UserProfile";

interface ShareData {
  login: string;
  contributions: number;
  rank: number | null;
  avatar_url: string | null;
}

interface ShareModalProps {
  shareData: ShareData;
  copied: boolean;
  theme: {
    accent: string;
    shadow: string;
  };
  onClose: () => void;
  onExploreBuilding: () => void;
  onShareX: () => void;
  onCopyLink: () => void;
}

export default function ShareModal({
  shareData,
  copied,
  theme,
  onClose,
  onExploreBuilding,
  onShareX,
  onCopyLink,
}: ShareModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-3 border-[3px] border-border bg-bg-raised p-4 text-center sm:mx-0 sm:p-6">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
        >
          &#10005;
        </button>

        <UserProfile shareData={shareData} theme={theme} />

        <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5 sm:flex-row sm:justify-center sm:gap-3">
          <button
            onClick={onExploreBuilding}
            className="btn-press px-4 py-2 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `3px 3px 0 0 ${theme.shadow}`,
            }}
          >
            Explore Building
          </button>

          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `My LeetCode just turned into a city building! ${shareData.contributions.toLocaleString()} LeetCode algorithms solved, Rank #${shareData.rank ?? "?"}. What does yours look like?`,
            )}&url=${encodeURIComponent(
              `${window.location.origin}/dev/${shareData.login}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onShareX}
            className="btn-press border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
          >
            Share on X
          </a>

          <button
            onClick={onCopyLink}
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
