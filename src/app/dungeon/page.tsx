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
  Easy:   { name: "Scourge Goblin", type: "goblin", color: "#00b8a3", maxHp: 80, baseDmg: 8 },
  Medium: { name: "Ravage Orc", type: "orc", color: "#ffa116", maxHp: 120, baseDmg: 14 },
  Hard:   { name: "Void Dragon", type: "dragon", color: "#ff2d55", maxHp: 180, baseDmg: 22 },
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
  const flashClass = flashing ? "brightness-125 saturate-125 contrast-110 scale-105" : "";
  
  if (type === "goblin") {
    return (
      <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
        <defs>
          <linearGradient id="goblinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00665c" />
            <stop offset="50%" stopColor="#00b8a3" />
            <stop offset="100%" stopColor="#80dfd3" />
          </linearGradient>
        </defs>
        {/* Clean Tech Grid Background */}
        <rect x="5" y="5" width="90" height="90" fill="#202020" stroke="#333333" strokeWidth="1" rx="8" />
        {/* Neck */}
        <path d="M40 70 L60 70 L55 80 L45 80 Z" fill="#004d45" />
        <path d="M30 75 L70 75 L65 72 L35 72 Z" fill="#2d2d2d" stroke="#00b8a3" strokeWidth="1" />
        {/* Head */}
        <path d="M25 40 L35 30 L65 30 L75 40 L70 70 L30 70 Z" fill="url(#goblinGrad)" stroke="#00b8a3" strokeWidth="2" />
        {/* Ears */}
        <path d="M25 42 L5 25 L28 48 Z" fill="#008c7c" stroke="#004d45" strokeWidth="1.5" />
        <path d="M75 42 L95 25 L72 48 Z" fill="#008c7c" stroke="#004d45" strokeWidth="1.5" />
        {/* Visor */}
        <path d="M28 45 L72 45 L68 53 L32 53 Z" fill="#1e1e1e" stroke="#ffa116" strokeWidth="1.5" />
        <rect x="35" y="47" width="30" height="4" fill="#ffa116" opacity="0.9" />
        <circle cx="60" cy="49" r="2" fill="#ff2d55" />
        {/* Jaw */}
        <path d="M35 60 L45 62 L55 62 L65 60 L60 67 L40 67 Z" fill="#3e3e3e" stroke="#4a4a4a" strokeWidth="1" />
        {/* Antenna */}
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
            <stop offset="0%" stopColor="#cc7100" />
            <stop offset="50%" stopColor="#ffa116" />
            <stop offset="100%" stopColor="#ffe0b2" />
          </linearGradient>
        </defs>
        {/* Clean Tech Grid Background */}
        <rect x="5" y="5" width="90" height="90" fill="#202020" stroke="#333333" strokeWidth="1" rx="8" />
        {/* Shoulders */}
        <path d="M10 75 L30 65 L70 65 L90 75 L85 85 L15 85 Z" fill="#2d2d2d" stroke="#3e3e3e" strokeWidth="2" />
        <circle cx="20" cy="72" r="2" fill="#888888" />
        <circle cx="80" cy="72" r="2" fill="#888888" />
        {/* Neck */}
        <rect x="38" y="58" width="24" height="10" fill="#1e1e1e" stroke="#ffa116" strokeWidth="1" />
        {/* Head */}
        <path d="M22 30 L78 30 L74 60 L26 60 Z" fill="url(#orcGrad)" stroke="#cc7100" strokeWidth="2" />
        {/* Visor */}
        <path d="M20 38 L80 38 L72 50 L50 56 L28 50 Z" fill="#2d2d2d" stroke="#4a4a4a" strokeWidth="1.5" />
        <path d="M32 43 L68 43 L65 47 L35 47 Z" fill="#ff2d55" />
        <circle cx="50" cy="45" r="1.5" fill="#fff" />
        {/* Tusks */}
        <path d="M26 60 L18 52 L26 50 Z" fill="#eaeaea" stroke="#cccccc" strokeWidth="1" />
        <path d="M74 60 L82 52 L74 50 Z" fill="#eaeaea" stroke="#cccccc" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
      <defs>
        <linearGradient id="dragonBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#99001f" />
          <stop offset="50%" stopColor="#ff2d55" />
          <stop offset="100%" stopColor="#ffccd5" />
        </linearGradient>
      </defs>
      {/* Clean Tech Grid Background */}
      <rect x="5" y="5" width="90" height="90" fill="#202020" stroke="#333333" strokeWidth="1" rx="8" />
      {/* Wings */}
      <path d="M12 40 L5 20 L25 25 L12 40 L28 42 Z" fill="#660014" stroke="#ff2d55" strokeWidth="1.5" />
      <path d="M88 40 L95 20 L75 25 L88 40 L72 42 Z" fill="#660014" stroke="#ff2d55" strokeWidth="1.5" />
      {/* Neck */}
      <path d="M42 62 L58 62 L54 85 L46 85 Z" fill="#cc0029" stroke="#ff2d55" strokeWidth="1.5" />
      {/* Head */}
      <path d="M22 35 L50 15 L78 35 L72 65 L50 80 L28 65 Z" fill="url(#dragonBody)" stroke="#be123c" strokeWidth="2" />
      {/* Horns */}
      <path d="M30 20 L15 2 L25 15" fill="none" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 20 L85 2 L75 15" fill="none" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" />
      {/* Eyes */}
      <polygon points="34,42 44,38 46,46" fill="#ffa116" />
      <polygon points="66,42 56,38 54,46" fill="#ffa116" />
      <circle cx="40" cy="42" r="1" fill="#fff" />
      <circle cx="60" cy="42" r="1" fill="#fff" />
      {/* Mouth */}
      <path d="M38 58 L50 68 L62 58 Z" fill="#1a1a1a" stroke="#be123c" strokeWidth="1.5" />
      <polygon points="40,58 42,62 44,58" fill="#ffffff" />
      <polygon points="60,58 58,62 56,58" fill="#ffffff" />
      <circle cx="50" cy="62" r="2.5" fill="#ffa116" />
    </svg>
  );
}

// Custom Vector Graphic for Player (Coding Terminal Desk)
function PlayerGraphic({ flashing }: { flashing: boolean }) {
  const flashClass = flashing ? "brightness-125 saturate-125 contrast-110" : "";
  return (
    <svg viewBox="0 0 100 100" className={`w-28 h-28 transition-all duration-150 ${flashClass}`}>
      <defs>
        <linearGradient id="screenBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e1e1e" />
          <stop offset="100%" stopColor="#121212" />
        </linearGradient>
      </defs>
      {/* Clean Background Grid */}
      <rect x="5" y="5" width="90" height="90" fill="#202020" stroke="#333333" strokeWidth="1" rx="8" />
      {/* Desk pedestal */}
      <path d="M20 82 L80 82 L85 92 L15 92 Z" fill="#2d2d2d" stroke="#3e3e3e" strokeWidth="1.5" />
      {/* Stand */}
      <rect x="44" y="68" width="12" height="14" fill="#3e3e3e" stroke="#4a4a4a" strokeWidth="1.5" />
      {/* Bezel */}
      <rect x="15" y="15" width="70" height="54" fill="#2d2d2d" stroke="#3e3e3e" strokeWidth="2.5" rx="6" />
      {/* Screen */}
      <rect x="18" y="18" width="64" height="48" fill="url(#screenBg)" stroke="#1a1a1a" strokeWidth="1.5" />
      {/* Status segments */}
      <rect x="22" y="24" width="15" height="4" fill="#00b8a3" opacity="0.8" />
      <rect x="22" y="32" width="30" height="4" fill="#ffa116" opacity="0.8" />
      <rect x="22" y="40" width="22" height="4" fill="#3e3e3e" opacity="0.8" />
      <rect x="22" y="48" width="45" height="4" fill="#00b8a3" opacity="0.3" />
      {/* Small status dot */}
      <circle cx="75" cy="26" r="3" fill="#ffa116" />
    </svg>
  );
}

// Custom Retro Styled Vector Icons replacing all standard system emojis
function DungeonIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  switch (name) {
    case "sword":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M19 19L5 5" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.3-6.3l-.7.7M6.7 17.3l-.7.7m12.6 0l-.7-.7M6.7 6.7l-.7-.7" />
        </svg>
      );
    case "fire":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
        </svg>
      );
    case "skull":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 10a1 1 0 102 0 1 1 0 00-2 0m4 0a1 1 0 102 0 1 1 0 00-2 0" />
          <path d="M12 2a8 8 0 00-8 8c0 3 2.5 5.6 5 6.5v2.5h6v-2.5c2.5-.9 5-3.5 5-6.5a8 8 0 00-8-8z" />
        </svg>
      );
    case "gift":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "tip":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5.5 5.5 0 0 0 7.5 8c0 1.3.5 2.6 1.5 3.5.7.8 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6M10 22h4" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
    case "trophy":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
          <path d="M12 2a5 5 0 0 0-5 5v3c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4V7a5 5 0 0 0-5-5z" />
        </svg>
      );
    case "sound-on":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case "sound-off":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      );
    case "system":
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
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
      { timestamp: new Date().toLocaleTimeString(), type: "system", message: "You descend into the coding dungeon..." },
      { timestamp: new Date().toLocaleTimeString(), type: "warning", message: `A wild ${stats.name} (${problem.difficulty} challenge) appears!` },
      { timestamp: new Date().toLocaleTimeString(), type: "boss", message: 'Boss: "Let\'s see if you can solve this today."' },
      { timestamp: new Date().toLocaleTimeString(), type: "system", message: "The battle begins! Choose your command sequence." }
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
      addLog(`You compile code solutions, dealing ${playerDamage} damage to ${bossStats.name}.`, "attack");
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
      addLog(`Critical attack! You deployed a git commit, dealing ${playerDamage} damage to ${bossStats.name}!`, "special");
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
      addLog(`You refactored files and patched your workspace, recovering ${healAmount} health.`, "heal");
      setBattleStats(prev => ({ ...prev, healsUsed: prev.healsUsed + 1, turnsPlayed: prev.turnsPlayed + 1 }));
      playRetroSound("heal", soundEnabled);
    } else if (action === "defend") {
      setDefending(true);
      spawnFloatingText("DEFENSE UP", "player", "defense");
      addLog(`You implemented code comments, shielding yourself from incoming attacks.`, "defend");
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
        ? "Critical Error: Stack Overflow" 
        : "Compilation Warning: Syntax Error";
      
      addLog(`${bossStats.name} executes [${bossAbility}], dealing ${finalBossDamage} damage.`, "boss");
      setBattleStats(prev => ({ ...prev, damageTaken: prev.damageTaken + finalBossDamage }));
      playRetroSound("hit", soundEnabled);

      if (nextPlayerHp === 0) {
        triggerDefeat();
      }
    }, 800);
  };

  const triggerVictory = () => {
    setGameState("victory");
    addLog(`Victory! The ${BOSS_MAP[problem?.difficulty ?? "Medium"].name} has been defeated!`, "victory");
    addLog("You have resolved today's challenge. Rewards sync complete.", "gift");
    playRetroSound("victory", soundEnabled);
  };

  const triggerDefeat = () => {
    setGameState("defeat");
    addLog("Defeated! The compiler rejected your updates.", "defeat");
    addLog("Tip: Refactor your solution logic and retry the challenge.", "tip");
    playRetroSound("defeat", soundEnabled);
  };

  const bossInfo = problem ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"]) : null;
  const leetcodeUrl = problem ? `https://leetcode.com/problems/${problem.titleSlug}/` : "#";

  return (
    <main className="min-h-screen bg-[#1a1a1a] font-sans text-zinc-300 pb-16 relative">
      
      {/* Subtle LeetCode-style background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/10 via-transparent to-transparent pointer-events-none z-0" />

      {/* Spacing Styles */}
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
      `}</style>

      {/* Page Content Wrapper (Distributed full width max-w-7xl) */}
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative z-10 ${screenShaking ? "screen-shake" : ""}`}>
        
        {/* Navigation & Header */}
        <div className="flex flex-col border-b border-zinc-800 pb-5 mb-8 md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors duration-150 group"
            >
              <DungeonIcon name="arrow-left" className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Retreat to City
            </Link>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500 text-xs font-mono">SIMULATION PORTAL v2.5.0</span>
          </div>
          
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-bold tracking-wide text-zinc-100 flex items-center justify-center gap-2 select-none">
              <span className="text-[#ffa116]"><DungeonIcon name="sword" className="w-5 h-5" /></span>
              THE CODING DUNGEON
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleSound}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer bg-zinc-800/60 border border-zinc-700 px-3 py-1.5 rounded-md"
              title={soundEnabled ? "Mute sound" : "Unmute sound"}
            >
              <DungeonIcon name={soundEnabled ? "sound-on" : "sound-off"} className="w-3.5 h-3.5" />
              <span>{soundEnabled ? "Sound On" : "Sound Muted"}</span>
            </button>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-400">Gateway Connected</span>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex h-96 flex-col items-center justify-center border border-zinc-800 bg-[#282828] rounded-xl p-8 text-center shadow-lg relative overflow-hidden">
            <div className="relative mb-6">
              <svg viewBox="0 0 100 100" className="w-16 h-16 animate-spin text-[#ffa116]" style={{ animationDuration: "2.5s" }}>
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="15 8" fill="none" opacity="0.2" />
                <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3" strokeDasharray="30 10" fill="none" />
                <polygon points="50,25 55,45 75,50 55,55 50,75 45,55 25,50 45,45" fill="currentColor" opacity="0.7" />
              </svg>
            </div>
            <p className="text-sm font-bold text-zinc-200 tracking-wider">Synchronizing Challenge Matrix...</p>
            <p className="text-xs text-zinc-500 mt-2 font-mono">Fetching latest challenge data from LeetCode mainframe</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !problem && (
          <div className="flex h-96 flex-col items-center justify-center border border-rose-950 bg-rose-950/10 rounded-xl p-8 text-center shadow-lg relative">
            <div className="mb-4 text-rose-500">
              <DungeonIcon name="warning" className="w-12 h-12" />
            </div>
            <h2 className="text-base text-rose-400 mb-2 font-bold tracking-wider">PORTAL ERROR</h2>
            <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
              Unable to reach the remote daily API gateway. Check your connection or launch local simulation.
            </p>
            <button
              onClick={() => {
                setError(false);
                setIsOffline(true);
                const randomMock = MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)];
                setProblem(randomMock);
                setLoading(false);
              }}
              className="btn-press border border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-950/30 px-6 py-2.5 text-xs font-semibold rounded-lg tracking-wider cursor-pointer transition-colors"
            >
              Start Local Simulation
            </button>
          </div>
        )}

        {/* CORE INTERFACE */}
        {problem && bossInfo && !loading && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            
            {/* Left Side: Game Battle Console (RPG Engine) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Game Screen Container */}
              <div className="border border-zinc-800 bg-[#282828] rounded-xl p-6 shadow-xl relative flex flex-col gap-6">

                {/* Intro Screen */}
                {gameState === "intro" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center relative z-20">
                    <div className="mb-6 select-none bg-[#1e1e1e] p-4 border border-zinc-800 rounded-lg shadow-inner">
                      <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={false} />
                    </div>
                    <span className="text-[10px] text-zinc-500 block mb-1 font-mono tracking-widest">DUNGEON GUARDIAN SYSTEM</span>
                    <h2 
                      className="text-lg font-bold mb-3 font-mono tracking-wide"
                      style={{ color: bossInfo.color }}
                    >
                      {bossInfo.name}
                    </h2>
                    
                    <p className="max-w-md text-xs text-zinc-400 mb-8 leading-relaxed">
                      Deploy algorithmic optimizations to tackle the challenge. Run tests to recover your health, refactor files to block attacks, and commit code to deliver critical payloads.
                    </p>

                    <button
                      onClick={startBattle}
                      className="btn-press bg-[#ffa116] hover:bg-[#ffb800] text-zinc-950 px-8 py-3 text-xs font-bold rounded-lg tracking-wider transition-colors cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      <DungeonIcon name="sword" className="w-4 h-4" />
                      Engage Boss Simulation
                    </button>
                  </div>
                )}

                {/* Active Battle Screen */}
                {(gameState === "battle" || gameState === "victory" || gameState === "defeat") && (
                  <div className="flex flex-col relative z-20">
                    
                    {/* Health Status Bar Header */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-zinc-800/80">
                      
                      {/* Boss HP */}
                      <div className="border border-zinc-800 bg-[#1e1e1e] rounded-lg p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold" style={{ color: bossInfo.color }}>
                            DAEMON: {bossInfo.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">TARGET</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800 relative">
                          <div 
                            className="h-full transition-all duration-300 rounded-full"
                            style={{ 
                              width: `${(bossHp / bossMaxHp) * 100}%`,
                              backgroundColor: bossInfo.color
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 font-mono">
                          <span>SYSTEM INTEGRITY</span>
                          <span className="font-bold" style={{ color: bossInfo.color }}>
                            {bossHp} / {bossMaxHp} HP ({(bossHp / bossMaxHp * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>

                      {/* Player HP */}
                      <div className="border border-zinc-800 bg-[#1e1e1e] rounded-lg p-4 relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#00b8a3]">
                            DEVELOPER: LOCAL INSTANCE
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">LOCAL</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800 relative">
                          <div 
                            className="h-full bg-[#00b8a3] transition-all duration-300 rounded-full"
                            style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 font-mono">
                          <span>WORK SPACE HEALTH</span>
                          <span className="font-bold text-[#00b8a3]">
                            {playerHp} / {playerMaxHp} HP ({(playerHp / playerMaxHp * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Battle Arena Visuals */}
                    <div className="flex items-center justify-around py-10 bg-[#1e1e1e] border border-zinc-800 rounded-lg my-6 relative min-h-[200px] overflow-hidden shadow-inner">
                      
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id="battleGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#battleGrid)" />
                        </svg>
                      </div>

                      {/* Floating Text Overlays */}
                      {floatingTexts.map((txt) => (
                        <div
                          key={txt.id}
                          className={`absolute float-text text-sm font-bold z-20 ${
                            txt.side === "player" ? "left-[25%]" : "right-[25%]"
                          } ${
                            txt.type === "damage" ? "text-rose-500 font-extrabold" :
                            txt.type === "special" ? "text-amber-500 font-extrabold text-base" :
                            txt.type === "heal" ? "text-emerald-500" : "text-sky-500"
                          }`}
                          style={{ top: "35%" }}
                        >
                          {txt.text}
                        </div>
                      ))}

                      {/* Player Screen */}
                      <div className="text-center relative">
                        <PlayerGraphic flashing={playerFlashing} />
                        <div className="text-xs text-zinc-300 font-medium px-3 py-1 bg-[#282828] border border-zinc-700 rounded mt-3 inline-block shadow-sm">
                          Developer Terminal
                        </div>
                      </div>

                      {/* VS Badge */}
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-zinc-500 bg-[#282828] border border-zinc-700 px-3 py-1.5 select-none tracking-widest rounded shadow-sm font-mono">
                          VS
                        </div>
                      </div>

                      {/* Boss Screen */}
                      <div className="text-center relative">
                        {gameState === "victory" ? (
                          <div className="w-28 h-28 flex flex-col items-center justify-center select-none animate-pulse">
                            <DungeonIcon name="skull" className="w-12 h-12 text-rose-500" />
                            <span className="text-[10px] text-rose-500 mt-2 tracking-widest font-mono font-bold">DAEMON_CRASHED</span>
                          </div>
                        ) : (
                          <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={bossFlashing} />
                        )}
                        <div 
                          className="text-xs font-medium px-3 py-1 bg-[#282828] border rounded mt-3 inline-block shadow-sm"
                          style={{ borderColor: `${bossInfo.color}40`, color: bossInfo.color }}
                        >
                          {bossInfo.name}
                        </div>
                      </div>
                    </div>

                    {/* RPG Controller Action Pad */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-zinc-400 font-semibold tracking-wider">Select Command:</span>
                        {defending && (
                          <span className="text-xs text-sky-400 font-mono animate-pulse">
                            [Refactor Active: Next Attack Shielded]
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("attack")}
                          className="btn-press border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800/80 px-4 py-3 text-xs font-semibold text-zinc-200 tracking-wide rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <DungeonIcon name="sword" className="w-4 h-4 text-amber-500" />
                          Code Attack
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("defend")}
                          className="btn-press border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800/80 px-4 py-3 text-xs font-semibold text-zinc-200 tracking-wide rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <DungeonIcon name="shield" className="w-4 h-4 text-sky-400" />
                          Refactor Def
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("heal")}
                          className="btn-press border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800/80 px-4 py-3 text-xs font-semibold text-zinc-200 tracking-wide rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <DungeonIcon name="sparkles" className="w-4 h-4 text-emerald-400" />
                          Test Heal
                        </button>
                        <button
                          disabled={gameState !== "battle" || specialCooldown > 0}
                          onClick={() => handleAction("special")}
                          className="btn-press border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800/80 px-4 py-3 text-xs font-semibold text-zinc-200 tracking-wide rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <DungeonIcon name="fire" className="w-4 h-4 text-rose-500" />
                          Commit {specialCooldown > 0 ? `(${specialCooldown})` : ""}
                        </button>
                      </div>
                    </div>

                    {/* Battle Simulator Console Logs */}
                    <div className="border border-zinc-800 bg-[#1e1e1e] p-5 h-56 rounded-lg overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin">
                      {battleLogs.map((log, index) => {
                        let textColor = "text-zinc-300";
                        let iconName = "system";
                        
                        switch (log.type) {
                          case "attack":
                            textColor = "text-amber-400";
                            iconName = "sword";
                            break;
                          case "special":
                            textColor = "text-rose-400 font-semibold";
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
                            textColor = "text-amber-500 font-semibold";
                            iconName = "warning";
                            break;
                          case "victory":
                            textColor = "text-emerald-400 font-semibold";
                            iconName = "trophy";
                            break;
                          case "gift":
                            textColor = "text-yellow-300";
                            iconName = "gift";
                            break;
                          case "defeat":
                            textColor = "text-rose-600 font-semibold";
                            iconName = "skull";
                            break;
                          case "tip":
                            textColor = "text-teal-400";
                            iconName = "tip";
                            break;
                          default:
                            textColor = "text-zinc-500";
                            iconName = "system";
                        }

                        return (
                          <div key={index} className={`mb-2 flex items-start gap-2.5 ${textColor}`}>
                            <span className="text-[10px] text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                            <span className="mt-0.5 shrink-0">
                              <DungeonIcon name={iconName} className="w-3.5 h-3.5" />
                            </span>
                            <span className="normal-case font-mono">{log.message}</span>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                    </div>

                    {/* Reset/Back Control on Game Over */}
                    {gameState !== "battle" && (
                      <div className="mt-6 flex gap-4">
                        <button
                          onClick={startBattle}
                          className="btn-press flex-1 bg-[#00b8a3] hover:bg-[#009c8a] text-zinc-950 text-xs py-3.5 font-semibold rounded-lg tracking-wide cursor-pointer transition-colors shadow-sm"
                        >
                          Restart Battle Simulation
                        </button>
                        <button
                          onClick={() => setGameState("intro")}
                          className="border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 text-xs px-6 py-3.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Retreat to Deck
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>
              
            </div>

            {/* Right Side: Boss/Challenge Details Card */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Leetcode Boss Details */}
              <div className="border border-zinc-800 bg-[#282828] p-6 rounded-xl shadow-lg relative">
                <span className="text-[10px] text-zinc-500 block mb-1 font-mono tracking-wider">MISSION BRIEFING</span>
                <h3 className="text-sm text-zinc-200 mb-4 font-bold">Daily Challenge Parameters</h3>
                
                <div className="mb-4">
                  <span className="text-xs text-zinc-500 block mb-2">Target Hostile Daemon:</span>
                  <div className="flex items-center gap-3 bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3">
                    <div className="scale-75 origin-center shrink-0">
                      <BossGraphic type={bossInfo.type} color={bossInfo.color} flashing={false} />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-200 font-bold block">{bossInfo.name}</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Matrix Base: {bossInfo.maxHp} HP</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-xs text-zinc-500 block mb-2">LeetCode Daily challenge:</span>
                  <div className="bg-[#1e1e1e] border border-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-200 font-semibold leading-relaxed">{problem.title}</p>
                    <span className="text-[10px] text-zinc-500 block mt-1 font-mono">Slug: {problem.titleSlug}</span>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1">Difficulty:</span>
                    <span 
                      className="border rounded px-2.5 py-0.5 text-[10px] font-semibold inline-block"
                      style={{ borderColor: `${bossInfo.color}40`, color: bossInfo.color, backgroundColor: `${bossInfo.color}0d` }}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1 text-right">XP Sync:</span>
                    <span className="text-xs text-emerald-400 font-bold text-right block font-mono">
                      +{problem.difficulty === "Easy" ? "50" : problem.difficulty === "Medium" ? "100" : "200"} XP
                    </span>
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-4 mt-6">
                  <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                    Connecting to the remote mainframe resolves this objective. Access the direct coding console on LeetCode to submit your solution.
                  </p>
                  
                  <a
                    href={leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press w-full text-center block bg-[#ffa116] hover:bg-[#ffb800] text-zinc-950 font-bold text-xs py-3.5 rounded-lg transition-colors no-underline shadow-sm flex items-center justify-center gap-2"
                  >
                    <DungeonIcon name="sword" className="w-4 h-4" />
                    Solve on LeetCode
                  </a>
                </div>

              </div>

              {/* Simulator Run Statistics */}
              {gameState !== "intro" && (
                <div className="border border-zinc-800 bg-[#282828] p-6 rounded-xl shadow-lg relative overflow-hidden">
                  <span className="text-[10px] text-zinc-500 block mb-1 font-mono tracking-wider">DIAGNOSTICS</span>
                  <h3 className="text-sm text-zinc-200 mb-4 font-bold">Session Record</h3>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-zinc-500">Commands Run:</span>
                      <span className="text-zinc-200 font-semibold font-mono">{battleStats.turnsPlayed}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-zinc-500">Damage Delivered:</span>
                      <span className="text-amber-500 font-semibold font-mono">{battleStats.damageDealt} HP</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-zinc-500">Damage Taken:</span>
                      <span className="text-rose-500 font-semibold font-mono">{battleStats.damageTaken} HP</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-zinc-500">Local Recoveries:</span>
                      <span className="text-emerald-500 font-semibold font-mono">{battleStats.healsUsed}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dungeon Instructions */}
              <div className="border border-zinc-800 bg-[#282828] p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DungeonIcon name="tip" className="w-4 h-4 text-[#ffa116]" />
                  <h4 className="text-xs text-zinc-200 font-bold">Dungeon Rules</h4>
                </div>
                <ul className="text-xs text-zinc-400 space-y-2.5 list-disc pl-4 leading-relaxed">
                  <li>The Daily Challenge rotates automatically every midnight UTC.</li>
                  <li>Solving the boss problem on LeetCode awards custom XP and Arena rating updates.</li>
                  <li>Defeating higher tier daemons (Medium/Hard) drops higher level credentials and badges.</li>
                  <li>Solving solutions syncs with the city database within minutes of submission.</li>
                </ul>
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}
