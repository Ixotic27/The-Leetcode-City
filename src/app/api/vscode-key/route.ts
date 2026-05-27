import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function getAuthenticatedDevId(): Promise<{ devId: number } | { error: string; status: number }> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  const githubLogin = (
    user.user_metadata.user_name ??
    user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  const sb = getSupabaseAdmin();

  // Try 1: match by github_login (works for GitHub-native developers)
  if (githubLogin) {
    const { data: dev } = await sb
      .from("developers")
      .select("id")
      .eq("github_login", githubLogin)
      .single();
    if (dev) return { devId: dev.id };
  }

  // Try 2: match by claimed_by (works for LeetCode-seeded developers who claimed their building)
  const { data: claimedDev } = await sb
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .single();
  if (claimedDev) return { devId: claimedDev.id };

  return { error: "Developer not found. Claim your building first.", status: 404 };
}

export async function GET() {
  const auth = await getAuthenticatedDevId();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("vscode_api_key_hash")
    .eq("id", auth.devId)
    .single();

  return NextResponse.json({ hasKey: !!dev?.vscode_api_key_hash });
}

export async function POST() {
  const auth = await getAuthenticatedDevId();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const newKey = crypto.randomBytes(32).toString("base64url");
  const sb = getSupabaseAdmin();

  const { error } = await sb
    .from("developers")
    .update({ vscode_api_key_hash: hashKey(newKey) })
    .eq("id", auth.devId);

  if (error) {
    return NextResponse.json({ error: "Failed to generate key" }, { status: 500 });
  }

  return NextResponse.json({ key: newKey });
}
