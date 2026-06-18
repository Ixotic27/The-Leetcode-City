import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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

  // Try 1: match by claimed_by (Highest priority: explicitly claimed building, usually Leetcode verified)
  const { data: claimedDev } = await sb
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .limit(1)
    .maybeSingle();
  if (claimedDev) return { devId: claimedDev.id };

  // Try 2: match by github_login (Fallback for legacy GitHub-native developers)
  if (githubLogin) {
    const { data: dev } = await sb
      .from("developers")
      .select("id")
      .ilike("github_login", githubLogin)
      .limit(1)
      .maybeSingle();
    if (dev) return { devId: dev.id };
  }

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
    .limit(1)
    .maybeSingle();

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
