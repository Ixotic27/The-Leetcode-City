'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWeatherMap } from '@/hooks/useWeatherMap'; // We will import our API hook

interface WeatherContextType {
  isRaining: boolean;
  setIsRaining: (raining: boolean) => void;
  isLoading: boolean;
  error: string | null;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { isRaining: apiIsRaining, isLoading, error } = useWeatherMap();
  const [isRaining, setIsRaining] = useState(false);
  const lastSyncedApiValue = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && !error) {
      // Only update local state if the API value has actually changed since our last sync
      if (lastSyncedApiValue.current === null || apiIsRaining !== lastSyncedApiValue.current) {
        setIsRaining(apiIsRaining);
        lastSyncedApiValue.current = apiIsRaining;
      }
    }
  }, [apiIsRaining, isLoading, error]);

  return (
    <WeatherContext.Provider value={{ isRaining, setIsRaining, isLoading, error }}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}