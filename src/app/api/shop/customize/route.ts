import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
    const supabase = await createServerSupabase();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { developerId, itemId, config } = await request.json();

    if (itemId !== "building_style") {
        return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Validate ownership of building
    const { data: dev } = await sb
        .from("developers")
        .select("id, claimed_by")
        .eq("id", developerId)
        .single();

    if (!dev || dev.claimed_by !== user.id) {
        return NextResponse.json({ error: "Operation not permitted" }, { status: 403 });
    }

    // Upsert style
    const { error } = await sb.from("developer_customizations").upsert(
        {
            developer_id: developerId,
            item_id: "building_style",
            config: config,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "developer_id,item_id" }
    );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
