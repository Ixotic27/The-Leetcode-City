import * as crypto from "crypto";
import { getConfig } from "../config";
import { getKey } from "../auth/keystore";

export interface SubmitPayload {
  challenge_id: string | null;
  problem_id: string;
  language: string;
  code: string;
  status: "accepted" | "wrong_answer" | "tle" | "rte";
  tests_passed: number;
  tests_total: number;
  execution_time_ms: number;
}

export interface SubmitResponse {
  status: string;
  submission_status: string;
  is_first_solve: boolean;
  rewards: {
    points: number;
    xp: number;
  };
  dropped_items: Array<{
    id: string;
    name: string;
    slug: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    item_type: string;
    icon_path: string;
  }>;
}

export async function submitSolution(payload: SubmitPayload): Promise<SubmitResponse> {
  const { apiUrl } = getConfig();
  const apiKey = await getKey();
  
  if (!apiKey) {
    throw new Error("Pulse key not found. Please connect your extension to LeetCode City first.");
  }

  // Calculate SHA256 of the code
  const codeHash = crypto
    .createHash("sha256")
    .update(payload.code)
    .digest("hex");

  const fullPayload = {
    ...payload,
    code_hash: codeHash
  };

  const res = await (globalThis as any).fetch(`${apiUrl}/api/arena/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(fullPayload)
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP error ${res.status}`);
  }

  return await res.json() as SubmitResponse;
}
