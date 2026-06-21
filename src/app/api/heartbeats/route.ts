import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, broadcastToChannel } from "@/lib/supabase";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ── Validation ──────────────────────────────────────────────────────────────

const MAX_STRING = 64;
const MAX_PROJECT = 128;
const MAX_SESSION_ID = 128;
const MAX_ACTIVE_SECONDS = 3600;
const ALLOWED_EDITORS = new Set(["vscode", "cursor", "vscodium", "windsurf", "positron"]);
const ALLOWED_OS = new Set(["darwin", "linux", "win32", "freebsd", "openbsd"]);
const ALLOWED_STATUS = new Set(["active", "offline"]);

interface ValidHeartbeat {
  language?: string;
  project?: string;
  isWrite: boolean;
  activeSeconds: number;
  sessionId: string;
  editorName: string;
  os?: string;
  status?: "active" | "offline";
}

function validateHeartbeat(raw: unknown): ValidHeartbeat | null {
  if (!raw || typeof raw !== "object") return null;
  const hb = raw as Record<string, unknown>;

  // sessionId is required
  if (typeof hb.sessionId !== "string" || hb.sessionId.length === 0 || hb.sessionId.length > MAX_SESSION_ID) {
    return null;
  }

  const language = typeof hb.language === "string" ? hb.language.slice(0, MAX_STRING) : undefined;
  const project = typeof hb.project === "string" ? hb.project.slice(0, MAX_PROJECT) : undefined;
  const isWrite = hb.isWrite === true;

  let activeSeconds = typeof hb.activeSeconds === "number" ? Math.floor(hb.activeSeconds) : 0;
  activeSeconds = Math.max(0, Math.min(activeSeconds, MAX_ACTIVE_SECONDS));

  const editorName = typeof hb.editorName === "string" && ALLOWED_EDITORS.has(hb.editorName)
    ? hb.editorName
    : "vscode";

  const os = typeof hb.os === "string" && ALLOWED_OS.has(hb.os) ? hb.os : undefined;

  const status = typeof hb.status === "string" && ALLOWED_STATUS.has(hb.status)
    ? (hb.status as "active" | "offline")
    : undefined;

  return { language, project, isWrite, activeSeconds, sessionId: hb.sessionId, editorName, os, status };
}

// ── Route ───────────────────────────────────────────────────────────────────

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  const { data: dev, error: devErr } = await sb
    .from("developers")
    .select("id, github_login, avatar_url")
    .eq("vscode_api_key_hash", hashKey(apiKey))
    .limit(1)
    .maybeSingle();

  if (devErr || !dev) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (err) { console.warn("[app/api/heartbeats/route.ts] error:", err); return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
   }
  const rawList = Array.isArray(rawBody) ? rawBody : [rawBody];
  if (rawList.length === 0) {
    return NextResponse.json({ accepted: 0, rejected: 0 });
  }

  // Validate and sanitize all heartbeats
  const heartbeats: ValidHeartbeat[] = [];
  let rejected = 0;

  for (const raw of rawList.slice(0, 25)) {
    const hb = validateHeartbeat(raw);
    if (hb) {
      heartbeats.push(hb);
    } else {
      rejected++;
    }
  }
  rejected += Math.max(0, rawList.length - 25);

  let accepted = 0;

  // Aggregate active heartbeats per session so each session is persisted with
  // a single atomic RPC (no SELECT-then-upsert per heartbeat). Offline signals
  // end the session and are applied as direct updates.
  interface SessionAgg {
    count: number;
    activeSeconds: number;
    language?: string;
    project?: string;
    editorName: string;
    os?: string;
  }
  const activeBySession = new Map<string, SessionAgg>();

  for (const hb of heartbeats) {
    if (hb.status === "offline") {
      const { error } = await sb
        .from("developer_sessions")
        .update({ status: "offline", ended_at: new Date().toISOString() })
        .eq("developer_id", dev.id)
        .eq("session_id", hb.sessionId);

      if (error) {
        rejected++;
        continue;
      }
      accepted++;
      continue;
    }

    // Last writer wins for the descriptive fields; counters accumulate.
    const agg = activeBySession.get(hb.sessionId) ?? {
      count: 0,
      activeSeconds: 0,
      editorName: hb.editorName,
    };
    agg.count += 1;
    agg.activeSeconds += hb.activeSeconds;
    agg.language = hb.language;
    agg.project = hb.project;
    agg.editorName = hb.editorName;
    agg.os = hb.os;
    activeBySession.set(hb.sessionId, agg);
  }

  for (const [sessionId, agg] of activeBySession) {
    const { error } = await sb.rpc("record_heartbeat", {
      p_developer_id: dev.id,
      p_session_id: sessionId,
      p_heartbeats: agg.count,
      p_active_seconds: agg.activeSeconds,
      p_language: agg.language ?? null,
      p_project: agg.project ?? null,
      p_editor_name: agg.editorName,
      p_os: agg.os ?? null,
    });

    if (error) {
      rejected += agg.count;
      continue;
    }
    accepted += agg.count;
  }

  // Broadcast to realtime (no internal IDs exposed)
  if (heartbeats.length > 0) {
    const lastHb = heartbeats[heartbeats.length - 1];
    const broadcastStatus = lastHb.status === "offline" ? "offline" : "active";
    broadcastToChannel("coding-presence", "heartbeat", {
      githubLogin: dev.github_login,
      avatarUrl: dev.avatar_url,
      status: broadcastStatus,
      language: lastHb.language,
    });
  }

  return NextResponse.json({ accepted, rejected });
}
