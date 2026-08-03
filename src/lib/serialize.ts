import { buildDeveloperProjection } from "@/services/cityProjection";

/**
 * Sanitizes and projects a raw developer record into the public-facing shape
 * expected by the city map and leaderboard UI.
 *
 * @param dev - A raw developer record from the database.
 * @returns A sanitized developer object safe to send to the client.
 */
export function serializeDeveloper(dev: Record<string, unknown>): Record<string, unknown> {
  return buildDeveloperProjection(dev as Parameters<typeof buildDeveloperProjection>[0]);
}
