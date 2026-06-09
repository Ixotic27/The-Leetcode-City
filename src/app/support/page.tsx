"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

const ACCENT = "#ffa116";

function SupportContent() {
  const searchParams = useSearchParams();
  const thanksParam = searchParams.get("thanks") === "true";
  const orderIdParam = searchParams.get("order_id");

  const [verifiedThanks, setVerifiedThanks] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(!!orderIdParam);

  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progress, setProgress] = useState<{ raised_inr: number; target_inr: number } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    if (orderIdParam) {
      const verify = async () => {
        try {
          const res = await fetch(`/api/support/status?order_id=${orderIdParam}`);
          if (res.ok) {
            const data = await res.json();
            if (data.isPaid) {
              setVerifiedThanks(true);
            }
          }
        } catch (err) {
          console.error("Error verifying payment:", err);
        } finally {
          setVerifyingPayment(false);
        }
      };
      verify();
    } else if (thanksParam) {
      setVerifiedThanks(true);
      setVerifyingPayment(false);
    }
  }, [thanksParam, orderIdParam]);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const supabase = createBrowserSupabase();
        const { data, error } = await supabase
          .from("items")
          .select("metadata")
          .eq("id", "support_renewal")
          .single();
        if (data && data.metadata) {
          const meta = data.metadata as { raised_inr?: number; target_inr?: number };
          setProgress({
            raised_inr: meta.raised_inr ?? 0,
            target_inr: meta.target_inr ?? 2900,
          });
        }
      } catch (err) {
        console.warn("Failed to fetch support renewal progress:", err);
      } finally {
        setLoadingProgress(false);
      }
    };
    fetchProgress();
  }, []);

  const handleCashfreeCheckout = async (amount: number) => {
    if (loadingAmount) return;
    setError(null);
    setPhoneError(null);

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || !/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setPhoneError("A valid 10-digit Indian phone number is required");
      return;
    }

    setLoadingAmount(amount);

    try {
      const res = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, phone: trimmedPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (data.paymentSessionId) {
        try {
          const { load } = await import("@cashfreepayments/cashfree-js");
          const envMode = (process.env.NEXT_PUBLIC_CASHFREE_ENV ?? "SANDBOX").replace(/['"]/g, "").trim();
          const cashfreeEnv = envMode === "PRODUCTION" ? "production" : "sandbox";
          const cashfree = await load({ mode: cashfreeEnv as "sandbox" | "production" });
          const result = await cashfree.checkout({
            paymentSessionId: data.paymentSessionId,
            redirectTarget: "_self",
          });
          if (result.error) {
            setError(result.error.message || "Payment failed");
          }
        } catch (sdkErr) {
          console.error("Cashfree SDK error:", sdkErr);
          setError("Payment gateway failed to load. Try again.");
        }
      }
    } catch (err) {
      console.warn("[app/support/page.tsx] error:", err);
      setError("Failed to connect. Try again.");
    } finally {
      setLoadingAmount(null);
    }
  };

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
          Keep the <span style={{ color: ACCENT }}>Signal</span> Alive
        </h1>
        <p className="mt-2 text-xs text-muted normal-case sm:text-sm">
          LeetCode City runs on servers, databases, and API calls. Every new building
          that goes up, the cost goes up with it. Your support keeps this city
          running.
        </p>

        {/* Progress Bar for Website Renewal */}
        <div className="mt-6 border-[3px] border-border bg-bg-raised p-5 sm:p-6 relative overflow-hidden">
          {/* Grid background effect */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,161,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,161,22,0.02)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs tracking-wider" style={{ color: ACCENT }}>
                  &gt; Campaign: Website Renewal
                </p>
                <p className="mt-1 text-[10px] text-muted normal-case">
                  Secures the domain name (theleetcodecity.tech) and basic server hosting for another 12 months.
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right mt-1 sm:mt-0">
                <span className="font-pixel text-lg text-cream">
                  {loadingProgress ? "..." : `₹${progress?.raised_inr.toLocaleString()}`}
                </span>
                <span className="font-pixel text-xs text-muted">
                  {loadingProgress ? " / ₹2,900" : ` / ₹${progress?.target_inr.toLocaleString()} INR`}
                </span>
              </div>
            </div>

            {/* Progress Bar Track */}
            <div className="mt-4 h-6 border-[2px] border-border bg-black/40 relative p-[2px]">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 relative transition-all duration-1000 ease-out"
                style={{
                  width: `${loadingProgress ? 0 : Math.min(100, Math.max(0, ((progress?.raised_inr ?? 0) / (progress?.target_inr ?? 2900)) * 100))}%`,
                  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
                }}
              >
                {/* Glow effect on progress bar */}
                <div className="absolute inset-y-0 right-0 w-2 bg-white/40 shadow-[0_0_8px_#ffa116]" />
              </div>
              
              {/* Centered Percentage Text */}
              <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] text-cream drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] font-bold">
                {loadingProgress 
                  ? "LOADING DATA..." 
                  : `${Math.round(((progress?.raised_inr ?? 0) / (progress?.target_inr ?? 2900)) * 100)}% FUNDED`
                }
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[8px] sm:text-[9px] text-muted">
              <span>STATUS: {
                loadingProgress 
                  ? "CHECKING SIGNAL..." 
                  : (progress?.raised_inr ?? 0) >= (progress?.target_inr ?? 2900) 
                    ? "GOAL ACHIEVED! THANK YOU!" 
                    : "ACTIVE — AWAITING POWER"
              }</span>
              <span>
                {!loadingProgress && `${Math.max(0, (progress?.target_inr ?? 2900) - (progress?.raised_inr ?? 0))} INR REMAINING`}
              </span>
            </div>
          </div>
        </div>

        {/* Thank you banner */}
        {verifyingPayment && (
          <div className="mt-6 border-[3px] p-5 sm:p-6 border-muted bg-bg-raised animate-pulse">
            <p className="text-sm text-muted">Verifying your support payment...</p>
          </div>
        )}
        {!verifyingPayment && verifiedThanks && (
          <div
            className="mt-6 border-[3px] p-5 sm:p-6"
            style={{ borderColor: ACCENT, backgroundColor: "rgba(255, 161, 22, 0.06)" }}
          >
            <p className="text-sm" style={{ color: ACCENT }}>
              Thank you for your support
            </p>
            <p className="mt-2 text-xs text-muted normal-case">
              Your contribution keeps the city running. You are a real one.
            </p>
          </div>
        )}
        {!verifyingPayment && (orderIdParam || thanksParam) && !verifiedThanks && (
          <div
            className="mt-6 border-[3px] p-5 sm:p-6 border-red-500 bg-red-500/5"
            style={{ borderColor: "#f87171" }}
          >
            <p className="text-sm text-red-400">
              Payment Not Completed / Cancelled
            </p>
            <p className="mt-2 text-xs text-muted normal-case">
              We couldn&apos;t verify a completed payment for this session. If you cancelled the transaction, no charges were made.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-5">
          {/* Cashfree */}
          <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
            <p className="text-sm text-cream">
              <span style={{ color: ACCENT }}>01.</span> One-time Support (UPI / Cards / Wallets)
            </p>
            <div className="mt-4 flex flex-col gap-1.5 max-w-xs">
              <label className="text-[10px] text-muted normal-case font-bold">
                Phone Number (Required for Payment):
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setPhoneError(null);
                }}
                className="border-[2px] border-border bg-transparent px-3 py-1.5 text-xs text-cream outline-none focus:border-cream"
              />
              {phoneError && (
                <p className="text-[9px] text-red-400 normal-case">{phoneError}</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[100, 250, 500].map((amount) => (
                <button
                  key={amount}
                  disabled={loadingAmount !== null}
                  onClick={() => handleCashfreeCheckout(amount)}
                  className="btn-press border-[2px] border-border px-5 py-2 text-xs text-cream transition-colors hover:border-border-light disabled:cursor-wait disabled:opacity-50"
                >
                  {loadingAmount === amount ? "..." : `₹${amount}`}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-dim">₹</span>
                <input
                  type="number"
                  min={10}
                  placeholder="__"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customAmount) {
                      handleCashfreeCheckout(parseInt(customAmount, 10));
                    }
                  }}
                  className="w-16 border-[2px] border-border bg-transparent px-2 py-2 text-xs text-cream outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  disabled={loadingAmount !== null || !customAmount || parseInt(customAmount, 10) < 10}
                  onClick={() => handleCashfreeCheckout(parseInt(customAmount, 10))}
                  className="btn-press border-[2px] border-border px-3 py-2 text-[10px] text-cream transition-colors hover:border-border-light disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loadingAmount && loadingAmount !== 100 && loadingAmount !== 250 && loadingAmount !== 500 ? "..." : "GO"}
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-3 text-xs normal-case" style={{ color: "#f87171" }}>
                {error}
              </p>
            )}
          </div>

          {/* GitHub Sponsors */}
          <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
            <p className="text-sm text-cream">
              <span style={{ color: ACCENT }}>02.</span> GitHub Sponsors
            </p>
            <a
              href="https://github.com/sponsors/ishant-27"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press mt-4 inline-block border-[2px] border-border px-5 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              github.com/sponsors/ishant-27
            </a>
          </div>

          {/* Crypto (ETH) */}
          <div className="border-[3px] border-border bg-bg-raised p-5 sm:p-6">
            <p className="text-sm text-cream">
              <span style={{ color: ACCENT }}>03.</span> Crypto (ETH)
            </p>
            <p className="mt-4 text-xs text-muted normal-case">
              Coming soon...
            </p>
          </div>


        </div>
      </div>
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense>
      <SupportContent />
    </Suspense>
  );
}
