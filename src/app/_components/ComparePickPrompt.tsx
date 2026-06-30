"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { CityBuilding } from "@/lib/github";
import SearchBar from "@/components/SearchBar";
import SearchFeedback from "./SearchFeedback";

interface SearchFeedbackState {
  type: "loading" | "error";
  code?:
    | "not-found"
    | "org"
    | "no-activity"
    | "rate-limit"
    | "github-rate-limit"
    | "network"
    | "generic";
  username?: string;
  raw?: string;
}

interface ComparePickPromptProps {
  compareBuilding: CityBuilding;
  compareSelfHint: boolean;
  username: string;
  feedback: SearchFeedbackState | null;
  loading: boolean;
  theme: {
    accent: string;
    shadow: string;
  };
  onUsernameChange: Dispatch<SetStateAction<string>>;
  onFeedbackChange: Dispatch<SetStateAction<SearchFeedbackState | null>>;
  onSearchUser: (event?: FormEvent) => void;
  onCancel: () => void;
}

export default function ComparePickPrompt({
  compareBuilding,
  compareSelfHint,
  username,
  feedback,
  loading,
  theme,
  onUsernameChange,
  onFeedbackChange,
  onSearchUser,
  onCancel,
}: ComparePickPromptProps) {
  return (
    <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm sm:top-4 sm:w-auto">
      <div className="border-[3px] border-border bg-bg-raised/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="blink-dot h-2 w-2 flex-shrink-0"
            style={{ backgroundColor: theme.accent }}
          />
          <span className="text-[10px] text-cream normal-case truncate min-w-0">
            Comparing{" "}
            <span style={{ color: theme.accent }}>
              @{compareBuilding.login}
            </span>
          </span>
          <button
            onClick={onCancel}
            className="ml-1 flex-shrink-0 text-[9px] text-muted transition-colors hover:text-cream"
          >
            Cancel
          </button>
        </div>
        {compareSelfHint && (
          <p
            className="mt-1 text-[9px] normal-case"
            style={{ color: "#f85149" }}
          >
            Pick a different building to compare
          </p>
        )}
        <SearchBar
          username={username}
          setUsername={onUsernameChange}
          feedback={feedback}
          setFeedback={onFeedbackChange}
          loading={loading}
          theme={theme}
          searchUser={onSearchUser}
        />
        {feedback && (
          <div className="mt-1.5">
            <SearchFeedback
              feedback={feedback}
              accentColor={theme.accent}
              onDismiss={() => onFeedbackChange(null)}
              onRetry={onSearchUser}
            />
          </div>
        )}
      </div>
    </div>
  );
}
