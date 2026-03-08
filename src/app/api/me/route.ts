import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ leetcode_username: null, claimed: false });

    const admin = getSupabaseAdmin();
    const { data } = await admin
        .from("developers")
        .select("github_login, claimed")
        .eq("claimed_by", user.id)
        .eq("claimed", true)   // only count active claims
        .single();

    return NextResponse.json({
        leetcode_username: data?.github_login ?? null,
        claimed: data?.claimed ?? false,
    });
}
