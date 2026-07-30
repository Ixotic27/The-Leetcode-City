import { buildDeveloperProjection } from "@/services/cityProjection";

/**
 * Serializes a developer record using the city projection builder.
 *
 * @param dev - A raw developer record from the database
 * @returns A projected developer record with only the fields exposed by the city view
 */
export function serializeDeveloper(dev: Record<string, unknown>): Record<string, unknown> {
  return buildDeveloperProjection(dev as Parameters<typeof buildDeveloperProjection>[0]);
}
