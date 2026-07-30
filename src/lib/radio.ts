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

    // Validate volume: must be a finite number in [0, 1]
    const volume =
      typeof parsed.volume === "number" &&
      Number.isFinite(parsed.volume) &&
      parsed.volume >= 0 &&
      parsed.volume <= 1
        ? parsed.volume
        : DEFAULT_STATE.volume;

    // Validate trackIndex: must be a non-negative integer within track bounds
    const trackIndex =
      typeof parsed.trackIndex === "number" &&
      Number.isInteger(parsed.trackIndex) &&
      parsed.trackIndex >= 0 &&
      parsed.trackIndex < TRACKS.length
        ? parsed.trackIndex
        : DEFAULT_STATE.trackIndex;

    // Validate shuffle: must be a boolean
    const shuffle =
      typeof parsed.shuffle === "boolean" ? parsed.shuffle : DEFAULT_STATE.shuffle;

    return { volume, trackIndex, shuffle };
  } catch (err) {
    console.warn("[radio.ts] failed to load saved radio state:", err);
    return DEFAULT_STATE;
  }
}

export function saveRadioState(state: Partial<RadioState>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRadioState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch (err) {
    console.warn("[radio.ts] failed to save radio state:", err);
  }
}
