/**
 * Service for E.Arcade custom map CRUD operations.
 */
import { getSupabaseAdmin } from "@/lib/supabase";

export interface ArcadeMap {
  id: string;
  slug: string;
  name: string;
  creator_id: number;
  category: string;
  visibility: "public" | "unlisted";
  map_json: Record<string, unknown>;
  description: string | null;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export class ArcadeMapService {
  private sb = getSupabaseAdmin();

  async list(params: {
    page?: number;
    limit?: number;
    category?: string;
    creatorId?: number;
  }): Promise<{ maps: ArcadeMap[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let query = this.sb
      .from("arcade_maps")
      .select("id, slug, name, creator_id, category, visibility, description, play_count, created_at, updated_at", { count: "exact" })
      .eq("visibility", "public")
      .order("play_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.category) query = query.eq("category", params.category);
    if (params.creatorId) query = query.eq("creator_id", params.creatorId);

    const { data, error, count } = await query;
    if (error) {
      console.error("[arcadeMapService] list error:", error.message);
      return { maps: [], total: 0 };
    }
    return { maps: (data ?? []) as ArcadeMap[], total: count ?? 0 };
  }

  async getById(id: string): Promise<ArcadeMap | null> {
    const { data, error } = await this.sb
      .from("arcade_maps")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as ArcadeMap;
  }

  async create(input: {
    slug: string;
    name: string;
    creatorId: number;
    category: string;
    mapJson: Record<string, unknown>;
    description?: string;
    visibility?: "public" | "unlisted";
  }): Promise<ArcadeMap> {
    const { data, error } = await this.sb
      .from("arcade_maps")
      .insert({
        slug: input.slug,
        name: input.name,
        creator_id: input.creatorId,
        category: input.category,
        visibility: input.visibility ?? "public",
        description: input.description ?? null,
        map_json: input.mapJson,
        play_count: 0,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create map: ${error.message}`);
    return data as ArcadeMap;
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      category: string;
      mapJson: Record<string, unknown>;
      visibility: "public" | "unlisted";
    }>,
    requesterId: number,
  ): Promise<ArcadeMap> {
    const existing = await this.getById(id);
    if (!existing) throw new Error("Map not found");
    if (existing.creator_id !== requesterId) throw new Error("Forbidden: not the map creator");

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.category !== undefined) updates.category = input.category;
    if (input.mapJson !== undefined) updates.map_json = input.mapJson;
    if (input.visibility !== undefined) updates.visibility = input.visibility;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await this.sb
      .from("arcade_maps")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update map: ${error.message}`);
    return data as ArcadeMap;
  }

  async delete(id: string, requesterId: number): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error("Map not found");
    if (existing.creator_id !== requesterId) throw new Error("Forbidden: not the map creator");

    const { error } = await this.sb.from("arcade_maps").delete().eq("id", id);
    if (error) throw new Error(`Failed to delete map: ${error.message}`);
  }

  async incrementPlayCount(id: string): Promise<void> {
    this.sb
      .from("arcade_maps")
      .update({ play_count: this.sb.rpc("increment_arcade_map_play_count", { map_id: id }) })
      .eq("id", id)
      .then(() => {})
      .catch(() => {});
  }
}
