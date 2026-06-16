"use client";

import React, { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const DarkContinentCanvas = dynamic(
  () => import("@/components/DarkContinentCanvas"),
  { ssr: false }
);

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <div
        className="animate-pulse text-sm tracking-widest text-white/60 uppercase"
        style={{ fontFamily: "monospace" }}
      >
        Loading Dark Continent...
      </div>
    </div>
  );
}

export default function DarkContinentPage() {
  const router = useRouter();

  // ESC key handler at page level (backup — AirplaneFlight also handles ESC)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DarkContinentCanvas />
    </Suspense>
  );
}
