import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetchWeatherByCoords } from '@/services/weatherService';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useWeatherMap() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isGeoLoading, setIsGeoLoading] = useState(true);

  // 1. Get User Coordinates
  useEffect(() => {
    let isMounted = true;

    if (!navigator.geolocation) {
      if (isMounted) {
        setGeoError("Geolocation is not supported by your browser");
        setIsGeoLoading(false);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isMounted) {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setIsGeoLoading(false);
        }
      },
      (err) => {
        if (isMounted) {
          setGeoError(err.message);
          setIsGeoLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Weather Data via SWR (only runs if coords exist)
  // Note: You will need a free OpenWeatherMap API key in your .env.local
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY; 
  const { data, error, isLoading: isSWRILoading } = useSWR(
    coords ? ['weather', coords.lat, coords.lon] : null,
    () => fetchWeatherByCoords(coords!.lat, coords!.lon),
    { refreshInterval: 600000 }
  );

  // Map OpenWeather codes (2xx Thunderstorm, 3xx Drizzle, 5xx Rain) to our boolean
const weatherId = data?.weather?.[0]?.id;
const isRaining = weatherId >= 200 && weatherId < 600;

// Convert whatever error happens into a clean string text
const errorMessage = geoError 
  ? geoError 
  : error 
    ? (error instanceof Error ? error.message : String(error)) 
    : null;

// Hook is loading if either geolocation or SWR is loading
const isLoading = isGeoLoading || (isSWRILoading && !geoError);

return { isRaining, data, isLoading, error: errorMessage };
}