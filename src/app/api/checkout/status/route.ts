import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const purchaseId = searchParams.get("purchase_id");

  if (!purchaseId) {
    return NextResponse.json({ error: "Missing purchase_id" }, { status: 400 });
  }

  // Auth + developer resolution
  const auth = await resolveAuthenticatedDeveloper({
    select: "id, github_login",
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  const sb = getSupabaseAdmin();
  const dev = auth.developer;
  const githubLogin = dev?.github_login ?? "";

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  // Fetch purchase — must belong to this developer
  const { data: purchase } = await sb
    .from("purchases")
    .select("status")
    .eq("id", purchaseId)
    .eq("developer_id", dev.id)
    .single();

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  return NextResponse.json({ status: purchase.status });
}
