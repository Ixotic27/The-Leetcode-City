"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface DailyProblem {
  title: string;
  difficulty: string;
  titleSlug: string;
}

const BOSS_MAP: Record<string, { name: string; emoji: string; color: string; maxHp: number; baseDmg: number }> = {
  Easy:   { name: "Scurrying Goblin", emoji: "👺", color: "#4ade80", maxHp: 80, baseDmg: 8 },
  Medium: { name: "Brutal Orc Warlord", emoji: "👹", color: "#fb923c", maxHp: 120, baseDmg: 14 },
  Hard:   { name: "Ancient Red Dragon", emoji: "🐉", color: "#ef4444", maxHp: 180, baseDmg: 22 },
};

// Retro 8-bit Audio Synthesizer using Web Audio API
function playRetroSound(type: "hit" | "heal" | "defend" | "victory" | "defeat" | "special") {
  if (typeof window === "undefined") return;
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
        // Play an arpeggio
        [
          { note: 261.63, time: 0 },   // C4
          { note: 329.63, time: 0.1 }, // E4
          { note: 392.00, time: 0.2 }, // G4
          { note: 523.25, time: 0.3 }, // C5
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
    // Audio context initialization blocked or unsupported
  }
}

export default function DungeonPage() {
  const [problem, setProblem] = useState<DailyProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // RPG Battle Simulation States
  const [gameState, setGameState] = useState<"intro" | "battle" | "victory" | "defeat">("intro");
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [defending, setDefending] = useState(false);
  const [specialCooldown, setSpecialCooldown] = useState(0);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

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
        setError(true);
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
    setGameState("battle");
    setBattleLogs([
      `🗡 YOU DESCEND INTO THE DARKNESS OF THE CODING DUNGEON...`,
      `⚠️ A WILD ${stats.name.toUpperCase()} (${problem.difficulty.toUpperCase()}) BLOCKS YOUR WAY!`,
      `💬 BOSS: "So you think you can solve today's challenge?"`,
      `⚔ THE BATTLE BEGINS! CHOOSE YOUR ACTION.`
    ]);
    playRetroSound("hit");
  };

  const addLog = (msg: string) => {
    setBattleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
      addLog(`⚔ YOU CAST [SOLVE SOLUTION] ON ${bossStats.name.toUpperCase()} FOR ${playerDamage} DAMAGE!`);
      playRetroSound("hit");

      if (nextHp === 0) {
        triggerVictory();
        return;
      }
    } else if (action === "special") {
      if (specialCooldown > 0) return;
      playerDamage = Math.floor(Math.random() * 20) + 35; // 35 - 54
      const nextHp = Math.max(0, bossHp - playerDamage);
      setBossHp(nextHp);
      setSpecialCooldown(3); // 3 turns cooldown
      addLog(`🔥 SPECIAL ATTACK! YOU DEPLOYED A [GITHUB COMMIT] DEALING ${playerDamage} SYSTEM CRITICAL DAMAGE!`);
      playRetroSound("special");

      if (nextHp === 0) {
        triggerVictory();
        return;
      }
    } else if (action === "heal") {
      const healAmount = Math.floor(Math.random() * 10) + 20; // 20 - 29
      setPlayerHp((prev) => Math.min(playerMaxHp, prev + healAmount));
      addLog(`✨ YOU RAN [RUN TESTS] AND PATCHED YOUR SOURCE FILE, RECOVERING ${healAmount} HP!`);
      playRetroSound("heal");
    } else if (action === "defend") {
      setDefending(true);
      addLog(`🛡 YOU USED [CODE REFACTOR]. YOUR ALGORITHMIC DEFENSES ARE RAISED!`);
      playRetroSound("defend");
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
      
      const bossAbility = bossDamage > bossStats.baseDmg + 2 
        ? "CRITICAL ATTACK [STACK OVERFLOW]" 
        : "BASIC STRIKE [COMPILATION ERROR]";
      
      addLog(`👹 ${bossStats.name.toUpperCase()} CASTS [${bossAbility}], DEALING ${finalBossDamage} DAMAGE TO YOUR HEALTH.`);
      playRetroSound("hit");

      if (nextPlayerHp === 0) {
        triggerDefeat();
      }
    }, 800);
  };

  const triggerVictory = () => {
    setGameState("victory");
    addLog(`✨ VICTORY! THE ${BOSS_MAP[problem?.difficulty ?? "Medium"].name.toUpperCase()} WAS DEFEATED!`);
    addLog(`🎁 YOU ACQUIRED: XP POINTS, ARENA RATINGS, AND THE RESPECT OF THE LEETCODE CITY.`);
    playRetroSound("victory");
  };

  const triggerDefeat = () => {
    setGameState("defeat");
    addLog(`💀 DEFEATED! THE CODING DUNGEON CONSUMED YOUR PROFILE.`);
    addLog(`💡 TIP: REFRACTOR YOUR CODE AND TRY ATTACKING AGAIN!`);
    playRetroSound("defeat");
  };

  const bossInfo = problem ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"]) : null;
  const leetcodeUrl = problem ? `https://leetcode.com/problems/${problem.titleSlug}/` : "#";

  return (
    <main className="min-h-screen bg-black/95 font-pixel uppercase text-warm [image-rendering:pixelated] pb-16">
      
      {/* Background neon style overlays */}
      <div className="absolute inset-0 bg-radial-at-t from-red-955/20 via-transparent to-transparent pointer-events-none" />

      <div className="mx-auto max-w-4xl px-4 py-8 relative z-10">
        
        {/* Navigation & Header */}
        <div className="flex flex-col items-center justify-between border-b border-red-900/30 pb-6 md:flex-row mb-8">
          <Link
            href="/"
            className="mb-4 inline-block text-xs text-red-500/70 hover:text-red-400 transition-colors md:mb-0"
          >
            &larr; RETREAT TO CITY
          </Link>
          
          <h1 
            className="text-center text-2xl tracking-[0.15em] text-red-500 font-bold"
            style={{ textShadow: "0 0 12px rgba(239, 68, 68, 0.4)" }}
          >
            ⚔ THE CODING DUNGEON ⚔
          </h1>
          
          <div className="w-24 md:block hidden"></div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex h-96 flex-col items-center justify-center border-[3px] border-red-500/20 bg-neutral-950/50 p-8 text-center">
            <div className="text-4xl animate-bounce mb-4">👹</div>
            <p className="text-sm tracking-widest text-red-400/80 blink-dot">SUMMONING DAILY DUNGEON BOSS</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="flex h-96 flex-col items-center justify-center border-[3px] border-red-500 bg-red-950/20 p-8 text-center">
            <div className="text-4xl mb-4">💀</div>
            <h2 className="text-base text-red-500 mb-2 font-bold">DUNGEON CRITICAL ERROR</h2>
            <p className="text-xs text-muted normal-case max-w-sm">
              The Daily Dungeon portal collapsed! This is likely due to the LeetCode API server timing out. Please retreat to the city and try again later.
            </p>
          </div>
        )}

        {/* CORE INTERFACE */}
        {problem && bossInfo && !loading && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            
            {/* Left Side: Game Battle Console (RPG Engine) */}
            <div className="md:col-span-8 flex flex-col gap-6">
              
              {/* Game Screen Container */}
              <div className="border-[3px] border-red-800 bg-neutral-950 p-5 shadow-[0_0_20px_rgba(239,68,68,0.05)]">
                
                {/* Intro Screen */}
                {gameState === "intro" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-6xl mb-6 animate-pulse select-none">{bossInfo.emoji}</div>
                    <span className="text-[10px] text-red-500/80 block mb-1">TODAY&apos;S GUARDIAN ENCOUNTER</span>
                    <h2 
                      className="text-lg font-bold mb-4"
                      style={{ color: bossInfo.color }}
                    >
                      {bossInfo.name.toUpperCase()}
                    </h2>
                    
                    <div className="max-w-md bg-neutral-900 border border-neutral-800 p-4 mb-8 text-[10px] text-neutral-400 normal-case leading-relaxed">
                      Every day, a new boss is summoned from the official LeetCode Daily Challenge. Solve the challenge to deal a fatal blow, or test your logic here in the simulation to claim glory.
                    </div>

                    <button
                      onClick={startBattle}
                      className="border-[2px] border-red-600 bg-red-800 hover:bg-red-700 active:translate-y-0.5 px-8 py-3 text-xs text-white transition-colors duration-150 font-bold tracking-widest"
                    >
                      ⚔ CHALLENGE BOSS
                    </button>
                  </div>
                )}

                {/* Active Battle Screen */}
                {(gameState === "battle" || gameState === "victory" || gameState === "defeat") && (
                  <div className="flex flex-col">
                    
                    {/* Health Status Bar Header */}
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-red-900/20">
                      
                      {/* Boss HP */}
                      <div className="border border-red-900/40 bg-neutral-900/60 p-2.5">
                        <span className="text-[9px] text-red-400/80 block mb-1">BOSS: {bossInfo.name.toUpperCase()}</span>
                        <div className="w-full bg-black h-3 p-0.5 border border-red-950">
                          <div 
                            className="h-full bg-red-600 transition-all duration-300"
                            style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-neutral-500 block text-right mt-0.5">{bossHp}/{bossMaxHp} HP</span>
                      </div>

                      {/* Player HP */}
                      <div className="border border-red-900/40 bg-neutral-900/60 p-2.5">
                        <span className="text-[9px] text-green-400/80 block mb-1">PLAYER: ACTIVE DEVELOPER</span>
                        <div className="w-full bg-black h-3 p-0.5 border border-red-950">
                          <div 
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-neutral-500 block text-right mt-0.5">{playerHp}/{playerMaxHp} HP</span>
                      </div>
                    </div>

                    {/* Battle Arena Visuals */}
                    <div className="flex items-center justify-around py-8 bg-neutral-900/30 border-b border-red-900/20 my-4 relative min-h-[140px]">
                      
                      {/* Player Avatar */}
                      <div className="text-center">
                        <div className="text-5xl mb-2 animate-bounce select-none">💻</div>
                        <div className="text-[8px] text-green-400 border border-green-500/30 px-1.5 py-0.5 bg-green-955/20">CODING AGENT</div>
                      </div>

                      {/* Versus FX */}
                      <div className="text-lg font-bold text-red-600/50 select-none">VS</div>

                      {/* Boss Avatar */}
                      <div className="text-center">
                        <div className="text-5xl mb-2 animate-bounce select-none" style={{ animationDelay: "0.2s" }}>
                          {gameState === "victory" ? "💀" : bossInfo.emoji}
                        </div>
                        <div className="text-[8px] border px-1.5 py-0.5 bg-neutral-950" style={{ borderColor: bossInfo.color, color: bossInfo.color }}>
                          {bossInfo.name.split(" ")[0].toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* RPG Controller Action Pad */}
                    <div className="mb-4">
                      <span className="text-[9px] text-neutral-500 block mb-1.5 font-bold">SELECT ENCOUNTER ACTION:</span>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("attack")}
                          className="border border-red-900 bg-red-950/40 hover:bg-red-955/70 disabled:opacity-30 disabled:hover:bg-red-950/40 px-3 py-2 text-[9px] font-bold text-cream tracking-wider transition-colors"
                        >
                          ⚔ CODE ATTACK
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("defend")}
                          className="border border-red-900 bg-red-950/40 hover:bg-red-955/70 disabled:opacity-30 disabled:hover:bg-red-950/40 px-3 py-2 text-[9px] font-bold text-cream tracking-wider transition-colors"
                        >
                          🛡 DEFEND / REFACTOR
                        </button>
                        <button
                          disabled={gameState !== "battle"}
                          onClick={() => handleAction("heal")}
                          className="border border-red-900 bg-red-950/40 hover:bg-red-955/70 disabled:opacity-30 disabled:hover:bg-red-950/40 px-3 py-2 text-[9px] font-bold text-cream tracking-wider transition-colors"
                        >
                          ✨ HEAL / COMPILE
                        </button>
                        <button
                          disabled={gameState !== "battle" || specialCooldown > 0}
                          onClick={() => handleAction("special")}
                          className="border border-red-900 bg-red-950/40 hover:bg-red-955/70 disabled:opacity-30 disabled:hover:bg-red-950/40 px-3 py-2 text-[9px] font-bold text-cream tracking-wider transition-colors"
                        >
                          🔥 COMMIT {specialCooldown > 0 ? `(${specialCooldown})` : ""}
                        </button>
                      </div>
                    </div>

                    {/* Battle Simulator Console Logs */}
                    <div className="border border-red-955 bg-black/90 p-4 h-48 overflow-y-auto font-mono text-[9px] text-red-500/80 leading-relaxed scrollbar-thin">
                      {battleLogs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>

                    {/* Reset/Back Control on Game Over */}
                    {gameState !== "battle" && (
                      <div className="mt-4 flex gap-4">
                        <button
                          onClick={startBattle}
                          className="flex-1 border-2 border-red-500 bg-red-950 hover:bg-red-900 text-[10px] py-2.5 font-bold tracking-wider"
                        >
                          ⚔ ENTER DUNGEON AGAIN
                        </button>
                        <button
                          onClick={() => setGameState("intro")}
                          className="border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-500 hover:text-cream text-[10px] px-6 py-2.5"
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
              <div className="border-[3px] border-red-900 bg-neutral-950 p-5">
                <span className="text-[8px] text-red-500/80 block mb-1">DUNGEON LORE</span>
                <h3 className="text-xs text-cream mb-4 font-bold">TODAY&apos;S MISSION OBJECTIVE</h3>
                
                <div className="mb-4">
                  <span className="text-[9px] text-neutral-500 block mb-1 font-bold">TARGET BOSS:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{bossInfo.emoji}</span>
                    <span className="text-[11px] text-cream font-bold">{bossInfo.name}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-[9px] text-neutral-500 block mb-1 font-bold">LEETCODE DAILY CHALLENGE:</span>
                  <p className="text-[11px] text-cream normal-case font-bold">{problem.title}</p>
                </div>

                <div className="mb-6">
                  <span className="text-[9px] text-neutral-500 block mb-1 font-bold">DIFFICULTY RATING:</span>
                  <span 
                    className="border px-2 py-0.5 text-[9px] font-bold inline-block"
                    style={{ borderColor: bossInfo.color, color: bossInfo.color, backgroundColor: `${bossInfo.color}15` }}
                  >
                    {problem.difficulty.toUpperCase()}
                  </span>
                </div>

                <div className="border-t border-red-955 pt-4">
                  <p className="text-[9px] text-neutral-400 normal-case mb-4 leading-relaxed">
                    Solving the problem on the official LeetCode platform secures your victory. The City Sync scripts will pick up your submission within minutes!
                  </p>
                  
                  <a
                    href={leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center block border-[2px] border-red-400 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-3 tracking-widest transition-colors duration-150"
                  >
                    ⚔ FIGHT ON LEETCODE
                  </a>
                </div>

              </div>

              {/* Dungeon Instructions */}
              <div className="border-[3px] border-neutral-900 bg-neutral-950 p-5">
                <h4 className="text-xs text-cream mb-3 font-bold">RULES OF THE CRYPT</h4>
                <ul className="text-[9px] text-neutral-400 normal-case space-y-2.5 list-disc pl-4 leading-relaxed">
                  <li>The Daily Challenge rotates automatically every midnight UTC.</li>
                  <li>Solving the boss problem on LeetCode awards custom **XP** and **Arena score**.</li>
                  <li>Defeating harder bosses (Medium/Hard) drops higher tier materials to equip.</li>
                  <li>Use the \`/api/cron/rotate-daily-challenge\` endpoint or GitHub actions to update.</li>
                </ul>
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}
