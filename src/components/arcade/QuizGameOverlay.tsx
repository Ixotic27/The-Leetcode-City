"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  pickQuizQuestions,
  quizRank,
  type QuizQuestion,
} from "@/lib/arcade/quiz";

type QuizState = "intro" | "question" | "result";

interface QuizGameOverlayProps {
  onClose: () => void;
  isMobile: boolean;
}

/**
 * LeetCode quiz mini-game — opened by the Quiz Master NPC in Ixotopia.
 * Presents 5 random questions, gives instant feedback + explanation, and
 * crowns the player with a rank based on their score.
 */
export default function QuizGameOverlay({
  onClose,
  isMobile,
}: QuizGameOverlayProps) {
  const [state, setState] = useState<QuizState>("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    pickQuizQuestions(5),
  );
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(-1);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  const stateRef = useRef<QuizState>("intro");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const current = questions[qIdx];
  const isLast = qIdx >= questions.length - 1;

  // Keep the latest handlers in refs so the window keydown listener (which is
  // registered once) never calls a stale closure across question changes.
  const pickRef = useRef<(i: number) => void>(() => {});
  const nextRef = useRef<() => void>(() => {});

  const resetGame = useCallback(() => {
    setQuestions(pickQuizQuestions(5));
    setQIdx(0);
    setSelected(-1);
    setAnswered(false);
    setScore(0);
    stateRef.current = "question";
    setState("question");
  }, []);

  const doStart = () => {
    stateRef.current = "question";
    setState("question");
  };

  const pick = (i: number) => {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    if (i === current.answerIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (!answered) return;
    if (isLast) {
      stateRef.current = "result";
      setState("result");
    } else {
      setQIdx((i) => i + 1);
      setSelected(-1);
      setAnswered(false);
    }
  };

  // Refresh the refs every render so the single keydown listener always sees
  // the latest handlers (avoids stale closures between questions).
  pickRef.current = pick;
  nextRef.current = next;

  const doClose = () => {
    onCloseRef.current();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        doClose();
        return;
      }
      const s = stateRef.current;
      if (s === "intro") {
        if (e.key === " " || e.code === "Space" || e.key === "Enter") {
          e.preventDefault();
          doStart();
        }
        return;
      }
      if (s === "question") {
        // 1-4 quick-select options, Enter/Space to advance after answering
        if (["1", "2", "3", "4"].includes(e.key)) {
          pickRef.current(Number(e.key) - 1);
        } else if (e.key === "Enter" || e.key === " " || e.code === "Space") {
          e.preventDefault();
          nextRef.current();
        }
        return;
      }
      // result — Enter/Space retry, Esc close (handled above)
      if (s === "result" && (e.key === " " || e.code === "Space" || e.key === "Enter")) {
        e.preventDefault();
        resetGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const rank = quizRank(score, questions.length);

  return (
    <div className="absolute inset-0 z-[59] flex items-center justify-center bg-black/90">
      <div className="flex flex-col items-center justify-center w-full h-full px-6 py-8">
        {/* ═══ INTRO ═══ */}
        {state === "intro" && (
          <div className="flex flex-col items-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5 text-dim">
              IXOTOPIA CHALLENGE
            </p>
            <h1 className="text-[28px] sm:text-[40px] font-bold text-cream text-center leading-none mb-1">
              LEETCODE
            </h1>
            <h2 className="text-[18px] sm:text-[24px] font-bold tracking-[0.15em] text-lime mb-8">
              QUIZ
            </h2>
            <p className="text-[11px] text-muted text-center leading-relaxed mb-10 max-w-[280px]">
              {questions.length} questions on algorithms, data structures and
              LeetCode lore. Answer fast, earn your rank!
            </p>
            <button onClick={doStart} className="cursor-pointer animate-pulse" style={{ background: "none", border: "none" }}>
              <span className="text-[16px] tracking-[0.1em] text-lime font-bold">
                {isMobile ? "TAP TO START" : "PRESS SPACE"}
              </span>
            </button>
          </div>
        )}

        {/* ═══ QUESTION ═══ */}
        {state === "question" && current && (
          <div className="flex flex-col items-center w-full max-w-[460px]">
            {/* Progress */}
            <div className="w-full flex items-center justify-between mb-5">
              <span className="text-[9px] tracking-[0.2em] uppercase text-dim">
                QUESTION {qIdx + 1}/{questions.length}
              </span>
              <span className="text-[9px] tracking-[0.2em] uppercase text-lime">
                SCORE {score}
              </span>
            </div>
            <div className="w-full h-[4px] bg-border mb-6">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${((qIdx + (answered ? 1 : 0)) / questions.length) * 100}%`, background: "var(--color-lime)" }}
              />
            </div>

            <p className="text-[15px] sm:text-[17px] font-bold text-cream text-center leading-relaxed mb-6 min-h-[64px]">
              {current.question}
            </p>

            <div className="w-full flex flex-col gap-2 mb-5">
              {current.options.map((opt, i) => {
                const isAnswer = i === current.answerIndex;
                const isPicked = i === selected;
                let bg = "var(--color-bg-raised)";
                let border = "var(--color-border)";
                let color = "var(--color-warm)";
                if (answered) {
                  if (isAnswer) {
                    bg = "rgba(255,161,22,0.15)";
                    border = "var(--color-lime)";
                    color = "var(--color-lime)";
                  } else if (isPicked) {
                    bg = "rgba(200,80,80,0.12)";
                    border = "#c85050";
                    color = "#c85050";
                  } else {
                    color = "var(--color-dim)";
                  }
                } else if (isPicked) {
                  border = "var(--color-lime)";
                }
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={answered}
                    className="cursor-pointer w-full text-left rounded-[3px] px-3 py-2.5 text-[12px] transition-all hover:brightness-125 disabled:cursor-default flex items-center gap-3 border"
                    style={{ background: bg, borderColor: border, color }}
                  >
                    <span className="text-[10px] font-bold opacity-70">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1">{opt}</span>
                    {answered && isAnswer && <span className="text-lime">✓</span>}
                    {answered && isPicked && !isAnswer && <span className="text-[#c85050]">✗</span>}
                  </button>
                );
              })}
            </div>

            {answered && (
              <p className="text-[11px] text-muted text-center leading-relaxed mb-5">
                {current.explain}
              </p>
            )}

            <button
              onClick={next}
              disabled={!answered}
              className="cursor-pointer rounded-[3px] px-6 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:brightness-110 btn-press disabled:opacity-30 disabled:cursor-default"
              style={{
                background: "linear-gradient(180deg, #ffa116, #cc8111)",
                color: "#0d0d0f",
                boxShadow: "3px 3px 0 0 rgba(0,0,0,0.4)",
              }}
            >
              {isLast ? "See Results" : "Next Question"}
            </button>
          </div>
        )}

        {/* ═══ RESULT ═══ */}
        {state === "result" && (
          <div className="flex flex-col items-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-6 text-dim">
              QUIZ COMPLETE
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[56px] sm:text-[72px] font-bold text-lime leading-none">
                {score}
              </span>
              <span className="text-[20px] font-bold text-dim">
                / {questions.length}
              </span>
            </div>
            <p
              className="text-[14px] sm:text-[16px] font-bold tracking-[0.2em] uppercase mb-8"
              style={{ color: rank.color }}
            >
              {rank.title}
            </p>

            <div className="flex flex-col items-center gap-3">
              <button onClick={resetGame} className="cursor-pointer animate-pulse" style={{ background: "none", border: "none" }}>
                <span className="text-[14px] tracking-[0.1em] text-lime font-bold">
                  {isMobile ? "TAP TO RETRY" : "SPACE  RETRY"}
                </span>
              </button>
              <button onClick={doClose} className="cursor-pointer" style={{ background: "none", border: "none" }}>
                <span className="text-[11px] tracking-[0.1em] text-dim">
                  {isMobile ? "CLOSE" : "ESC  EXIT"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
