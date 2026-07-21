import { buildDeveloperProjection } from "@/services/cityProjection";

export function serializeDeveloper(dev: Record<string, unknown>): Record<string, unknown> {
  return buildDeveloperProjection(dev as Parameters<typeof buildDeveloperProjection>[0]);
}
