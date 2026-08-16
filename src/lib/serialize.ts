/**
 * Utility functions for serializing developer data into a
 * client-safe projection using the city projection service.
 */
import { buildDeveloperProjection } from "@/services/cityProjection";

/**
 * Serializes a developer object into the standardized developer
 * projection used throughout the application.
 *
 * @param dev - The developer object to serialize.
 * @returns The serialized developer projection.
 */
export function serializeDeveloper(
  dev: Record<string, unknown>
): Record<string, unknown> {
  return buildDeveloperProjection(
    dev as Parameters<typeof buildDeveloperProjection>[0]
  );
}