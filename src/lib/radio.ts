/**
 * In-game radio module.
 * Manages the state of the in-game radio player: track list, volume,
 * shuffle, and persistence via localStorage.
 */

/** A single radio track available in the in-game radio. */
export interface Track {
  /** Unique identifier for the track. */
  id: string;
  /** Display title of the track. */
  title: string;
  /** Public path to the audio file. */
  src: string;
}

/** All tracks available in the in-game radio. */
export const TRACKS: Track[] = [
  { id: "midnight-commit", title: "Midnight Commit", src: "/audio/midnight-commit.mp3" },
  { id: "push-to-prod", title: "Push to Prod", src: "/audio/push-to-prod.mp3" },
  { id: "merge-conflict", title: "Merge Conflict", src: "/audio/merge-conflict.mp3" },
  { id: "refactor-rain", title: "Refactor Rain", src: "/audio/refactor-rain.mp3" },
];

/**
 * Represents the current state of the in-game radio player.
 */
export interface RadioState {
  /** Audio volume in the range [0, 1]. */
  volume: number;
  /** Index of the currently selected track in {@link TRACKS}. */
  trackIndex: number;
  /** Whether shuffle mode is enabled. */
  shuffle: boolean;
}

const STORAGE_KEY = "gc_radio";

/** Default radio state used when no saved state exists. */
const DEFAULT_STATE: RadioState = { volume: 0.15, trackIndex: 0, shuffle: false };

/**
 * Load the saved radio state from localStorage.
 * Safe to call on the server (returns `DEFAULT_STATE` in SSR contexts).
 *
 * @returns The saved {@link RadioState}, or `DEFAULT_STATE` if none is saved
 *          or if parsing fails.
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
 * Persist a partial radio state update to localStorage.
 * Merges with the existing saved state (only updates the provided keys).
 * Safe to call on the server (no-ops in SSR contexts).
 *
 * @param state - A partial {@link RadioState} containing only the fields to update.
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
