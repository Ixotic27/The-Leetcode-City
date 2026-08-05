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

/**
 * Loads the saved radio state from localStorage.
 *
 * If localStorage is unavailable or contains invalid data,
 * the default radio state is returned.
 *
 * @returns The saved or default radio state.
 */
export function loadRadioState(): RadioState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    console.warn("[radio.ts] failed to load saved radio state:", err);
    return DEFAULT_STATE;
  }
}

/**
 * Saves radio state properties to localStorage.
 *
 * Existing radio state is preserved, and only the provided
 * properties are updated.
 *
 * @param state - The radio state properties to save.
 */
export function saveRadioState(state: Partial<RadioState>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRadioState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch (err) {
    console.warn("[radio.ts] failed to save radio state:", err);
  }
}
