import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";
import { sanitizeBio } from "@/lib/sanitize-bio";

/**
 * GET /api/profile/bio
 * Returns the current user's bio
 */
export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: dev } = await admin
    .from("developers")
    .select("bio")
    .eq("claimed_by", auth.user.id)
    .single();

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  return NextResponse.json({ bio: dev.bio ?? "" });
}

/**
 * PUT /api/profile/bio
 * Updates the current user's bio with HTML sanitization to prevent XSS
 *
 * Request body: { bio: string }
 * - bio: User's profile bio (max 500 characters after sanitization)
 *
 * Returns: { bio: string, message: string }
 */
export async function PUT(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bio } = body;

  if (typeof bio !== "string") {
    return NextResponse.json({ error: "bio must be a string" }, { status: 400 });
  }

  // Sanitize the bio to remove XSS vectors
  const sanitized = sanitizeBio(bio);

  const admin = getSupabaseAdmin();

  // Update the developer's bio
  const { data: updated, error: updateError } = await admin
    .from("developers")
    .update({ bio: sanitized || null })
    .eq("claimed_by", auth.user.id)
    .select("bio")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Failed to update bio" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bio: updated.bio ?? "",
    message: "Bio updated successfully",
  });
}

/**
 * DELETE /api/profile/bio
 * Clears the current user's bio
 */
export async function DELETE() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { error: deleteError } = await admin
    .from("developers")
    .update({ bio: null })
    .eq("claimed_by", auth.user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to clear bio" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Bio cleared successfully" });
}
