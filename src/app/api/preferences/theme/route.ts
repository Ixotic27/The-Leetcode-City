import { NextResponse } from "next/server";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const themeSchema = z.object({
  city_theme: z.number().int().min(0, "Invalid theme index").max(3, "Invalid theme index"),
});


/**
 * GET /api/preferences/theme
 * Returns the authenticated user's saved city theme index.
 */
export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({
    select: "city_theme",
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  const dev = auth.developer;

  if (!dev) {
    return NextResponse.json({ city_theme: 0 });
  }

  return NextResponse.json({ city_theme: dev.city_theme ?? 0 });
}

/**
 * PATCH /api/preferences/theme
 * Update the authenticated user's city theme.
 * Body: { city_theme: number }
 */
/**
 * @param {import('next/server').NextRequest} request
 */
export async function PATCH(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({
    select: "id",
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = themeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid theme index" }, { status: 400 });
  }

  const theme = parsed.data.city_theme;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("developers")
    .update({ city_theme: theme })
    .eq("claimed_by", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ city_theme: theme });
}
