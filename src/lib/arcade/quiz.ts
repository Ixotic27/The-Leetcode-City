// ─── LeetCode quiz question bank (town mini-game) ─────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explain: string;
}

export const LEETCODE_QUIZ: QuizQuestion[] = [
  {
    question: "What is the time complexity of binary search on a sorted array?",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    answerIndex: 1,
    explain: "Binary search halves the search space every step, so it runs in O(log n).",
  },
  {
    question: "Which data structure is FIFO (First-In, First-Out)?",
    options: ["Stack", "Queue", "Tree", "Hash Map"],
    answerIndex: 1,
    explain: "A queue processes elements in the order they were added — FIFO.",
  },
  {
    question: "On LeetCode, 'Two Sum' is rated at which difficulty?",
    options: ["Easy", "Medium", "Hard", "Contest only"],
    answerIndex: 0,
    explain: "Two Sum is the classic Easy warm-up problem.",
  },
  {
    question: "Which of these is NOT a sorting algorithm?",
    options: ["Quick sort", "Merge sort", "Linear scan", "Heap sort"],
    answerIndex: 2,
    explain: "A linear scan is just a traversal — not a sorting algorithm.",
  },
  {
    question: "Big-O notation describes…",
    options: [
      "Exact runtime in milliseconds",
      "Growth rate as input size increases",
      "Memory used by the compiler",
      "Number of test cases",
    ],
    answerIndex: 1,
    explain: "Big-O measures how runtime/memory grows with input size.",
  },
  {
    question: "Which data structure is LIFO (Last-In, First-Out)?",
    options: ["Queue", "Deque", "Stack", "Priority Queue"],
    answerIndex: 2,
    explain: "A stack pops the most recently pushed element — LIFO.",
  },
  {
    question: "The classic approach for 'Longest Increasing Subsequence' is…",
    options: ["Greedy only", "Dynamic Programming", "Binary search only", "Brute-force always"],
    answerIndex: 1,
    explain: "LIS is a textbook dynamic programming problem (with an O(n log n) twist).",
  },
  {
    question: "Why is appending to a dynamic array amortized O(1)?",
    options: [
      "Arrays never grow",
      "Doubling amortizes occasional copies across many appends",
      "The CPU caches everything",
      "It is actually always O(n)",
    ],
    answerIndex: 1,
    explain: "Doubling the capacity makes rare resizes cheap on average — amortized O(1).",
  },
];

/** Pick `count` random questions (defaults to 5). */
export function pickQuizQuestions(count = 5): QuizQuestion[] {
  const pool = [...LEETCODE_QUIZ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Fun rank based on score out of total. */
export function quizRank(score: number, total: number): { title: string; color: string } {
  const pct = total === 0 ? 0 : score / total;
  if (pct === 1) return { title: "CODE GRANDMASTER", color: "var(--color-lime)" };
  if (pct >= 0.8) return { title: "ALGORITHM ELITE", color: "var(--color-lime)" };
  if (pct >= 0.6) return { title: "DATA STRUCTURE CHAMPION", color: "var(--color-cream)" };
  if (pct >= 0.4) return { title: "SIGNALING FOREST WALKER", color: "var(--color-cream-dark)" };
  return { title: "STILL COMPILING…", color: "var(--color-dim)" };
}
