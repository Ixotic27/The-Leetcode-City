import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ArcadeMapService } from "@/services/arcadeMapService";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  creator_id: z.coerce.number().int().optional(),
});

// GET /api/arcade/maps — list public maps
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    creator_id: url.searchParams.get("creator_id") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { page, limit, category, creator_id } = parsed.data;
  const service = new ArcadeMapService();
  const result = await service.list({ page, limit, category, creatorId: creator_id });
  return NextResponse.json({ ...result, page, limit });
}

const CreateBodySchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  category: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  map_json: z.record(z.unknown()),
});

// POST /api/arcade/maps — create a new map
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateBodySchema.safeParse(body);
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
    const map = await service.create({
      slug: parsed.data.slug,
      name: parsed.data.name,
      creatorId: userId,
      category: parsed.data.category,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      mapJson: parsed.data.map_json,
    });
    return NextResponse.json({ map }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create map";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
