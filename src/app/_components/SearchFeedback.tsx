"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";

const LOADING_PHASES = [
  { delay: 0, text: "Fetching LeetCode profile..." },
  { delay: 2000, text: "Analyzing submissions..." },
  { delay: 5000, text: "Building the city block..." },
  { delay: 9000, text: "Almost there..." },
  { delay: 13000, text: "This one's a big profile. Hang tight..." },
];

const ERROR_MESSAGES: Record<
  string,
  {
    primary: (u: string) => string;
    secondary: string;
    hasRetry?: boolean;
    hasLink?: boolean;
  }
> = {
  "not-found": {
    primary: (u) => `"@${u}" doesn't exist on LeetCode`,
    secondary:
      "Check the spelling — could be a typo. LeetCode usernames are case-insensitive.",
  },
  org: {
    primary: (u) => `"@${u}" is an organization, not a person`,
    secondary:
      "LeetCode City is for individual profiles. Try searching for one of its contributors by their personal username.",
  },
  "no-activity": {
    primary: (u) => `"@${u}" has no public activity yet`,
    secondary:
      "Is this you? Open your profile settings, scroll to 'Contributions & activity', and enable 'Include private contributions'. Then search again.",
    hasLink: true,
  },
  "rate-limit": {
    primary: () => "Search limit reached",
    secondary:
      "You can look up 10 new profiles per hour. Developers already in the city are unlimited.",
  },
  "github-rate-limit": {
    primary: () => "LeetCode's API is temporarily unavailable",
    secondary: "Too many requests to LeetCode. Try again in a few minutes.",
  },
  network: {
    primary: () => "Couldn't reach the server",
    secondary: "Check your internet connection and try again.",
    hasRetry: true,
  },
  generic: {
    primary: () => "Something went wrong",
    secondary: "An unexpected error occurred. Try again.",
    hasRetry: true,
  },
};

interface SearchFeedbackProps {
  feedback: {
    type: "loading" | "error";
    code?: string;
    username?: string;
    raw?: string;
  } | null;
  accentColor: string;
  onDismiss: () => void;
  onRetry: () => void;
}

export default function SearchFeedback({
  feedback,
  accentColor,
  onDismiss,
  onRetry,
}: SearchFeedbackProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (feedback?.type !== "loading") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhaseIndex(0);
      return;
    }
    const timers = LOADING_PHASES.map((phase, i) =>
      setTimeout(() => setPhaseIndex(i), phase.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [feedback?.type]);

  useEffect(() => {
    if (feedback?.type !== "error") return;
    const code = feedback.code ?? "generic";
    if (code === "no-activity" || code === "network" || code === "generic")
      return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  if (feedback.type === "loading") {
    return (
      <div
        className="relative w-full max-w-md border-[3px] bg-bg-raised/90 px-5 py-5 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
        style={{ borderColor: accentColor + "66" }}
      >
        <div className="flex items-center gap-4 mb-5">
          <Skeleton
            variant="circle"
            width={52}
            height={52}
            className="border-[2px] border-border/50"
          />
          <div className="flex-1 space-y-2.5">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Skeleton variant="rectangular" className="w-full" height={45} />
          <Skeleton variant="rectangular" className="w-full" height={45} />
          <Skeleton variant="rectangular" className="w-full" height={45} />
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border/30">
          <span
            className="blink-dot h-2 w-2 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[11px] text-muted normal-case">
            {LOADING_PHASES[phaseIndex].text}
          </span>
        </div>
      </div>
    );
  }

  const code = feedback.code ?? "generic";
  const msg = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.generic;
  const u = feedback.username ?? "";

  return (
    <div
      className="relative w-full max-w-md border-[3px] bg-bg-raised/90 px-4 py-3 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
      style={{
        borderColor:
          code === "rate-limit" ? accentColor + "66" : "rgba(248, 81, 73, 0.4)",
      }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-[10px] text-muted transition-colors hover:text-cream"
      >
        &#10005;
      </button>
      <p className="text-[11px] text-cream normal-case pr-4">
        {msg.primary(u)}
      </p>
      <p className="mt-1 text-[10px] text-muted normal-case">{msg.secondary}</p>
      {msg.hasLink && (
        <a
          href="https://leetcode.com/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[10px] normal-case transition-colors hover:text-cream"
          style={{ color: accentColor }}
        >
          Open Profile Settings &rarr;
        </a>
      )}
      {msg.hasRetry && (
        <button
          onClick={onRetry}
          className="btn-press mt-2 border-[2px] border-border px-3 py-1 text-[10px] text-cream transition-colors hover:border-border-light"
        >
          Retry
        </button>
      )}
    </div>
  );
}
