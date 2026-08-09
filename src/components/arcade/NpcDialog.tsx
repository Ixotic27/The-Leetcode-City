"use client";

import { useEffect, useState, useCallback } from "react";

export interface NpcDialogData {
  id?: string;
  label?: string;
  dialogue?: string[];
  quiz?: string;
}

interface NpcDialogProps {
  npc: NpcDialogData;
  isMobile: boolean;
  onClose: () => void;
  onStartQuiz?: (quiz: string) => void;
}

/**
 * Pixel-style dialogue window for interactive town NPCs.
 * Shows dialogue lines one at a time; [E]/[Space]/[Enter] advances,
 * [Escape] closes. If the NPC has a quiz attached, the last line
 * offers a "START CHALLENGE" action instead of a plain DONE button.
 */
export default function NpcDialog({
  npc,
  isMobile,
  onClose,
  onStartQuiz,
}: NpcDialogProps) {
  const lines = npc.dialogue?.length ? npc.dialogue : ["..."];
  const [idx, setIdx] = useState(0);
  const isLast = idx >= lines.length - 1;

  const advance = useCallback(() => {
    if (!isLast) {
      setIdx((i) => i + 1);
    } else if (npc.quiz && onStartQuiz) {
      onStartQuiz(npc.quiz);
    } else {
      onClose();
    }
  }, [isLast, npc.quiz, onStartQuiz, onClose]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (
        e.key === "e" ||
        e.key === "E" ||
        e.key === " " ||
        e.code === "Space" ||
        e.key === "Enter"
      ) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, close]);

  return (
    <div
      className="absolute inset-0 z-[58] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(10, 10, 26, 0.55)" }}
      onClick={close}
    >
      <div
        className="w-full sm:w-[440px] sm:rounded-[8px] overflow-hidden pixel-shadow"
        style={{
          background: "linear-gradient(180deg, #e8e4df 0%, #d8d4cf 100%)",
          maxWidth: isMobile ? undefined : 440,
          border: "1px solid #0a0a1a",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — NPC name */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{ background: "#0a0a1a" }}
        >
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-lime">
            {npc.label ?? "Villager"}
          </p>
          <span className="text-[9px] text-dim tracking-widest uppercase">
            {idx + 1}/{lines.length}
          </span>
        </div>

        {/* Body — current dialogue line */}
        <div className="px-4 py-5 min-h-[72px]">
          <p key={idx} className="text-[12px] leading-relaxed text-[#3a332b]">
            {lines[idx]}
          </p>
        </div>

        {/* Footer — action */}
        <div className="px-4 pb-4 flex justify-end">
          {isLast && npc.quiz && onStartQuiz ? (
            <button
              onClick={advance}
              className="cursor-pointer rounded-[3px] px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-all hover:brightness-110 btn-press"
              style={{
                background: "linear-gradient(180deg, #ffa116, #cc8111)",
                color: "#0d0d0f",
                boxShadow: "3px 3px 0 0 rgba(0,0,0,0.35)",
              }}
            >
              ▶ Start Challenge
            </button>
          ) : (
            <button
              onClick={advance}
              className="cursor-pointer rounded-[3px] px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-all hover:brightness-95 btn-press"
              style={{
                background: "linear-gradient(180deg, #c0b8ac, #b0a89c)",
                color: "#3a332b",
                boxShadow: "3px 3px 0 0 rgba(0,0,0,0.35)",
              }}
            >
              {isLast ? "Done" : "Next"}
            </button>
          )}
        </div>

        {/* Hint */}
        <div className="px-4 pb-2 text-right">
          <span className="text-[8px] text-[#8a8278] tracking-wider uppercase">
            [E] next · [ESC] leave
          </span>
        </div>
      </div>
    </div>
  );
}
