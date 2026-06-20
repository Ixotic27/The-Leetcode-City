"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

// Custom styles for CRT, retro borders, and scanlines
const RETRO_CSS = `
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes crt-glow {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.25; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  @keyframes shake {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(-4px, -2px); }
    30% { transform: translate(4px, 2px); }
    50% { transform: translate(-4px, 4px); }
    70% { transform: translate(4px, -4px); }
    90% { transform: translate(-2px, 2px); }
  }
  .crt-screen {
    position: relative;
    overflow: hidden;
  }
  .crt-screen::before {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    z-index: 10;
    background-size: 100% 4px, 6px 100%;
    pointer-events: none;
  }
  .crt-screen::after {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: rgba(18, 16, 16, 0.1);
    opacity: 0;
    z-index: 11;
    pointer-events: none;
    animation: crt-glow 6s infinite;
  }
  .scanline {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100px;
    background: linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 10%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 90%, rgba(255,255,255,0) 100%);
    opacity: 0.8;
    pointer-events: none;
    z-index: 12;
    animation: scanline 8s linear infinite;
  }
  .pixel-corners {
    clip-path: polygon(
      0px 4px, 4px 4px, 4px 0px, calc(100% - 4px) 0px, calc(100% - 4px) 4px, 100% 4px,
      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0px calc(100% - 4px)
    );
  }
  .shake-anim {
    animation: shake 0.4s ease-in-out;
  }
  .blink-text {
    animation: blink 1s step-end infinite;
  }
`;

// Problems database mapping
interface Problem {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  stars: string;
  description: string;
  defaultCode: string;
  solutionTemplate: string;
  tests: { input: string; output: string }[];
}

const PROBLEMS: Record<string, Problem> = {
  twosum: {
    title: "Two Sum",
    difficulty: "Easy",
    stars: "★☆☆",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    defaultCode: `def twoSum(nums, target):\n    # Write your code here\n    pass`,
    solutionTemplate: `def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []`,
    tests: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0, 1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1, 2]" },
      { input: "nums = [3,3], target = 6", output: "[0, 1]" },
      { input: "nums = [1,5,8,3], target = 11", output: "[2, 3]" },
      { input: "nums = [2,5,5,11], target = 10", output: "[1, 2]" },
    ]
  },
  container: {
    title: "Container With Most Water",
    difficulty: "Medium",
    stars: "★★☆",
    description: "Find two lines that together with the x-axis form a container, such that the container contains the most water.",
    defaultCode: `def maxArea(height):\n    # Write your code here\n    l, r = 0, len(height) - 1\n    res = 0\n    return res`,
    solutionTemplate: `def maxArea(height):\n    l, r = 0, len(height) - 1\n    res = 0\n    while l < r:\n        width = r - l\n        area = min(height[l], height[r]) * width\n        res = max(res, area)\n        if height[l] < height[r]:\n            l += 1\n        else:\n            r -= 1\n    return res`,
    tests: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" },
      { input: "height = [1,1]", output: "1" },
      { input: "height = [4,3,2,1,4]", output: "16" },
      { input: "height = [1,2,1]", output: "2" },
      { input: "height = [2,3,4,5,18,17,6]", output: "17" },
    ]
  }
};

export default function BattlePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Connection State
  const [ideConnected, setIdeConnected] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Battle State
  const [battleType, setBattleType] = useState<"wild" | "gym" | null>(null);
  const [activeProblem, setActiveProblem] = useState<Problem>(PROBLEMS.twosum);
  const [dialogText, setDialogText] = useState("");
  const [dialogFinished, setDialogFinished] = useState(false);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerLives, setPlayerLives] = useState(3);
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [battleState, setBattleState] = useState<"intro" | "player_turn" | "solving" | "animating" | "victory" | "game_over">("intro");
  const [solveMode, setSolveMode] = useState<"idle" | "solving" | "testing" | "submitted">("idle");
  const [testsPassed, setTestsPassed] = useState<number>(0);
  const [testsEvaluated, setTestsEvaluated] = useState<boolean[]>([]);
  const [timerCount, setTimerCount] = useState(600); // 10 minutes

  // Code Editor State
  const [code, setCode] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [showIdePanel, setShowIdePanel] = useState(false);

  // Layout check
  const [isMobile, setIsMobile] = useState(false);

  // Render & Animation Control Refs
  const renderFrameId = useRef<number | null>(null);
  const shakeOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animTime = useRef<number>(0);
  const codeMonsterTextOffset = useRef<number>(0);
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typist effect
  const typeText = useCallback((text: string, onComplete?: () => void) => {
    setDialogFinished(false);
    let current = "";
    let index = 0;
    if (dialogueTimer.current) clearInterval(dialogueTimer.current);

    dialogueTimer.current = setInterval(() => {
      if (index < text.length) {
        current += text[index];
        setDialogText(current);
        index++;
      } else {
        if (dialogueTimer.current) clearInterval(dialogueTimer.current);
        setDialogFinished(true);
        onComplete?.();
      }
    }, 25);
  }, []);

  // Set Mobile Check
  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Timer Tick
  useEffect(() => {
    if (battleState === "solving" || battleState === "player_turn") {
      const timer = setInterval(() => {
        setTimerCount((t) => {
          if (t <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [battleState]);

  const handleTimeout = () => {
    setBattleState("game_over");
    typeText("TIME EXPIRED! Your code lives faded away...", () => {
      setShowIdePanel(false);
    });
  };

  // Start Battle
  const startBattle = (type: "wild" | "gym") => {
    setBattleType(type);
    const prob = type === "wild" ? PROBLEMS.twosum : PROBLEMS.container;
    setActiveProblem(prob);
    setCode(prob.defaultCode);
    setPlayerHp(100);
    setBossHp(100);
    setBossMaxHp(type === "wild" ? 100 : 150);
    setPlayerLives(3);
    setTimerCount(type === "wild" ? 300 : 600); // 5 mins / 10 mins
    setBattleState("intro");
    setSolveMode("idle");
    setTestsPassed(0);
    setTestsEvaluated([]);
    setShowIdePanel(false);

    if (type === "wild") {
      typeText("A wild Code Monster appeared! It's a Level 5 Two Sum (Easy)!", () => {
        setBattleState("player_turn");
      });
    } else {
      typeText("GYM LEADER ADA challenges you! 'Prove your mastery of Arrays!'", () => {
        setBattleState("player_turn");
      });
    }
  };

  // Skip / Run away
  const handleSkip = () => {
    if (battleState !== "player_turn") return;
    setBattleState("intro");
    typeText("Got away safely! (Fled the coding encounter)", () => {
      setBattleType(null);
    });
  };

  // Solve request
  const handleSolve = () => {
    if (battleState !== "player_turn") return;
    if (!ideConnected) {
      setShowConnectModal(true);
      return;
    }
    setBattleState("solving");
    setSolveMode("solving");
    setShowIdePanel(true);
    typeText("IDE connected! Solve the challenge to deal compile-damage.");
  };

  // Trigger test case run
  const runTests = () => {
    setSolveMode("testing");
    setConsoleLogs(["[compiler] Compiling main.py...", "[compiler] Running test cases..."]);

    const timerIdx = [0, 1, 2, 3, 4];
    const results: boolean[] = [];

    // Evaluate code correctness based on if it matches solution length/keywords
    const normalized = code.replace(/\s+/g, "");
    const correctNormalized = activeProblem.solutionTemplate.replace(/\s+/g, "");
    // Check key variables to mock correct vs incorrect solution
    const isCorrect = normalized.includes("seen") || normalized.includes("width=r-l") || normalized === correctNormalized;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < activeProblem.tests.length) {
        const passed = isCorrect || (idx < 3); // mock partially passing if incorrect
        results.push(passed);
        setTestsEvaluated([...results]);
        setConsoleLogs((prev) => [
          ...prev,
          `Test ${idx + 1}: ${passed ? "PASSED ✅" : "FAILED ❌"} (${activeProblem.tests[idx].input})`
        ]);
        if (passed) setTestsPassed((p) => p + 1);
        idx++;
      } else {
        clearInterval(interval);
        evaluateTestResult(results);
      }
    }, 600);
  };

  const evaluateTestResult = (results: boolean[]) => {
    const allPassed = results.every(Boolean);
    setSolveMode("submitted");

    if (allPassed) {
      setBattleState("animating");
      setShowIdePanel(false);
      // Trigger damage shake animation
      shakeOffset.current = { x: 10, y: 5 };
      setTimeout(() => (shakeOffset.current = { x: 0, y: 0 }), 500);

      const damage = activeProblem.difficulty === "Easy" ? 100 : 75;
      setBossHp((h) => {
        const next = Math.max(0, h - damage);
        if (next <= 0) {
          setTimeout(() => triggerVictory(), 600);
        } else {
          setTimeout(() => triggerBossCounterAttack(), 1500);
        }
        return next;
      });

      typeText(`All test cases passed! Code compile deals ${damage} damage to the opponent!`);
    } else {
      // Failed tests, player takes damage
      setBattleState("animating");
      setPlayerHp((h) => {
        const next = Math.max(0, h - 35);
        if (next <= 0) {
          setPlayerLives((l) => {
            const nextL = Math.max(0, l - 1);
            if (nextL <= 0) {
              setTimeout(() => triggerGameOver(), 1000);
            } else {
              // Restore HP but lose life
              setTimeout(() => {
                setPlayerHp(100);
                setBattleState("player_turn");
              }, 1200);
            }
            return nextL;
          });
        } else {
          setTimeout(() => {
            setBattleState("player_turn");
            setSolveMode("solving");
            setShowIdePanel(true);
          }, 2000);
        }
        return next;
      });
      typeText("Test cases failed! Semicolon syntax error causes code feedback damage.");
    }
  };

  const triggerBossCounterAttack = () => {
    typeText(`${battleType === "wild" ? "The Code Monster" : "Leader Ada"} counter-attacks! 'Compilation Refusal!'`, () => {
      // Trigger player damage shake
      shakeOffset.current = { x: -8, y: -6 };
      setTimeout(() => (shakeOffset.current = { x: 0, y: 0 }), 400);

      setPlayerHp((h) => {
        const next = Math.max(0, h - 25);
        if (next <= 0) {
          setPlayerLives((l) => {
            const nextL = Math.max(0, l - 1);
            if (nextL <= 0) {
              setTimeout(() => triggerGameOver(), 1000);
            } else {
              setTimeout(() => {
                setPlayerHp(100);
                setBattleState("player_turn");
              }, 1000);
            }
            return nextL;
          });
        } else {
          setTimeout(() => {
            setBattleState("player_turn");
            setSolveMode("solving");
            setShowIdePanel(true);
          }, 1500);
        }
        return next;
      });
    });
  };

  const triggerVictory = () => {
    setBattleState("victory");
    setShowIdePanel(false);
    if (battleType === "gym") {
      typeText("Gym Leader Ada: 'Incredible! You have mastered Arrays. Take the Linear Badge!'");
    } else {
      typeText("Victory! You defeated the Code Monster, earning +100 XP and +50 PX!");
    }
  };

  const triggerGameOver = () => {
    setBattleState("game_over");
    typeText("Game Over! All daily compiler lives have been lost.");
  };

  // Canvas Drawing loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Shake effect
    ctx.translate(shakeOffset.current.x, shakeOffset.current.y);

    animTime.current += 0.05;

    // 1. Draw Background
    if (battleType === "wild") {
      // Forest path background
      ctx.fillStyle = "#8dc26f"; // Grass green
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Simple road
      ctx.fillStyle = "#d8c39e"; // Sandy path
      ctx.beginPath();
      ctx.moveTo(120, 0);
      ctx.lineTo(280, 0);
      ctx.lineTo(180, canvas.height);
      ctx.lineTo(-50, canvas.height);
      ctx.fill();

      // Trees outline
      ctx.fillStyle = "#2c5421";
      ctx.fillRect(0, 0, 80, 180);
      ctx.fillRect(360, 0, 120, 150);
    } else {
      // Gym battle digital matrix grid
      ctx.fillStyle = "#0c152b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Matrix columns
      ctx.fillStyle = "rgba(40, 100, 200, 0.15)";
      for (let i = 0; i < canvas.width; i += 20) {
        const offset = Math.sin(animTime.current + i) * 10;
        ctx.fillRect(i, 0, 2, canvas.height);
      }
    }

    // 2. Draw Battle Platforms
    // Opponent platform (top right)
    ctx.fillStyle = battleType === "wild" ? "#74a856" : "#1a2c4e";
    ctx.beginPath();
    ctx.ellipse(320, 150, 100, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = battleType === "wild" ? "#4f8433" : "#43649b";
    ctx.stroke();

    // Player platform (bottom left)
    ctx.fillStyle = battleType === "wild" ? "#74a856" : "#1a2c4e";
    ctx.beginPath();
    ctx.ellipse(120, 320, 120, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = battleType === "wild" ? "#4f8433" : "#43649b";
    ctx.stroke();

    // 3. Draw Coder Back (bottom-left)
    ctx.save();
    ctx.translate(120, 290);
    // Idle bounce
    const bounceY = Math.sin(animTime.current * 1.5) * 3;
    ctx.translate(0, bounceY);

    // Cute pixelated back profile of a developer with hoodie
    ctx.fillStyle = "#1e293b"; // Dark hoodie
    ctx.fillRect(-30, -50, 60, 60); // Torso
    ctx.fillStyle = "#38bdf8"; // Stylus / keyboard glow
    ctx.fillRect(15, -30, 10, 25); // Stylus hand

    ctx.fillStyle = "#8a583c"; // Hair brown
    ctx.fillRect(-20, -75, 40, 30); // Head back
    ctx.fillStyle = "#f87171"; // Red Cap back
    ctx.fillRect(-22, -80, 44, 10);
    ctx.restore();

    // 4. Draw Opponent (top-right)
    ctx.save();
    ctx.translate(320, 120);
    ctx.translate(0, -Math.sin(animTime.current * 2) * 4); // Floating bounce

    if (battleState === "intro" || bossHp > 0) {
      if (battleType === "wild") {
        // Neon Code Monster
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 15;

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-45, -55, 90, 85);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.strokeRect(-45, -55, 90, 85);

        // Neon symbols drawing inside the monitor
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText("{ ; }", 0, -25);
        ctx.fillText("[ : ]", 0, 5);
        ctx.fillText("/**\\", 0, 25);
      } else {
        // Gym Leader Ada (in battle stance)
        ctx.fillStyle = "#d946ef"; // Magenta shirt
        ctx.fillRect(-20, -60, 40, 50); // Body
        ctx.fillStyle = "#a855f7"; // Purple hair
        ctx.fillRect(-22, -85, 44, 30); // Hair
        ctx.fillStyle = "#fbcfe8"; // Skin
        ctx.fillRect(-15, -80, 30, 22); // Face
        ctx.fillStyle = "#475569"; // Pants
        ctx.fillRect(-18, -10, 36, 15);
      }
    }
    ctx.restore();

    // 5. Draw Stat Boxes
    // Player Stat Box (bottom right)
    ctx.save();
    ctx.translate(220, 240);
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, 220, 70);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#5a5248";
    ctx.strokeRect(0, 0, 220, 70);

    ctx.fillStyle = "#5a5248";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`CODER @devUser`, 15, 20);
    ctx.fillText(`Lv.8`, 180, 20);

    // HP bar label
    ctx.fillText(`HP`, 15, 40);

    // HP Bar background
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(40, 30, 160, 12);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(40, 30, 160, 12);

    // HP Bar fill
    const hpPct = playerHp / 100;
    ctx.fillStyle = hpPct > 0.5 ? "#22c55e" : hpPct > 0.2 ? "#eab308" : "#ef4444";
    ctx.fillRect(41, 31, Math.max(0, 158 * hpPct), 10);

    ctx.fillStyle = "#5a5248";
    ctx.fillText(`${playerHp}/100`, 160, 55);

    // Heart lives icons
    for (let i = 0; i < playerLives; i++) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("❤️", 15 + i * 15, 58);
    }
    ctx.restore();

    // Opponent Stat Box (top left)
    ctx.save();
    ctx.translate(15, 20);
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, 230, 75);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#5a5248";
    ctx.strokeRect(0, 0, 230, 75);

    ctx.fillStyle = "#5a5248";
    ctx.font = "bold 9px monospace";
    if (battleType === "wild") {
      ctx.fillText("WILD CODE MONSTER", 15, 20);
      ctx.fillText("Lv.5", 190, 20);
      ctx.fillText(`Two Sum (Easy ★☆☆)`, 15, 33);
    } else {
      ctx.fillText("GYM LEADER ADA", 15, 20);
      ctx.fillText("Lv.12", 190, 20);
      ctx.fillText(`Container Water (Medium ★★☆)`, 15, 33);
    }

    // HP Bar label
    ctx.fillText("HP", 15, 52);

    // HP Bar
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(40, 42, 170, 12);
    ctx.strokeRect(40, 42, 170, 12);

    const bHpPct = bossHp / bossMaxHp;
    ctx.fillStyle = bHpPct > 0.5 ? "#22c55e" : bHpPct > 0.2 ? "#eab308" : "#ef4444";
    ctx.fillRect(41, 43, Math.max(0, 168 * bHpPct), 10);

    ctx.fillStyle = "#5a5248";
    ctx.fillText(`${bossHp}/${bossMaxHp}`, 160, 68);
    ctx.restore();

    // 6. Victory badge draw (if victory and gym)
    if (battleState === "victory" && battleType === "gym") {
      // Golden overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(240, 200);

      // Rotating glow effect
      ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Draw glowing green hexagonal badge (Linear Badge)
      ctx.fillStyle = "#22c55e"; // Glowing green
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + animTime.current * 0.5;
        const x = Math.cos(angle) * 50;
        const y = Math.sin(angle) * 50;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.stroke();

      // List symbol inside the badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("[ = ]", 0, 8);

      ctx.restore();
    }

    ctx.restore();

    renderFrameId.current = requestAnimationFrame(drawCanvas);
  }, [battleType, playerHp, bossHp, battleState, playerLives]);

  // Start rendering loop when battle is active
  useEffect(() => {
    if (battleType) {
      renderFrameId.current = requestAnimationFrame(drawCanvas);
    }
    return () => {
      if (renderFrameId.current) cancelAnimationFrame(renderFrameId.current);
    };
  }, [battleType, drawCanvas]);

  // Format countdown timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0a1a] font-pixel text-cream p-4 relative flex flex-col items-center justify-center crt-screen">
      <style dangerouslySetInnerHTML={{ __html: RETRO_CSS }} />
      <div className="scanline" />

      {/* Main Container */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-4 items-stretch z-10">

        {/* MOCK IDE PANEL (Slides in from the left) */}
        {showIdePanel && (
          <div className="w-full lg:w-1/2 flex flex-col border-[4px] border-[#334155] bg-[#0f172a] pixel-corners overflow-hidden">
            {/* VS Code title bar */}
            <div className="bg-[#1e293b] px-3 py-2 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                <span className="h-3 w-3 rounded-full bg-[#eab308]" />
                <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                <span className="ml-3 text-[9px] text-[#94a3b8] tracking-widest uppercase">
                  leetcode-city-terminal — main.py
                </span>
              </div>
              <div className="text-[10px] text-lime animate-pulse font-bold">
                IDE LINKED
              </div>
            </div>

            {/* Main Code Editor */}
            <div className="flex-1 flex flex-col p-4 bg-[#090d16]">
              {/* Question description */}
              <div className="bg-[#0f172a] border border-slate-800 p-3 mb-3 text-[9px] leading-relaxed text-[#94a3b8] normal-case">
                <span className="text-[#38bdf8] font-bold text-[10px] block mb-1">
                  {activeProblem.title} ({activeProblem.difficulty})
                </span>
                {activeProblem.description}
              </div>

              {/* Code TextArea */}
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 min-h-[180px] p-3 bg-[#0d1321] border border-slate-800 text-[10px] text-[#38bdf8] font-mono outline-none focus:border-[#38bdf8] resize-none leading-relaxed normal-case"
                spellCheck="false"
              />

              {/* Output Panel / Console */}
              <div className="mt-3 bg-[#080b11] border border-slate-900 p-3 h-28 overflow-y-auto font-mono text-[9px] text-slate-400">
                <div className="text-slate-500 border-b border-slate-900 pb-1 mb-1 font-bold">
                  CONSOLE OUTPUT
                </div>
                {consoleLogs.map((log, i) => (
                  <div key={i} className="mb-0.5 leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Test validation box */}
            <div className="bg-[#1e293b] p-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-[9px] text-slate-400">
                Tests Passed: <span className="text-white font-bold">{testsPassed} / {activeProblem.tests.length}</span>
                <div className="flex gap-1 mt-1">
                  {activeProblem.tests.map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-5 border ${
                        testsEvaluated[i] === true
                          ? "bg-lime border-lime"
                          : testsEvaluated[i] === false
                          ? "bg-rose border-rose"
                          : "bg-slate-700 border-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={runTests}
                  disabled={solveMode === "testing"}
                  className="px-4 py-2 text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-bold border-2 border-sky-800 disabled:opacity-50 btn-press uppercase"
                >
                  {solveMode === "testing" ? "Testing..." : "Submit Code"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2D CANVAS BATTLE VIEW SCREEN */}
        {battleType ? (
          <div className="flex-1 flex flex-col border-[4px] border-[#5a5248] bg-bg p-2 sm:p-4 pixel-corners">
            {/* Scene Canvas wrapper */}
            <div className="relative border-2 border-[#5a5248] bg-black flex justify-center items-center">
              <canvas
                ref={canvasRef}
                width={480}
                height={360}
                className="w-full aspect-[4/3] block"
                style={{ imageRendering: "pixelated" }}
              />

              {/* CRT overlay line */}
              <div className="absolute top-2 right-3 text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 uppercase z-20">
                LIVE CHALLENGE
              </div>
            </div>

            {/* Bottom dialogue / controls box */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 border-[3px] border-[#5a5248] bg-[#fdfbf7] p-3 text-[#5a5248]">
              {/* Typewriter dialogue */}
              <div className="md:col-span-2 text-[10px] sm:text-[11px] leading-relaxed border-r-0 md:border-r-2 border-[#5a5248] pr-2 min-h-[45px] select-none uppercase">
                {dialogText}
                {dialogFinished && <span className="blink-text font-bold ml-1">▼</span>}
              </div>

              {/* Action Buttons options */}
              <div className="grid grid-cols-2 gap-1.5 text-center">
                {battleState === "player_turn" ? (
                  <>
                    <button
                      onClick={handleSolve}
                      className="border-2 border-[#5a5248] py-1.5 text-[10px] font-bold bg-[#ffa116] hover:bg-[#e08c00] hover:text-white transition-colors uppercase"
                    >
                      SOLVE
                    </button>
                    <button
                      onClick={() => {
                        typeText("HINT: Remember to use two-pointer technique or check the indices dictionary map for difference values!");
                      }}
                      className="border-2 border-[#5a5248] py-1.5 text-[10px] font-bold hover:bg-[#e2e8f0] transition-colors uppercase"
                    >
                      HINT
                    </button>
                    <button
                      onClick={handleSkip}
                      className="border-2 border-[#5a5248] py-1.5 text-[10px] font-bold hover:bg-[#e2e8f0] transition-colors uppercase"
                    >
                      SKIP
                    </button>
                    <button
                      onClick={() => {
                        typeText(`INFO: Target sum needs to fit array elements. Limit: ${formatTime(timerCount)} left.`);
                      }}
                      className="border-2 border-[#5a5248] py-1.5 text-[10px] font-bold hover:bg-[#e2e8f0] transition-colors uppercase"
                    >
                      INFO
                    </button>
                  </>
                ) : battleState === "victory" || battleState === "game_over" ? (
                  <button
                    onClick={() => setBattleType(null)}
                    className="col-span-2 border-2 border-[#5a5248] py-2 text-[10px] font-bold bg-lime-600 text-white hover:bg-lime-500 transition-colors uppercase"
                  >
                    CONTINUE
                  </button>
                ) : (
                  <div className="col-span-2 flex items-center justify-center text-[10px] text-muted-foreground animate-pulse">
                    WAITING...
                  </div>
                )}
              </div>
            </div>

            {/* Countdown / HUD details */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex gap-2">
                <span>Timer: <span className="text-white font-bold">{formatTime(timerCount)}</span></span>
                <span>•</span>
                <span>Type: <span className="text-white font-bold">{battleType === "wild" ? "Wild Encounter" : "Gym Battle"}</span></span>
              </div>
              <button
                onClick={() => {
                  setBattleState("intro");
                  typeText("Forfeited challenge!", () => setBattleType(null));
                }}
                className="hover:text-red-500 font-bold uppercase"
              >
                [ FORFEIT ]
              </button>
            </div>
          </div>
        ) : (
          /* LEVEL / SELECTION MODE SCREEN */
          <div className="w-full max-w-md mx-auto border-[4px] border-[#5a5248] bg-[#fdfbf7] p-5 sm:p-8 pixel-corners text-[#5a5248]">
            <h1 className="text-center text-sm font-bold tracking-widest text-[#3b82f6] uppercase">
              🏆 BATTLE CONTROLLER
            </h1>
            <p className="mt-2 text-center text-[9px] text-[#8a8278] tracking-wide uppercase">
              Select Encounter Biome / Challenge Type
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => startBattle("wild")}
                className="w-full py-3 text-[10px] font-bold tracking-widest bg-lime-600 hover:bg-lime-500 text-white border-[3px] border-lime-800 pixel-corners uppercase transition-all"
              >
                🌿 Enter Tall Grass (Wild Challenge)
              </button>

              <button
                onClick={() => startBattle("gym")}
                className="w-full py-3 text-[10px] font-bold tracking-widest bg-purple-600 hover:bg-purple-500 text-white border-[3px] border-purple-800 pixel-corners uppercase transition-all"
              >
                🏛 Challenge Gym Leader Ada
              </button>

              {/* IDE connection toggler bar */}
              <div className="mt-4 p-3 bg-white border-2 border-slate-300 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500">
                  IDE LINKING STATUS:
                </span>
                <button
                  onClick={() => setIdeConnected(!ideConnected)}
                  className={`px-3 py-1 text-[8px] font-bold border-2 rounded ${
                    ideConnected
                      ? "bg-lime-100 border-lime-600 text-lime-700"
                      : "bg-rose-100 border-rose-600 text-rose-700"
                  }`}
                >
                  {ideConnected ? "CONNECTED" : "DISCONNECTED"}
                </button>
              </div>

              {/* Back to main arcade button */}
              <button
                onClick={() => router.push("/arcade")}
                className="mt-4 text-center text-[9px] text-slate-400 hover:text-slate-600 uppercase"
              >
                &larr; Return to Arcade Browser
              </button>
            </div>
          </div>
        )}

      </div>

      {/* POPUP: IDE NOT CONNECTED DIALOG BOX */}
      {showConnectModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-[99]">
          <div className="w-full max-w-sm border-[4px] border-[#5a5248] bg-[#fdfbf7] p-5 sm:p-6 pixel-corners text-[#5a5248] relative">
            <button
              onClick={() => setShowConnectModal(false)}
              className="absolute top-2 right-3 text-sm font-bold text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
            <h3 className="text-[11px] font-bold text-red-600 tracking-wider mb-2 uppercase">
              🔌 Local IDE Not Connected
            </h3>
            <p className="text-[9px] text-[#8a8278] leading-relaxed mb-4 uppercase">
              Please connect your local editor (VS Code or Cursor) to sync your algorithms code with LeetCode City.
            </p>

            <div className="bg-white border-2 border-slate-300 p-2.5 mb-4 text-center font-mono text-[9px] break-all">
              leetcode-city-token-93f4a8b7c2d1
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText("npx leetcode-city connect leetcode-city-token-93f4a8b7c2d1");
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="flex-1 py-2 text-[8px] bg-slate-200 border-2 border-slate-400 font-bold hover:bg-slate-300 uppercase"
              >
                {copiedToken ? "COPIED!" : "COPY CONNECT COMMAND"}
              </button>
              <button
                onClick={() => {
                  setIdeConnected(true);
                  setShowConnectModal(false);
                  handleSolve();
                }}
                className="py-2 px-4 text-[8px] bg-lime-600 text-white font-bold border-2 border-lime-800 hover:bg-lime-500 uppercase"
              >
                MOCK CONNECT
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
