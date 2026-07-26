import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ArcadeMapService } from "@/services/arcadeMapService";

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(64).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  map_json: z.record(z.unknown()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const service = new ArcadeMapService();
  const map = await service.getById(id);

  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  service.incrementPlayCount(id).catch(() => {});
  return NextResponse.json({ map });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let userId: number;
  try {
    const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
    const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
    if (!auth.ok || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = auth.user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = new ArcadeMapService();
  try {
    const map = await service.update(
      id,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        visibility: parsed.data.visibility,
        mapJson: parsed.data.map_json,
      },
      userId,
    );
    return NextResponse.json({ map });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Update failed";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("Forbidden")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let userId: number;
  try {
    const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
    const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
    if (!auth.ok || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = auth.user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = new ArcadeMapService();
  try {
    await service.delete(id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("Forbidden")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
