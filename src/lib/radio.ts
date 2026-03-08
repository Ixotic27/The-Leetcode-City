export interface Track {
  id: string;
  title: string;
  src: string;
}

export const TRACKS: Track[] = [
  { id: "midnight-commit", title: "Midnight Commit", src: "/audio/midnight-commit.mp3" },
  { id: "push-to-prod", title: "Push to Prod", src: "/audio/push-to-prod.mp3" },
  { id: "merge-conflict", title: "Merge Conflict", src: "/audio/merge-conflict.mp3" },
  { id: "refactor-rain", title: "Refactor Rain", src: "/audio/refactor-rain.mp3" },
];

export interface RadioState {
  volume: number;
  trackIndex: number;
  shuffle: boolean;
}

const STORAGE_KEY = "gc_radio";

const DEFAULT_STATE: RadioState = { volume: 0.15, trackIndex: 0, shuffle: false };

export function loadRadioState(): RadioState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveRadioState(state: Partial<RadioState>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRadioState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {}
}
