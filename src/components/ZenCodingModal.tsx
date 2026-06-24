"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const ACCENT = "#ec4899";

const SOUNDS = [
  { id: "rain", label: "Rain" },
  { id: "forest", label: "Forest" },
  { id: "lofi", label: "Lofi" },
] as const;

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

export default function ZenCodingModal({ onClose }: { onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState(POMODORO_WORK);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            if (isBreak) {
              setIsBreak(false);
              return POMODORO_WORK;
            } else {
              setIsBreak(true);
              return POMODORO_BREAK;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, isBreak, clearTimer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (activeSound) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(`/audio/${activeSound}.mp3`);
      audio.loop = true;
      audio.volume = 0.3;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [activeSound]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleTimer = () => setIsRunning((p) => !p);

  const resetTimer = () => {
    clearTimer();
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(POMODORO_WORK);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#0a0818" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-8 font-pixel">
        <h2 className="text-lg tracking-widest uppercase" style={{ color: ACCENT }}>
          Zen Coding Mode
        </h2>
        <p className="text-[10px] text-gray-500 -mt-4">SkyTemple · Focus Timer</p>

        <div
          className="relative flex items-center justify-center w-56 h-56 rounded-full border-4"
          style={{
            borderColor: ACCENT,
            boxShadow: `0 0 40px ${ACCENT}44`,
          }}
        >
          <span className="text-5xl tracking-widest" style={{ color: ACCENT }}>
            {formatTime(timeLeft)}
          </span>
          <span
            className="absolute bottom-8 text-[9px] uppercase tracking-widest"
            style={{ color: "#888" }}
          >
            {isBreak ? "Break" : "Focus"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTimer}
            className="px-6 py-2 text-[11px] uppercase tracking-widest border-2 transition-colors hover:brightness-125"
            style={{
              borderColor: ACCENT,
              color: ACCENT,
              backgroundColor: `${ACCENT}11`,
            }}
          >
            {isRunning ? "Pause" : "Start"}
          </button>
          <button
            onClick={resetTimer}
            className="px-4 py-2 text-[10px] uppercase tracking-widest border border-gray-700 text-gray-400 transition-colors hover:text-gray-200"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-500">Ambient</p>
          <div className="flex items-center gap-3">
            {SOUNDS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSound(activeSound === s.id ? null : s.id)}
                className="px-3 py-1.5 text-[10px] uppercase tracking-wider border-2 transition-colors"
                style={{
                  borderColor: activeSound === s.id ? ACCENT : "#333",
                  color: activeSound === s.id ? ACCENT : "#888",
                  backgroundColor: activeSound === s.id ? `${ACCENT}11` : "transparent",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[8px] text-gray-600 tracking-wider">ESC TO CLOSE</p>
      </div>
    </div>
  );
}
