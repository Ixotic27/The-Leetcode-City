import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";
import { z } from "zod";
import { validateBody } from "@/lib/validation";

const UPDATABLE_FIELDS = [
  "email_enabled",
  "push_enabled",
  "social",
  "digest",
  "marketing",
  "streak_reminders",
  "digest_frequency",
  "quiet_hours_start",
  "quiet_hours_end",
  "channel_overrides",
] as const;

/**
 * Zod schema for validating notification preference update payloads.
 */
const notificationPrefsSchema = z
  .object({
    email_enabled: z.boolean().optional(),
    push_enabled: z.boolean().optional(),
    social: z.boolean().optional(),
    digest: z.boolean().optional(),
    marketing: z.boolean().optional(),
    streak_reminders: z.boolean().optional(),
    digest_frequency: z.enum(["realtime", "hourly", "daily", "weekly"]).optional(),
    quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
    quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
    channel_overrides: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/**
 * GET /api/notification-preferences
 * Returns the authenticated user's notification preferences.
 */
export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({
    select: "id",
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  const sb = getSupabaseAdmin();
  const dev = auth.developer;

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const { data: prefs } = await sb
    .from("notification_preferences")
    .select("*")
    .eq("developer_id", dev.id)
    .maybeSingle();

  // Return defaults if no row exists
  if (!prefs) {
    return NextResponse.json({
      email_enabled: true,
      push_enabled: true,
      transactional: true,
      social: true,
      digest: true,
      marketing: false,
      streak_reminders: true,
      digest_frequency: "realtime",
      quiet_hours_start: null,
      quiet_hours_end: null,
      channel_overrides: {},
    });
  }

  return NextResponse.json(prefs);
}

/**
 * PATCH /api/notification-preferences
 * Update authenticated user's notification preferences.
 * `transactional` cannot be disabled (purchase receipts always send).
 */
export async function PATCH(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({
    select: "id",
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBody(body, notificationPrefsSchema);
  if (!validated.success) {
    return validated.response;
  }

  const sb = getSupabaseAdmin();
  const dev = auth.developer;

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  // Filter to only allowed fields
  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in validated.data) {
      update[field] = (validated.data as Record<string, unknown>)[field];
    }
  }

  // Prevent disabling transactional
  if ("transactional" in update) {
    delete update.transactional;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { data: updated, error } = await sb
    .from("notification_preferences")
    .upsert(
      { developer_id: dev.id, ...update },
      { onConflict: "developer_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
