"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const ACCENT = "#ffa116";
const sb = createBrowserSupabase();

export default function SettingsPage() {
  const [lcUsername, setLcUsername] = useState("");
  const [confirmedUsername, setConfirmedUsername] = useState("");
  const [linkedLc, setLinkedLc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [expectedToken, setExpectedToken] = useState("");

  // Check if user is logged in and already linked
  useEffect(() => {
    sb.auth.getUser()
      .then(({ data: { user } }: { data: { user: User | null } }) => {
        if (!user) {
          setChecking(false);
          return;
        }
        setLoggedIn(true);

        // Generate expected verification token
        const token = "LCC-" + user.id.split("-")[0].toUpperCase();
        setExpectedToken(token);

        // Check existing link
        fetch("/api/link-status")
          .then((r) => r.json())
          .then((data) => {
            if (data.lcUsername) setLinkedLc(data.lcUsername);
          })
          .catch(() => {})
          .finally(() => setChecking(false));
      })
      .catch(() => setChecking(false));
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmedUsername.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/verify-leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leetcode_username: confirmedUsername.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setLinkedLc(data.leetcode_username);
        setLcUsername("");
        setConfirmedUsername("");
        setMessage({ text: `✅ Linked @${data.leetcode_username}! Your building is now yours.`, ok: true });
      } else {
        setMessage({ text: `❌ ${data.error}`, ok: false });
      }
    } catch {
      setMessage({ text: "❌ Something went wrong. Please try again.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-lg px-3 py-6 sm:px-4 sm:py-10">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-cream sm:mb-8"
        >
          &larr; Back to City
        </Link>

        <div className="border-[3px] border-border bg-bg-raised p-6 sm:p-10">
          <h1 className="text-center text-xl text-cream sm:text-2xl">
            <span style={{ color: ACCENT }}>Settings</span>
          </h1>

          {checking ? (
            <p className="mt-6 text-center text-sm text-muted normal-case">
              Loading...
            </p>
          ) : !loggedIn ? (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted normal-case">
                You need to sign in to link your LeetCode account.
              </p>
              <button
                onClick={() => sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}/settings` } })}
                className="mt-4 border-[3px] border-border bg-bg-raised px-6 py-2 text-sm text-cream transition-colors hover:border-[#ffa116]"
              >
                Sign in with GitHub
              </button>
            </div>
          ) : linkedLc ? (
            <div className="mt-6 text-center">
              <div className="border-[3px] border-border bg-bg p-4">
                <p className="text-sm text-muted normal-case">Your LeetCode account</p>
                <p className="mt-2 text-lg text-cream">
                  @<span style={{ color: ACCENT }}>{linkedLc}</span>
                </p>
              </div>
              <p className="mt-4 text-sm text-muted normal-case">
                Your building is linked! Visit the{" "}
                <Link href={`/shop/${linkedLc}`} className="underline" style={{ color: ACCENT }}>
                  Shop
                </Link>{" "}
                to customize it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="mt-6">
              <div className="mb-4">
                <label className="block text-[10px] text-muted mb-2 font-pixel">1. Enter your LeetCode Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lcUsername}
                    onChange={(e) => setLcUsername(e.target.value)}
                    placeholder="LeetCode Username"
                    className="flex-1 bg-black/50 border border-border px-3 py-2 text-[12px] text-cream outline-none focus:border-border-light normal-case"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => { if (lcUsername.trim()) setConfirmedUsername(lcUsername.trim()); }}
                    className="px-3 py-2 text-[11px] border border-border hover:border-border-light text-cream"
                  >
                    Confirm
                  </button>
                </div>
              </div>

              {confirmedUsername && (
                <div className="mb-6">
                  <label className="block text-[10px] text-muted mb-2 font-pixel">2. Verify Ownership</label>
                  <p className="text-[10px] text-cream mb-3 leading-relaxed normal-case">
                    Copy the code below and paste it into your{" "}
                    <a href={`https://leetcode.com/u/${confirmedUsername}`} target="_blank" rel="noreferrer" className="underline text-blue-400 hover:text-blue-300">
                      LeetCode Profile → Edit Profile → About Me
                    </a>. Save, then click Verify.
                  </p>

                  <div className="flex items-center gap-2 bg-black/50 border border-border p-3 mb-4">
                    <code className="text-[12px] flex-1 text-center font-bold" style={{ color: ACCENT }}>{expectedToken}</code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(expectedToken); }}
                      className="text-[10px] bg-white/10 px-2 py-1 hover:bg-white/20"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <p className={`mb-4 text-center text-sm normal-case ${message.ok ? "text-green-400" : "text-red-400"}`}>
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !confirmedUsername}
                className="w-full border-[3px] border-border px-6 py-2 text-sm text-cream transition-colors hover:border-[#ffa116] disabled:cursor-not-allowed disabled:opacity-50"
                style={!loading && confirmedUsername ? { borderColor: ACCENT } : {}}
              >
                {loading ? "Verifying..." : "Verify & Link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}