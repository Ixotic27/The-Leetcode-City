"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import LofiRadio from "./LofiRadio";

export default function GlobalRadio() {
  const [mounted, setMounted] = useState(false);
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const findSlot = () => document.getElementById("gc-radio-slot");
    setSlot(findSlot());

    const observer = new MutationObserver(() => setSlot(findSlot()));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mounted]);

  // Wait one extra frame to prevent React complaining about the hydration mismatch
  // when `page.tsx` renders its own slot conditionally.
  const [canPort, setCanPort] = useState(false);
  useEffect(() => {
    if (mounted) {
      requestAnimationFrame(() => setCanPort(true));
    }
  }, [mounted]);

  if (!mounted || !canPort) return null;

  if (slot) return createPortal(<LofiRadio />, slot);

  return (
    <div className="pointer-events-auto fixed bottom-4 left-3 z-[25] sm:left-4">
      <LofiRadio />
    </div>
  );
}
