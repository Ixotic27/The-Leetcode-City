import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCommunityMilestoneNotifications } from "@/lib/notification-senders/community-milestone";
import crypto from "crypto";

const MILESTONES = [
  10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000,
];

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  const { count } = await sb
    .from("developers")
    .select("id", { count: "exact", head: true });

  const totalDevelopers = count ?? 0;

  const milestone = [...MILESTONES].reverse().find((m) => totalDevelopers >= m);
  if (!milestone) {
    return NextResponse.json({ celebrated: false });
  }

  const { data, error } = await sb
    .from("milestone_celebrations")
    .upsert(
      { milestone, reached_at: new Date().toISOString() },
      { onConflict: "milestone", ignoreDuplicates: true },
    )
    .select()
    .single();

  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  sendCommunityMilestoneNotifications(milestone).catch((err) => {
    console.error("[milestone] Notification send error:", err);
  });

  return NextResponse.json({
    celebrated: true,
    milestone,
    reached_at: data?.reached_at,
  });
}

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("milestone_celebrations")
    .select("milestone, reached_at")
    .order("milestone", { ascending: false });

  return NextResponse.json(data ?? []);
}
