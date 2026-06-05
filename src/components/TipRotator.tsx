"use client";

import { useState, useEffect } from "react";

const TIPS = [
  "Click any building to see that dev's profile",
  "Use Fly Mode to cruise above the skyline",
  "Taller buildings = more submissions",
  "Try searching for your LeetCode username",
  "Buildings glow brighter with more recent activity",
  "You can customize your building in the shop",
  "Explore Mode shows the full city layout",
];

export default function TipRotator() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="mt-8 max-w-xs text-center font-pixel text-[10px] leading-relaxed tracking-wide text-neutral-600 sm:text-xs">
      {TIPS[tipIndex]}
    </p>
  );
}