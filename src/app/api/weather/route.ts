import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateQuery } from '@/lib/validation';

const querySchema = z.object({
  lat: z.coerce.number({ message: "lat must be a number" }).min(-90, "lat must be -90..90").max(90, "lat must be -90..90"),
  lon: z.coerce.number({ message: "lon must be a number" }).min(-180, "lon must be -180..180").max(180, "lon must be -180..180"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryVal = validateQuery(searchParams, querySchema);
  if (!queryVal.success) {
    return queryVal.response;
  }

  const { lat, lon } = queryVal.data;

  const apiKey = process.env.OPENWEATHER_API_KEY; 
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key configuration" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    if (!res.ok) throw new Error("Failed to fetch from OpenWeatherMap");
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}