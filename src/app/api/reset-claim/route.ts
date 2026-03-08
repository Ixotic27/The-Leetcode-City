import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const admin = getSupabaseAdmin();

        // Find the building claimed by this user
        const { data: claimedBuilding } = await admin
            .from("developers")
            .select("id, github_login")
            .eq("claimed_by", user.id)
            .maybeSingle();

        if (!claimedBuilding) {
            return NextResponse.json({ error: "No claimed building found for your account." }, { status: 404 });
        }

        // Reset the claim
        const { error } = await admin
            .from("developers")
            .update({
                claimed: false,
                claimed_by: null,
                claimed_at: null,
                fetch_priority: 0,
            })
            .eq("id", claimedBuilding.id);

        if (error) {
            return NextResponse.json({ error: "Failed to reset claim." }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Claim on "${claimedBuilding.github_login}" has been reset. You can now link a new GitHub account.`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
