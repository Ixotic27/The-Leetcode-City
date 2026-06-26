"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface DailyProblem {
  title: string;
  difficulty: string;
  titleSlug: string;
}

interface BattleLogEntry {
  timestamp: string;
  type: "system" | "warning" | "boss" | "attack" | "defend" | "heal" | "special" | "victory" | "gift" | "defeat" | "tip";
  message: string;
}

const BOSS_MAP: Record<string, { name: string; type: "goblin" | "orc" | "dragon"; color: string; maxHp: number; baseDmg: number }> = {
  Easy:   { name: "Scourge Goblin", type: "goblin", color: "#39ff14", maxHp: 80, baseDmg: 8 },
  Medium: { name: "Ravage Orc", type: "orc", color: "#ffa116", maxHp: 120, baseDmg: 14 },
  Hard:   { name: "Void Dragon", type: "dragon", color: "#ff0055", maxHp: 180, baseDmg: 22 },
};

const MOCK_PROBLEMS: DailyProblem[] = [
  { title: "Two Sum", difficulty: "Easy", titleSlug: "two-sum" },
  { title: "Add Two Numbers", difficulty: "Medium", titleSlug: "add-two-numbers" },
  { title: "Median of Two Sorted Arrays", difficulty: "Hard", titleSlug: "median-of-two-sorted-arrays" },
  { title: "Longest Palindromic Substring", difficulty: "Medium", titleSlug: "longest-palindromic-substring" },
  { title: "Regular Expression Matching", difficulty: "Hard", titleSlug: "regular-expression-matching" },
];

// Retro 8-bit Audio Synthesizer using Web Audio API
function playRetroSound(type: "hit" | "heal" | "defend" | "victory" | "defeat" | "special", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    switch (type) {
      case "hit":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case "special":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      case "heal":
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      case "defend":
        osc.type = "square";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(80, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case "victory":
        osc.type = "square";
        [
          { note: 261.63, time: 0 },
          { note: 329.63, time: 0.1 },
          { note: 392.00, time: 0.2 },
          { note: 523.25, time: 0.3 },
        ].forEach((item) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.type = "square";
          noteOsc.frequency.setValueAtTime(item.note, now + item.time);
          noteGain.gain.setValueAtTime(0.15, now + item.time);
          noteGain.gain.linearRampToValueAtTime(0.01, now + item.time + 0.2);
          noteOsc.start(now + item.time);
          noteOsc.stop(now + item.time + 0.2);
        });
        break;
      case "defeat":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
    }
  } catch (e) {
    // Audio context initialization blocked
  }
}

// Custom Vector Game Graphics (SVGs) for Bosses
function BossGraphic({ type, color, flashing }: { type: "goblin" | "orc" | "dragon"; color: string; flashing: boolean }) {
  const flashClass = flashing ? "brightness-150 saturate-150 contrast-125 scale-105" : "";
  
  if (type === "goblin") {
    return (
      <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
        <defs>
          <linearGradient id="goblinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
          <filter id="neonGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22c55e" floodOpacity="0.6"/>
          </filter>
        </defs>
        {/* Cyber Grid Background */}
        <rect x="5" y="5" width="90" height="90" fill="#0d0d0f" stroke="#16a34a" strokeWidth="1" strokeDasharray="4 4" rx="4" />
        {/* Neck & Collars */}
        <path d="M40 70 L60 70 L55 80 L45 80 Z" fill="#14532d" />
        <path d="M30 75 L70 75 L65 72 L35 72 Z" fill="#27272a" stroke="#22c55e" strokeWidth="1" />
        {/* Main Head */}
        <path d="M25 40 L35 30 L65 30 L75 40 L70 70 L30 70 Z" fill="url(#goblinGrad)" stroke="#16a34a" strokeWidth="2" />
        {/* Pointy Cyber Ears */}
        <path d="M25 42 L5 25 L28 48 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
        <path d="M75 42 L95 25 L72 48 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
        {/* Ear cyber plugs */}
        <circle cx="8" cy="27" r="2.5" fill="#ffa116" />
        <circle cx="92" cy="27" r="2.5" fill="#ffa116" />
        {/* Cybernetic glowing red/orange Visor */}
        <path d="M28 45 L72 45 L68 53 L32 53 Z" fill="#18181b" stroke="#ffa116" strokeWidth="1.5" />
        <rect x="35" y="47" width="30" height="4" fill="#ffa116" filter="url(#neonGlowGreen)" className="animate-pulse" />
        <circle cx="60" cy="49" r="2" fill="#ff0055" />
        {/* Metal Jaw plates */}
        <path d="M35 60 L45 62 L55 62 L65 60 L60 67 L40 67 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="1" />
        {/* Vent grid on jaw */}
        <line x1="46" y1="62" x2="46" y2="66" stroke="#27272a" strokeWidth="1.5" />
        <line x1="50" y1="62" x2="50" y2="66" stroke="#27272a" strokeWidth="1.5" />
        <line x1="54" y1="62" x2="54" y2="66" stroke="#27272a" strokeWidth="1.5" />
        {/* Horn-like antennas */}
        <line x1="40" y1="30" x2="35" y2="20" stroke="#ffa116" strokeWidth="2" />
        <circle cx="35" cy="20" r="2" fill="#ffa116" />
        <line x1="60" y1="30" x2="65" y2="20" stroke="#ffa116" strokeWidth="2" />
        <circle cx="65" cy="20" r="2" fill="#ffa116" />
      </svg>
    );
  }

  if (type === "orc") {
    return (
      <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
        <defs>
          <linearGradient id="orcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c2d12" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="metalPlate" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>
        {/* Background circuit grid */}
        <rect x="5" y="5" width="90" height="90" fill="#0d0d0f" stroke="#ea580c" strokeWidth="1" strokeDasharray="2 4" rx="4" />
        {/* Heavy shoulders */}
        <path d="M10 75 L30 65 L70 65 L90 75 L85 85 L15 85 Z" fill="url(#metalPlate)" stroke="#71717a" strokeWidth="2" />
        {/* Spike bolts */}
        <circle cx="20" cy="72" r="2.5" fill="#a1a1aa" />
        <circle cx="80" cy="72" r="2.5" fill="#a1a1aa" />
        {/* Neck collar */}
        <rect x="38" y="58" width="24" height="10" fill="#18181b" stroke="#ea580c" strokeWidth="1" />
        {/* Head Armor Block */}
        <path d="M22 30 L78 30 L74 60 L26 60 Z" fill="url(#orcGrad)" stroke="#c2410c" strokeWidth="2.5" />
        {/* Iron visor mask */}
        <path d="M20 38 L80 38 L72 50 L50 56 L28 50 Z" fill="#27272a" stroke="#a1a1aa" strokeWidth="2" />
        {/* Visor glowing slit */}
        <path d="M32 43 L68 43 L65 47 L35 47 Z" fill="#ef4444" className="animate-pulse" />
        <circle cx="50" cy="45" r="1.5" fill="#fff" />
        {/* Massive tusks */}
        <path d="M26 60 L18 52 L26 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M74 60 L82 52 L74 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        {/* Cybernetic wires */}
        <path d="M35 50 C30 55, 30 65, 40 68" fill="none" stroke="#ef4444" strokeWidth="1.5" />
        <path d="M65 50 C70 55, 70 65, 60 68" fill="none" stroke="#ef4444" strokeWidth="1.5" />
        {/* Crest horns */}
        <path d="M32 30 L25 15 L35 25 Z" fill="#3f3f46" stroke="#18181b" strokeWidth="1" />
        <path d="M68 30 L75 15 L65 25 Z" fill="#3f3f46" stroke="#18181b" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
      <defs>
        <linearGradient id="dragonBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c0519" />
          <stop offset="50%" stopColor="#9f1239" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f43f5e" floodOpacity="0.8"/>
        </filter>
      </defs>
      {/* Background matrix style grid */}
      <rect x="5" y="5" width="90" height="90" fill="#0d0d0f" stroke="#be123c" strokeWidth="1" strokeDasharray="3 6" rx="4" />
      {/* Wings outlined in glowing red */}
      <path d="M12 40 L5 20 L25 25 L12 40 L28 42 Z" fill="#4c0519" stroke="#f43f5e" strokeWidth="1.5" filter="url(#glowRed)" />
      <path d="M88 40 L95 20 L75 25 L88 40 L72 42 Z" fill="#4c0519" stroke="#f43f5e" strokeWidth="1.5" filter="url(#glowRed)" />
      {/* Neck scales */}
      <path d="M42 62 L58 62 L54 85 L46 85 Z" fill="#881337" stroke="#e11d48" strokeWidth="1.5" />
      <line x1="50" y1="65" x2="50" y2="82" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* Main Head */}
      <path d="M22 35 L50 15 L78 35 L72 65 L50 80 L28 65 Z" fill="url(#dragonBody)" stroke="#be123c" strokeWidth="2.5" />
      {/* Robotic horns */}
      <path d="M30 20 L15 2 L25 15" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 20 L85 2 L75 15" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" />
      {/* Cybernetic glowing gold eyes */}
      <polygon points="34,42 44,38 46,46" fill="#facc15" filter="url(#glowRed)" />
      <polygon points="66,42 56,38 54,46" fill="#facc15" filter="url(#glowRed)" />
      <circle cx="40" cy="42" r="1" fill="#fff" />
      <circle cx="60" cy="42" r="1" fill="#fff" />
      {/* Plasma vent mouth */}
      <path d="M38 58 L50 68 L62 58 Z" fill="#18181b" stroke="#be123c" strokeWidth="1.5" />
      {/* Fangs */}
      <polygon points="40,58 42,62 44,58" fill="#ffffff" />
      <polygon points="60,58 58,62 56,58" fill="#ffffff" />
      {/* Glowing core inside mouth */}
      <circle cx="50" cy="62" r="3" fill="#facc15" className="animate-pulse" filter="url(#glowRed)" />
    </svg>
  );
}

// Custom Vector Graphic for Player (Coding Terminal Desk)
function PlayerGraphic({ flashing }: { flashing: boolean }) {
  const flashClass = flashing ? "brightness-150 saturate-150 contrast-125" : "";
  return (
    <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
      <defs>
        <linearGradient id="screenBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0d1b0d" />
          <stop offset="100%" stopColor="#070a07" />
        </linearGradient>
      </defs>
      {/* Background Grid */}
      <rect x="5" y="5" width="90" height="90" fill="#0d0d0f" stroke="#2a2a30" strokeWidth="1" strokeDasharray="3 3" rx="4" />
      {/* Desk pedestal */}
      <path d="M20 82 L80 82 L85 92 L15 92 Z" fill="#18181b" stroke="#2a2a30" strokeWidth="1.5" />
      {/* Keyboard glow */}
      <rect x="25" y="80" width="50" height="4" fill="#39ff14" opacity="0.3" className="animate-pulse" />
      {/* CRT Monitor stand */}
      <rect x="44" y="68" width="12" height="14" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
      <path d="M38 78 L62 78 L58 68 L42 68 Z" fill="#18181b" />
      {/* Main Monitor Bezel */}
      <rect x="15" y="15" width="70" height="54" fill="#27272a" stroke="#3f3f46" strokeWidth="2.5" rx="4" />
      {/* Screen border line */}
      <rect x="18" y="18" width="64" height="48" fill="url(#screenBg)" stroke="#1f2937" strokeWidth="1.5" />
      {/* Matrix Code Waterfall lines */}
      <line x1="24" y1="22" x2="24" y2="34" stroke="#39ff14" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.8" />
      <line x1="32" y1="22" x2="32" y2="46" stroke="#39ff14" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
      <line x1="42" y1="22" x2="42" y2="30" stroke="#39ff14" strokeWidth="1.5" strokeDasharray="1 2" opacity="0.9" />
      <line x1="58" y1="22" x2="58" y2="52" stroke="#39ff14" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.4" />
      <line x1="68" y1="22" x2="68" y2="38" stroke="#39ff14" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.7" />
      {/* Code Flow boxes on screen */}
      <rect x="22" y="56" width="16" height="6" fill="#39ff14" fillOpacity="0.8" />
      <rect x="42" y="56" width="22" height="6" fill="#ffa116" fillOpacity="0.8" />
      <rect x="68" y="56" width="10" height="6" fill="#00d2ff" fillOpacity="0.8" />
      {/* Warning beacon flashing */}
      <circle cx="80" cy="10" r="3" fill="#ffa116" className="animate-ping" />
      <circle cx="80" cy="10" r="2" fill="#ffa116" />
    </svg>
  );
}

// Custom Retro Styled Vector Icons replacing all standard system emojis
function DungeonIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  switch (name) {
    case "sword":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
          <path d="M7 17 L17 7" />
          <path d="M8 16 L16 8" />
          <path d="M9 15 L15 9" />
          <path d="M17 7 L19 5 L19 4 L18 4 L17 5 Z" className="fill-current" />
          <path d="M6 14 L10 18" strokeWidth="3" />
          <path d="M7 17 L4 20" strokeWidth="2.5" />
          <rect x="3" y="20" width="2" height="2" className="fill-current" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M4 4 h16 v6 c0 5 -4 9 -8 11 c-4 -2 -8 -6 -8 -11 Z" />
          <path d="M8 7 h8 v3 c0 3 -2.5 5.5 -4 6.5 c-1.5 -1 -4 -3.5 -4 -6.5 Z" opacity="0.6" />
          <path d="M12 7 v9" opacity="0.4" />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2">
          <path d="M12 2 v6 M9 5 h6" />
          <path d="M12 5 L12 5" strokeWidth="4" />
          <path d="M5 14 v4 M3 16 h4" />
          <path d="M18 12 v4 M16 14 h4" strokeWidth="1.5" />
          <path d="M14 19 v3 M12 20 h4" strokeWidth="1" />
        </svg>
      );
    case "fire":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M12 3 L9 6 L9 9 L6 12 L6 18 L18 18 L18 12 L15 9 L15 6 Z" />
          <path d="M12 7 L10 9 v2 L8 13 v3 h8 v-3 L14 11 V9 Z" opacity="0.6" className="fill-current" />
          <path d="M12 11 h-1 v3 h2 Z" opacity="0.8" className="fill-current" />
        </svg>
      );
    case "skull":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M7 6 C7 3, 17 3, 17 6 C17 8, 17 12, 16 13 L16 17 L14 17 L14 19 L10 19 L10 17 L8 17 L8 13 C7 12, 7 8, 7 6 Z" />
          <rect x="9" y="8" width="2.5" height="2.5" className="fill-current" />
          <rect x="12.5" y="8" width="2.5" height="2.5" className="fill-current" />
          <path d="M12 12 L12 13" />
          <path d="M10 16 v2 M12 16 v2 M14 16 v2" />
        </svg>
      );
    case "gift":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <rect x="4" y="9" width="16" height="11" />
          <rect x="3" y="6" width="18" height="3" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 6 v14" strokeWidth="2.5" />
          <path d="M4 14 h16" opacity="0.4" />
          <path d="M12 6 C10 3, 10 3, 12 6 C14 3, 14 3, 12 6" />
          <path d="M9 4 C9 2, 11 4, 12 6" />
          <path d="M15 4 C15 2, 13 4, 12 6" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <polygon points="12,3 22,20 2,20" />
          <rect x="11.25" y="9" width="1.5" height="5" className="fill-current" />
          <rect x="11.25" y="16" width="1.5" height="1.5" className="fill-current" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M12 7 C10 4, 3 4, 3 9 C3 14, 10 19, 12 21 C14 19, 21 14, 21 9 C21 4, 14 4, 12 7 Z" className="fill-current fill-opacity-25" />
        </svg>
      );
    case "tip":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M9 18 h6 M10 21 h4" />
          <path d="M12 3 C7.5 3, 7.5 8, 7.5 10 C7.5 12, 9 14, 9 16 h6 C16 14, 16.5 12, 16.5 10 C16.5 8, 16.5 3, 12 3 Z" />
          <path d="M12 8 v4 M10 10 h4" opacity="0.5" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M20 12 H4 M10 6 L4 12 L10 18" />
        </svg>
      );
    case "trophy":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M6 4 h12 v8 c0 3 -2.5 5.5 -6 6 v3 M8 21 h8" />
          <path d="M6 6 H3 v4 c0 2 2 3 3 3" />
          <path d="M18 6 H21 v4 c0 2 -2 3 -3 3" />
        </svg>
      );
    case "sound-on":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M3 9 h4 l5 -5 v16 l-5 -5 h-4 Z" />
          <path d="M15 9 c1.5 1, 1.5 3, 0 4 M17 6 c3 2, 3 8, 0 10" />
        </svg>
      );
    case "sound-off":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <path d="M3 9 h4 l5 -5 v16 l-5 -5 h-4 Z" />
          <path d="M16 9 L20 13 M20 9 L16 13" strokeWidth="2" />
        </svg>
      );
    case "system":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="square">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8 h10 M7 12 h10 M7 16 h6" opacity="0.6" />
        </svg>
      );
    default:
      return (
        <span className="inline-block w-4 h-4 border border-current text-center text-[8px] font-bold">
          ?
        </span>
      );
  }
}

interface FloatingText {
  id: number;
  text: string;
  side: "player" | "boss";
  type: "damage" | "heal" | "special" | "defense";
}

export default function DungeonPage() {
  const [problem, setProblem] = useState<DailyProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // RPG Battle Simulation States
  const [gameState, setGameState] = useState<"intro" | "battle" | "victory" | "defeat">("intro");
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [defending, setDefending] = useState(false);
  const [specialCooldown, setSpecialCooldown] = useState(0);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Simulator statistics
  const [battleStats, setBattleStats] = useState({
    damageDealt: 0,
    damageTaken: 0,
    healsUsed: 0,
    turnsPlayed: 0
  });

  // Screen/Gfx Visual FX States
  const [screenShaking, setScreenShaking] = useState(false);
  const [bossFlashing, setBossFlashing] = useState(false);
  const [playerFlashing, setPlayerFlashing] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const floatingIdCounter = useRef(0);

  // Load sound setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dungeon_sound_enabled");
      if (saved !== null) {
        setSoundEnabled(saved === "true");
      }
    }
  }, []);

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem("dungeon_sound_enabled", String(nextVal));
  };

  // Fetch the Daily LeetCode Challenge
  useEffect(() => {
    const controller = new AbortController();
    const fetchChallenge = async () => {
      try {
        const res = await fetch("https://alfa-leetcode-api.onrender.com/daily", { signal: controller.signal });
        if (!res.ok) throw new Error("API network failure");
        const data = await res.json();
        if (!data?.questionTitle || !data?.difficulty || !data?.titleSlug) throw new Error("Invalid API format");
        setProblem({
          title: data.questionTitle,
          difficulty: data.difficulty,
          titleSlug: data.titleSlug,
        });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.warn("LeetCode daily API offline, falling back to local simulation database.");
        setIsOffline(true);
        const randomMock = MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)];
        setProblem(randomMock);
      } finally {
        setLoading(false);
      }
    };
    fetchChallenge();
    return () => controller.abort();
  }, []);

  // Scroll to bottom of battle logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLogs]);

  const addLog = (msg: string, type: BattleLogEntry["type"] = "system") => {
    setBattleLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        type,
        message: msg,
      },
    ]);
  };

  // Setup the battle once the problem is resolved
  const startBattle = () => {
    if (!problem) return;
    const stats = BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"];
    setBossMaxHp(stats.maxHp);
    setBossHp(stats.maxHp);
    setPlayerMaxHp(100);
    setPlayerHp(100);
    setDefending(false);
    setSpecialCooldown(0);
    setBattleStats({
      damageDealt: 0,
      damageTaken: 0,
      healsUsed: 0,
      turnsPlayed: 0
    });
    setGameState("battle");
    setBattleLogs([
      { timestamp: new Date().toLocaleTimeString(), type: "system", message: "YOU DESCEND INTO THE DARKNESS OF THE CODING DUNGEON..." },
      { timestamp: new Date().toLocaleTimeString(), type: "warning", message: `A WILD ${stats.name.toUpperCase()} (${problem.difficulty.toUpperCase()}) BLOCKS YOUR WAY!` },
      { timestamp: new Date().toLocaleTimeString(), type: "boss", message: '💬 BOSS: "So you think you can solve today\'s challenge?"' },
      { timestamp: new Date().toLocaleTimeString(), type: "system", message: "THE BATTLE BEGINS! CHOOSE YOUR ACTION." }
    ]);
    playRetroSound("hit", soundEnabled);
  };

  const spawnFloatingText = (text: string, side: "player" | "boss", type: FloatingText["type"]) => {
    const id = floatingIdCounter.current++;
    setFloatingTexts((prev) => [...prev, { id, text, side, type }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
    }, 1200);
  };

  // Turn logic simulator
  const handleAction = (action: "attack" | "defend" | "heal" | "special") => {
    if (gameState !== "battle" || !problem) return;
    const bossStats = BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"];
    
    let playerDamage = 0;
    let bossDamage = Math.floor(Math.random() * 5) + bossStats.baseDmg;
    
    // Player's turn
    if (action === "attack") {
      playerDamage = Math.floor(Math.random() * 12) + 15; // 15 - 26
      const nextHp = Math.max(0, bossHp - playerDamage);
      setBossHp(nextHp);
      setBossFlashing(true);
      setTimeout(() => setBossFlashing(false), 200);
      spawnFloatingText(`-${playerDamage} HP`, "boss", "damage");
      addLog(`YOU CAST [SOLVE SOLUTION] ON ${bossStats.name.toUpperCase()} FOR ${playerDamage} DAMAGE!`, "attack");
      setBattleStats(prev => ({ ...prev, damageDealt: prev.damageDealt + playerDamage, turnsPlayed: prev.turnsPlayed + 1 }));
      playRetroSound("hit", soundEnabled);

      if (nextHp === 0) {
        triggerVictory();
        return;
      }
    } else if (action === "special") {
      if (specialCooldown > 0) return;
      playerDamage = Math.floor(Math.random() * 20) + 35; // 35 - 54
      const nextHp = Math.max(0, bossHp - playerDamage);
      setBossHp(nextHp);
      setBossFlashing(true);
      setTimeout(() => setBossFlashing(false), 200);
      spawnFloatingText(`-${playerDamage} HP`, "boss", "special");
      setSpecialCooldown(3); // 3 turns cooldown
      addLog(`SPECIAL ATTACK! YOU DEPLOYED A [GITHUB COMMIT] DEALING ${playerDamage} CRITICAL DAMAGE!`, "special");
      setBattleStats(prev => ({ ...prev, damageDealt: prev.damageDealt + playerDamage, turnsPlayed: prev.turnsPlayed + 1 }));
      playRetroSound("special", soundEnabled);

      if (nextHp === 0) {
        triggerVictory();
        return;
      }
    } else if (action === "heal") {
      const healAmount = Math.floor(Math.random() * 10) + 20; // 20 - 29
      setPlayerHp((prev) => Math.min(playerMaxHp, prev + healAmount));
      spawnFloatingText(`+${healAmount} HP`, "player", "heal");
      addLog(`YOU RAN [RUN TESTS] AND PATCHED YOUR SOURCE FILE, RECOVERING ${healAmount} HP!`, "heal");
      setBattleStats(prev => ({ ...prev, healsUsed: prev.healsUsed + 1, turnsPlayed: prev.turnsPlayed + 1 }));
      playRetroSound("heal", soundEnabled);
    } else if (action === "defend") {
      setDefending(true);
      spawnFloatingText("DEFENSE UP", "player", "defense");
      addLog(`YOU USED [CODE REFACTOR]. YOUR ALGORITHMIC DEFENSES ARE RAISED!`, "defend");
      setBattleStats(prev => ({ ...prev, turnsPlayed: prev.turnsPlayed + 1 }));
      playRetroSound("defend", soundEnabled);
    }

    // Cooldown ticks
    if (specialCooldown > 0 && action !== "special") {
      setSpecialCooldown((c) => c - 1);
    }

    // Boss's counter-attack (if boss is alive)
    setTimeout(() => {
      let finalBossDamage = bossDamage;
      if (action === "defend" || defending) {
        finalBossDamage = Math.floor(bossDamage * 0.25); // 75% damage reduction
        setDefending(false);
      }
      
      const nextPlayerHp = Math.max(0, playerHp - finalBossDamage);
      setPlayerHp(nextPlayerHp);
      setPlayerFlashing(true);
      setScreenShaking(true);
      setTimeout(() => setPlayerFlashing(false), 200);
      setTimeout(() => setScreenShaking(false), 300);
      spawnFloatingText(`-${finalBossDamage} HP`, "player", "damage");
      
      const bossAbility = bossDamage > bossStats.baseDmg + 2 
        ? "CRITICAL ATTACK [STACK OVERFLOW]" 
        : "BASIC STRIKE [COMPILATION ERROR]";
      
      addLog(`${bossStats.name.toUpperCase()} CASTS [${bossAbility}], DEALING ${finalBossDamage} DAMAGE TO YOUR HEALTH.`, "boss");
      setBattleStats(prev => ({ ...prev, damageTaken: prev.damageTaken + finalBossDamage }));
      playRetroSound("hit", soundEnabled);

      if (nextPlayerHp === 0) {
        triggerDefeat();
      }
    }, 800);
  };

  const triggerVictory = () => {
    setGameState("victory");
    addLog(`VICTORY! THE ${BOSS_MAP[problem?.difficulty ?? "Medium"].name.toUpperCase()} WAS DEFEATED!`, "victory");
    addLog("YOU ACQUIRED: XP POINTS, ARENA RATINGS, AND THE RESPECT OF THE LEETCODE CITY.", "gift");
    playRetroSound("victory", soundEnabled);
  };

  const triggerDefeat = () => {
    setGameState("defeat");
    addLog("DEFEATED! THE CODING DUNGEON CONSUMED YOUR PROFILE.", "defeat");
    addLog("TIP: REFACTOR YOUR CODE AND TRY ATTACKING AGAIN!", "tip");
    playRetroSound("defeat", soundEnabled);
  };

  const bossInfo = problem ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"]) : null;
  const leetcodeUrl = problem ? `https://leetcode.com/problems/${problem.titleSlug}/` : "#";

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm [image-rendering:pixelated] pb-16 relative overflow-hidden">
      
      {/* Background scanline simulation effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-lime/10 via-transparent to-transparent pointer-events-none z-0" />

      {/* Embedded Styles for Retro Effects */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-3px, -1px); }
          20% { transform: translate(2px, 3px); }
          30% { transform: translate(-1px, -2px); }
          40% { transform: translate(3px, 1px); }
          50% { transform: translate(-2px, 2px); }
          60% { transform: translate(1px, -1px); }
          70% { transform: translate(-3px, 3px); }
          80% { transform: translate(2px, -2px); }
          90% { transform: translate(-1px, 1px); }
        }
        .screen-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        @keyframes float-up {
          0% { opacity: 0; transform: translateY(15px) scale(0.9); }
          20% { opacity: 1; transform: translateY(0) scale(1.15); }
          100% { opacity: 0; transform: translateY(-50px) scale(1); }
        }
        .float-text {
          animation: float-up 1.2s cubic-bezier(0.25, 1, 0.50, 1) forwards;
          text-shadow: 0 0 6px rgba(0,0,0,0.8);
        }

        /* CRT monitor style */
        .crt-monitor {
          position: relative;
          overflow: hidden;
        }
        .crt-monitor::after {
          content: " ";
          display: block;
          position: absolute;
          top: 0; left: 0; bottom: 0; right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%);
          z-index: 10;
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.4;
        }
        .crt-monitor::before {
          content: " ";
          display: block;
          position: absolute;
          top: 0; left: 0; bottom: 0; right: 0;
          background: radial-gradient(circle, transparent 65%, rgba(0,0,0,0.5) 100%);
          z-index: 11;
          pointer-events: none;
        }
        
        @keyframes crt-flicker {
          0% { opacity: 0.98; }
          50% { opacity: 1; }
          100% { opacity: 0.985; }
        }
        .crt-flicker {
          animation: crt-flicker 0.15s infinite;
        }
      `}</style>

      <div className={`mx-auto max-w-5xl px-4 py-8 relative z-10 ${screenShaking ? "screen-shake" : ""}`}>
        
        {/* Navigation & Header */}
        <div className="flex flex-col border-b border-border pb-6 mb-8 md:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-muted hover:text-cream transition-colors duration-150 group"
          >
            <DungeonIcon name="arrow-left" className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            RETREAT TO CITY
          </Link>
          
          <div className="text-center">
            <h1 
              className="text-2xl md:text-3xl tracking-[0.2em] text-cream font-bold relative inline-block select-none"
              style={{ textShadow: "0 0 12px var(--color-lime)" }}
            >
              ⚔ THE CODING DUNGEON ⚔
            </h1>
            <div className="flex items-center justify-center gap-3 mt-1.5 text-[8px] text-muted tracking-widest">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SIMULATOR PORT: ONLINE
              </span>
              <span>•</span>
              <span>CORE v2.5.0</span>
              <span>•</span>
              <button 
                onClick={toggleSound}
                className="flex items-center gap-1 hover:text-cream text-muted transition-colors cursor-pointer"
                title={soundEnabled ? "Mute sound" : "Unmute sound"}
              >
                <DungeonIcon name={soundEnabled ? "sound-on" : "sound-off"} className="w-3.5 h-3.5" />
                {soundEnabled ? "SOUND_ON" : "SOUND_OFF"}
              </button>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex gap-2">
            <div className="border border-border bg-bg-raised px-3 py-1.5 text-center min-w-[100px]">
              <span className="text-[7px] text-muted block">GRID GATEWAY</span>
              <span className="text-[9px] text-[#ffa116] font-bold">CONNECTED</span>
            </div>
            {isOffline && (
              <div className="border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-center min-w-[100px]">
                <span className="text-[7px] text-red-400 block">SIM_MODE</span>
                <span className="text-[9px] text-red-500 font-bold">LOCAL_OFFLINE</span>
              </div>
            )}
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex h-96 flex-col items-center justify-center border-[3px] border-border bg-bg-raised p-8 text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,161,22,0.05)_0%,transparent_70%)] pointer-events-none" />
            <div className="relative mb-6">
              <svg viewBox="0 0 100 100" className="w-20 h-20 animate-spin text-[#ffa116]" style={{ animationDuration: "3s" }}>
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="15 8" fill="none" opacity="0.3" />
                <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3" strokeDasharray="30 10" fill="none" />
                <polygon points="50,25 55,45 75,50 55,55 50,75 45,55 25,50 45,45" fill="currentColor" opacity="0.8" className="animate-pulse" />
              </svg>
            </div>
            <p className="text-[11px] tracking-widest text-lime blink-dot font-bold">INITIATING CONSOLE CONNECTION...</p>
            <p className="text-[8px] text-muted mt-2 normal-case font-mono">SYNCHRONIZING WITH LEETCODE ORBITAL NETWORKS</p>
          </div>
        )}

        {/* ERROR STATE / FALLBACK INTERACTIVE RUN */}
        {error && !problem && (
          <div className="flex h-96 flex-col items-center justify-center border-[3px] border-red-500 bg-red-950/10 p-8 text-center shadow-lg relative">
            <div className="mb-4 text-red-500">
              <DungeonIcon name="warning" className="w-16 h-16" />
            </div>
            <h2 className="text-sm text-red-500 mb-2 font-bold tracking-wider">DUNGEON CRITICAL ERROR</h2>
            <p className="text-[10px] text-muted normal-case max-w-sm mb-6 leading-relaxed">
              The Daily Dungeon portal collapsed! The LeetCode Daily API might be experiencing a temporary outage. Running simulator in offline mode.
            </p>
            <button
              onClick={() => {
                setError(false);
                setIsOffline(true);
                const randomMock = MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)];
                setProblem(randomMock);
                setLoading(false);
              }}
              className="btn-press border-2 border-red-500 bg-red-950/20 text-red-400 px-6 py-2.5 text-[9px] font-bold tracking-wider cursor-pointer"
            >
              [ LAUNCH OFFLINE SIMULATION ]
            </button>
          </div>
        )}

        {/* CORE INTERFACE */}
        {problem && bossInfo && !loading && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            
            {/* Left Side: Game Battle Console (RPG Engine) */}
            <div className="md:col-span-8 flex flex-col gap-6">
              
              {/* Game Screen Container */}
              <div className="border-[3px] border-border-light bg-bg-raised p-6 shadow-2xl relative crt-monitor crt-flicker">
                
                {/* Decorative retro bezels */}
                <div className="absolute top-2 left-2 w-2.5 h-2.5 bg-border-light" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-border-light" />
                <div className="absolute bottom-2 left-2 w-2.5 h-2.5 bg-border-light" />
                <div className="absolute bottom-2 right-2 w-2.5 h-2.5 bg-border-light" />

                {/* Intro Screen */}
                {gameState === "intro" && (
                  <div className="flex flex-col items-center justify-center py-10 text-center relative z-20">
                    <div className="mb-6 select-none bg-bg-card p-4 border-[3px] border-border-light relative shadow-md">
                      <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={false} />
                    </div>
                    <span className="text-[10px] text-muted block mb-1">DATABASE GUARDIAN CHALLENGE</span>
                    <h2 
                      className="text-lg font-bold mb-4 font-mono tracking-widest"
                      style={{ color: bossInfo.color }}
                    >
                      {bossInfo.name.toUpperCase()}
                    </h2>
                    
                    <div className="max-w-md bg-bg-card border border-border p-4 mb-8 text-[10px] text-muted normal-case leading-relaxed">
                      This daily challenge daemon represents today&apos;s coding challenge. Play the tactical logic simulation to test your skills, or fight directly on LeetCode to secure full XP rewards.
                    </div>

                    <button
                      onClick={startBattle}
                      className="btn-press border-[3px] border-lime bg-lime/10 hover:bg-lime/20 px-8 py-3 text-xs text-lime transition-all duration-150 font-bold tracking-widest cursor-pointer shadow-[4px_4px_0_0_#000000]"
                    >
                      ⚔ CHALLENGE DAEMON
                    </button>
                  </div>
                )}

                {/* Active Battle Screen */}
                {(gameState === "battle" || gameState === "victory" || gameState === "defeat") && (
                  <div className="flex flex-col relative z-20">
                    
                    {/* Health Status Bar Header */}
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
                      
                      {/* Boss HP */}
                      <div className="border border-border bg-bg p-3 relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold" style={{ color: bossInfo.color }}>
                            DAEMON: {bossInfo.name.toUpperCase()}
                          </span>
                          <span className="text-[8px] text-muted normal-case font-mono">LOCKED</span>
                        </div>
                        <div className="w-full bg-bg-raised h-4 p-0.5 border border-border-light relative">
                          <div 
                            className="h-full transition-all duration-300 relative"
                            style={{ 
                              width: `${(bossHp / bossMaxHp) * 100}%`,
                              backgroundColor: bossInfo.color,
                              boxShadow: `0 0 10px ${bossInfo.color}88`
                            }}
                          >
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_90%,rgba(0,0,0,0.4)_90%)] bg-[size:10%_100%]" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[8px] text-dim">INTEGRITY MATRIX</span>
                          <span className="text-[9px] font-bold" style={{ color: bossInfo.color }}>
                            {bossHp} / {bossMaxHp} HP [{(bossHp / bossMaxHp * 100).toFixed(0)}%]
                          </span>
                        </div>
                      </div>

                      {/* Player HP */}
                      <div className="border border-border bg-bg p-3 relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-[#39ff14] font-bold">
                            PLAYER: ACTIVE DEVELOPER
                          </span>
                          <span className="text-[8px] text-muted normal-case font-mono">LOCAL</span>
                        </div>
                        <div className="w-full bg-bg-raised h-4 p-0.5 border border-border-light relative">
                          <div 
                            className="h-full bg-[#39ff14] transition-all duration-300 relative"
                            style={{ 
                              width: `${(playerHp / playerMaxHp) * 100}%`,
                              boxShadow: "0 0 10px rgba(57,255,20,0.6)"
                            }}
                          >
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_90%,rgba(0,0,0,0.4)_90%)] bg-[size:10%_100%]" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[8px] text-dim">PROFILE HEALTH</span>
                          <span className="text-[9px] text-[#39ff14] font-bold">
                            {playerHp} / {playerMaxHp} HP [{(playerHp / playerMaxHp * 100).toFixed(0)}%]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Battle Arena Visuals */}
                    <div className="flex items-center justify-around py-8 bg-bg-card border border-border my-5 relative min-h-[170px] shadow-inner">
                      
                      {/* Floating Text Overlays */}
                      {floatingTexts.map((txt) => (
                        <div
                          key={txt.id}
                          className={`absolute float-text text-[11px] font-bold z-20 ${
                            txt.side === "player" ? "left-[25%]" : "right-[25%]"
                          } ${
                            txt.type === "damage" ? "text-red-500 font-extrabold" :
                            txt.type === "special" ? "text-amber-400 font-extrabold text-xs" :
                            txt.type === "heal" ? "text-emerald-400 font-bold" : "text-sky-400 font-bold"
                          }`}
                          style={{ top: "30%" }}
                        >
                          {txt.text}
                        </div>
                      ))}

                      {/* Player Screen */}
                      <div className="text-center relative">
                        <PlayerGraphic flashing={playerFlashing} />
                        <div className="text-[8px] text-cream border border-border-light px-2 py-0.5 bg-bg mt-3 font-bold inline-block shadow-sm">
                          DEVELOPER.EXE
                        </div>
                      </div>

                      {/* VS Badge */}
                      <div className="flex flex-col items-center">
                        <div className="text-[9px] font-extrabold text-dim bg-bg border-2 border-border px-3 py-1.5 select-none tracking-widest rounded-sm">
                          VS
                        </div>
                        <div className="w-0.5 h-6 bg-border mt-2" />
                      </div>

                      {/* Boss Screen */}
                      <div className="text-center relative">
                        {gameState === "victory" ? (
                          <div className="w-28 h-28 flex flex-col items-center justify-center select-none animate-pulse">
                            <DungeonIcon name="skull" className="w-16 h-16 text-red-600" />
                            <span className="text-[8px] text-red-500 mt-2 tracking-widest font-bold">DAEMON_CRASHED</span>
                          </div>
                        ) : (
                          <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={bossFlashing} />
                        )}
                        <div 
                          className="text-[8px] border px-2 py-0.5 bg-bg mt-3 font-bold inline-block shadow-sm"
                          style={{ borderColor: bossInfo.color, color: bossInfo.color }}
                        >
                          {bossInfo.name.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* RPG Controller Action Pad */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] text-muted font-bold tracking-wider">SELECT COMMAND SEQUENCE:</span>
                        {defending && (
                          <span className="text-[8px] text-sky-400 font-bold animate-pulse">
                            [REFACTOR ACTIVE: DAMAGE MINIMIZED]
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("attack")}
                          className="btn-press border-[3px] border-border-light bg-bg hover:border-lime disabled:opacity-30 disabled:hover:border-border-light px-3 py-2.5 text-[9px] font-bold text-cream tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[4px_4px_0_0_#000000]"
                        >
                          <DungeonIcon name="sword" className="w-3.5 h-3.5" />
                          CODE ATTACK
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("defend")}
                          className="btn-press border-[3px] border-border-light bg-bg hover:border-lime disabled:opacity-30 disabled:hover:border-border-light px-3 py-2.5 text-[9px] font-bold text-cream tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[4px_4px_0_0_#000000]"
                        >
                          <DungeonIcon name="shield" className="w-3.5 h-3.5" />
                          REFACTOR DEF
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("heal")}
                          className="btn-press border-[3px] border-border-light bg-bg hover:border-lime disabled:opacity-30 disabled:hover:border-border-light px-3 py-2.5 text-[9px] font-bold text-cream tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[4px_4px_0_0_#000000]"
                        >
                          <DungeonIcon name="sparkles" className="w-3.5 h-3.5" />
                          TEST HEAL
                        </button>
                        <button
                          disabled={gameState !== "battle" || specialCooldown > 0}
                          onClick={() => handleAction("special")}
                          className="btn-press border-[3px] border-border-light bg-bg hover:border-lime disabled:opacity-30 disabled:hover:border-border-light px-3 py-2.5 text-[9px] font-bold text-cream tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[4px_4px_0_0_#000000]"
                        >
                          <DungeonIcon name="fire" className="w-3.5 h-3.5" />
                          COMMIT {specialCooldown > 0 ? `(${specialCooldown})` : ""}
                        </button>
                      </div>
                    </div>

                    {/* Battle Simulator Console Logs */}
                    <div className="border-[3px] border-border bg-bg p-4 h-48 overflow-y-auto font-mono text-[9px] leading-relaxed scrollbar-thin">
                      {battleLogs.map((log, index) => {
                        let textColor = "text-cream-dark";
                        let iconName = "system";
                        
                        switch (log.type) {
                          case "attack":
                            textColor = "text-amber-400";
                            iconName = "sword";
                            break;
                          case "special":
                            textColor = "text-red-400 font-bold";
                            iconName = "fire";
                            break;
                          case "heal":
                            textColor = "text-emerald-400";
                            iconName = "sparkles";
                            break;
                          case "defend":
                            textColor = "text-sky-400";
                            iconName = "shield";
                            break;
                          case "boss":
                            textColor = "text-rose-500";
                            iconName = "skull";
                            break;
                          case "warning":
                            textColor = "text-amber-500 font-bold";
                            iconName = "warning";
                            break;
                          case "victory":
                            textColor = "text-emerald-400 font-bold";
                            iconName = "trophy";
                            break;
                          case "gift":
                            textColor = "text-yellow-300";
                            iconName = "gift";
                            break;
                          case "defeat":
                            textColor = "text-red-600 font-bold";
                            iconName = "skull";
                            break;
                          case "tip":
                            textColor = "text-teal-400";
                            iconName = "tip";
                            break;
                          default:
                            textColor = "text-muted";
                            iconName = "system";
                        }

                        return (
                          <div key={index} className={`mb-1.5 flex items-start gap-2 ${textColor}`}>
                            <span className="text-[8px] opacity-40 shrink-0 select-none font-mono">[{log.timestamp}]</span>
                            <span className="mt-0.5 shrink-0">
                              <DungeonIcon name={iconName} className="w-3 h-3" />
                            </span>
                            <span className="normal-case">{log.message}</span>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                    </div>

                    {/* Reset/Back Control on Game Over */}
                    {gameState !== "battle" && (
                      <div className="mt-4 flex gap-4">
                        <button
                          onClick={startBattle}
                          className="btn-press flex-1 border-[3px] border-lime bg-lime/10 hover:bg-lime/20 text-[10px] py-3.5 font-bold tracking-widest text-lime cursor-pointer shadow-[4px_4px_0_0_#000000]"
                        >
                          ⚔ ENTER DUNGEON AGAIN
                        </button>
                        <button
                          onClick={() => setGameState("intro")}
                          className="border border-border bg-bg-card hover:bg-bg text-muted hover:text-cream text-[10px] px-6 py-3.5 transition-colors duration-150 cursor-pointer"
                        >
                          [ RETREAT ]
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>
              
            </div>

            {/* Right Side: Boss/Challenge Details Card */}
            <div className="md:col-span-4 flex flex-col gap-6">
              
              {/* Leetcode Boss Details */}
              <div className="border-[3px] border-border bg-bg-raised p-5 shadow-lg relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.05)_0%,transparent_70%)]" />
                <span className="text-[8px] text-lime block mb-1">DUNGEON INTELLIGENCE</span>
                <h3 className="text-xs text-cream mb-4 font-bold">TODAY&apos;S MISSION OBJECTIVE</h3>
                
                <div className="mb-4">
                  <span className="text-[9px] text-muted block mb-1.5 font-bold">TARGET BOSS DAEMON:</span>
                  <div className="flex items-center gap-3 bg-bg border border-border p-2.5">
                    <div className="scale-75 origin-center shrink-0">
                      <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={false} />
                    </div>
                    <div>
                      <span className="text-[10px] text-cream font-bold block leading-tight">{bossInfo.name}</span>
                      <span className="text-[8px] text-muted normal-case block mt-0.5">Integrity Unit: {bossInfo.maxHp} HP</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-[9px] text-muted block mb-1.5 font-bold">LEETCODE DAILY CHALLENGE:</span>
                  <div className="bg-bg border border-border p-3">
                    <p className="text-[10px] text-cream normal-case font-bold leading-normal">{problem.title}</p>
                    <span className="text-[8px] text-muted block mt-1 normal-case font-mono">SLUG: {problem.titleSlug}</span>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-muted block mb-1.5 font-bold">DIFFICULTY:</span>
                    <span 
                      className="border px-2.5 py-0.5 text-[8px] font-bold inline-block"
                      style={{ borderColor: bossInfo.color, color: bossInfo.color, backgroundColor: `${bossInfo.color}10` }}
                    >
                      {problem.difficulty.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted block mb-1.5 font-bold text-right">SYNC_REWARD:</span>
                    <span className="text-[9px] text-emerald-400 font-bold text-right block font-mono">
                      +{problem.difficulty === "Easy" ? "50" : problem.difficulty === "Medium" ? "100" : "200"} XP
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-6">
                  <p className="text-[9px] text-muted normal-case mb-4 leading-relaxed">
                    Connecting to the remote mainframe resolves this objective. Access the direct coding console on LeetCode to submit your solution.
                  </p>
                  
                  <a
                    href={leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press w-full text-center block border-[3px] border-lime bg-lime/10 hover:bg-lime/20 text-lime font-bold text-xs py-3.5 tracking-widest transition-all duration-150 no-underline shadow-[4px_4px_0_0_#000000]"
                  >
                    ⚔ FIGHT ON LEETCODE
                  </a>
                </div>

              </div>

              {/* Simulator Run Statistics */}
              {gameState !== "intro" && (
                <div className="border-[3px] border-border bg-bg-raised p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle_at_top_right,rgba(0,210,255,0.05)_0%,transparent_70%)]" />
                  <span className="text-[8px] text-sky-400 block mb-1">DASHBOARD INTEGRITY</span>
                  <h3 className="text-xs text-cream mb-4 font-bold">SESSION DIAGNOSTICS</h3>
                  
                  <div className="space-y-3 text-[10px]">
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted">TURNS COMMITTED:</span>
                      <span className="text-cream font-bold font-mono">{battleStats.turnsPlayed}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted">DAMAGE DELIVERED:</span>
                      <span className="text-emerald-400 font-bold font-mono">{battleStats.damageDealt} PT</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted">DAMAGE TAKEN:</span>
                      <span className="text-rose-400 font-bold font-mono">{battleStats.damageTaken} PT</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted">LOCAL TEST RUNS:</span>
                      <span className="text-sky-400 font-bold font-mono">{battleStats.healsUsed} HEALS</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dungeon Instructions */}
              <div className="border-[3px] border-border bg-bg-raised p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DungeonIcon name="tip" className="w-4 h-4 text-[#ffa116]" />
                  <h4 className="text-xs text-cream font-bold">RULES OF THE CRYPT</h4>
                </div>
                <ul className="text-[9px] text-muted normal-case space-y-2.5 list-disc pl-4 leading-relaxed">
                  <li>The Daily Challenge rotates automatically every midnight UTC.</li>
                  <li>Solving the boss problem on LeetCode awards custom **XP** and **Arena score**.</li>
                  <li>Defeating harder bosses (Medium/Hard) drops higher tier materials to equip.</li>
                  <li>Use the `/api/cron/rotate-daily-challenge` endpoint or GitHub actions to update.</li>
                </ul>
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}
