import { NextResponse } from "next/server";
import { CityService } from "@/services/cityService";

/**
 * @param {import('next/server').NextRequest} request
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawFrom = parseInt(searchParams.get("from") ?? "0", 10);
  const rawTo = parseInt(searchParams.get("to") ?? "500", 10);

  if (isNaN(rawFrom) || isNaN(rawTo)) {
    return NextResponse.json(
      { error: "Invalid pagination parameters: 'from' and 'to' must be numbers." },
      { status: 400 }
    );
  }

  const from = Math.max(0, rawFrom);
  const to = Math.min(from + 1000, rawTo);

  if (to <= from) {
    return NextResponse.json(
      { error: "Invalid pagination parameters: 'to' must be greater than 'from'." },
      { status: 400 },
    );
  }

  const service = new CityService();
  const result = await service.loadCityData({ from, to });

  // Only healthy payloads are cacheable. Error responses must keep their
  // original Cache-Control (e.g. no-store) so CDNs/browsers never cache
  // failed or empty bodies as if they were valid city data (#1659).
  const cacheControl =
    result.status >= 200 && result.status < 300
      ? "public, max-age=60, stale-while-revalidate=300"
      : result.headers["Cache-Control"] ?? "no-store";

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      ...result.headers,
      "Cache-Control": cacheControl,
    },
  });
}
