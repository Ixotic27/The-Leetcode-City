import { NextResponse } from "next/server";
import { CityService } from "@/services/cityService";

/**
 * @param {import('next/server').NextRequest} request
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawFrom = parseInt(searchParams.get("from") ?? "0", 10);
  const rawTo = parseInt(searchParams.get("to") ?? "500", 10);

  if (Number.isNaN(rawFrom) || Number.isNaN(rawTo)) {
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

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      ...result.headers,
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
