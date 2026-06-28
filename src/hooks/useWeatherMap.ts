import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetchWeatherByCoords } from '@/services/weatherService';

export function useWeatherMap() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(() =>
    typeof navigator !== 'undefined' && !navigator.geolocation
      ? 'Geolocation is not supported by your browser'
      : null
  );
  const [isGeoLoading, setIsGeoLoading] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.geolocation
  );

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancel = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancel) return;
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsGeoLoading(false);
      },
      (err) => {
        if (cancel) return;
        setGeoError(err.message);
        setIsGeoLoading(false);
      }
    );
    return () => { cancel = true; };
  }, []);

  const { data, error, isLoading: isSWRILoading } = useSWR(
    coords ? ['weather', coords.lat, coords.lon] : null,
    () => fetchWeatherByCoords(coords!.lat, coords!.lon),
    { refreshInterval: 600000 }
  );

  const weatherId = data?.weather?.[0]?.id;
  const isRaining = weatherId !== undefined && weatherId >= 200 && weatherId < 600;

  const errorMessage = geoError
    ? geoError
    : error
      ? (error instanceof Error ? error.message : String(error))
      : null;

  const isLoading = isGeoLoading || (isSWRILoading && !geoError);

  return { isRaining, data, isLoading, error: errorMessage };
}