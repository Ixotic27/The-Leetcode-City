import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { FREE_CLAIM_ITEM, grantFreeClaimItem } from "@/lib/items";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function POST() {
  const auth = await resolveAuthenticatedDeveloper({
    select: "id, github_login, claimed, claimed_by",
    validateDeveloper: (developer, user) => {
      if (
        !developer ||
        !developer.claimed ||
        developer.claimed_by !== user?.id
      ) {
        return {
          ok: false,
          error: "You must claim your building first",
          status: 403,
        };
      }
      return { ok: true };
    },
  });

  if (!auth.ok || !auth.user || !auth.developer) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  const dev = auth.developer;
  if (typeof dev.id !== "number") {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  await grantFreeClaimItem(dev.id);

  // grantFreeClaimItem is idempotent: returns false if already owned.
  // Either way the user should see the success state — treat as 200 OK.
  // (Returning 409 previously caused the frontend to silently reset
  // the button without opening the gift modal — issue #11.)

  return NextResponse.json({
    claimed: true,
    item_id: FREE_CLAIM_ITEM,
  });
}
