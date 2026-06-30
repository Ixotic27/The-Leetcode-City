"use client";

import type { FormEvent } from "react";

interface LinkLeetCodeModalProps {
  linkedLeetCodeUsername: string | null;
  resetMsg: string;
  resetting: boolean;
  linkInput: string;
  confirmedUsername: string;
  expectedToken: string;
  linkError: string;
  linking: boolean;
  theme: {
    accent: string;
    shadow: string;
  };
  onClose: () => void;
  onResetClaim: () => void;
  onVerifyLeetCode: (event: FormEvent) => void;
  onLinkInputChange: (value: string) => void;
  onConfirmUsername: (value: string) => void;
}

export default function LinkLeetCodeModal({
  linkedLeetCodeUsername,
  resetMsg,
  resetting,
  linkInput,
  confirmedUsername,
  expectedToken,
  linkError,
  linking,
  theme,
  onClose,
  onResetClaim,
  onVerifyLeetCode,
  onLinkInputChange,
  onConfirmUsername,
}: LinkLeetCodeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
      <div className="w-full max-w-sm border-[3px] border-border bg-bg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-muted hover:text-cream text-lg"
        >
          &#10005;
        </button>
        <h2
          className="text-xl text-cream mb-4 font-pixel"
          style={{ color: theme.accent }}
        >
          Link LeetCode
        </h2>

        {linkedLeetCodeUsername ? (
          <div className="space-y-4">
            <div className="p-3 border border-border/50 bg-bg-card text-[11px] text-cream">
              Currently linked to:{" "}
              <span style={{ color: theme.accent }} className="font-bold">
                @{linkedLeetCodeUsername}
              </span>
            </div>
            {resetMsg && (
              <div className="p-2 border border-border/50 text-[10px] text-muted">
                {resetMsg}
              </div>
            )}
            <button
              onClick={onResetClaim}
              disabled={resetting}
              className="w-full btn-press py-3 text-[11px] disabled:opacity-50 border-[2px] border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              {resetting ? "Resetting..." : "Reset Claim (Unlink)"}
            </button>
          </div>
        ) : (
          <form onSubmit={onVerifyLeetCode}>
            <div className="mb-4">
              <label className="block text-[10px] text-muted mb-2 font-pixel">
                1. Enter your LeetCode Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => onLinkInputChange(e.target.value)}
                  placeholder="LeetCode Username"
                  className="flex-1 bg-black/50 border border-border px-3 py-2 text-[12px] text-cream outline-none focus:border-border-light"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (linkInput.trim()) onConfirmUsername(linkInput.trim());
                  }}
                  className="px-3 py-2 text-[11px] border border-border hover:border-border-light text-cream"
                >
                  Confirm
                </button>
              </div>
            </div>

            {confirmedUsername && (
              <div className="mb-6 animate-[fade-in_0.2s_ease-out]">
                <label className="block text-[10px] text-muted mb-2 font-pixel">
                  2. Verify Ownership
                </label>
                <p className="text-[10px] text-cream mb-3 leading-relaxed">
                  Copy the code below and paste it into your{" "}
                  <a
                    href={`https://leetcode.com/u/${confirmedUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-400 hover:text-blue-300"
                  >
                    LeetCode Profile â†’ Edit Profile â†’ About Me
                  </a>
                  . Save, then click Verify.
                </p>

                <div className="flex items-center gap-2 bg-black/50 border border-border p-3 mb-2">
                  <code
                    className="text-[12px] flex-1 text-center font-bold"
                    style={{ color: theme.accent }}
                  >
                    {expectedToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(expectedToken);
                    }}
                    className="text-[10px] bg-white/10 px-2 py-1 hover:bg-white/20"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {linkError && (
              <div className="mb-4 p-2 border border-red-500/50 bg-red-500/10 text-red-400 text-[10px]">
                {linkError}
              </div>
            )}

            <button
              type="submit"
              disabled={linking || !linkInput.trim()}
              className="w-full btn-press py-3 text-[12px] disabled:opacity-50 text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `3px 3px 0 0 ${theme.shadow}`,
              }}
            >
              {linking ? "Verifying..." : "Verify & Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
