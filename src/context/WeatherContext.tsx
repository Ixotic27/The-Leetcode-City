'use client';

import React, { createContext, useContext, useState } from 'react';

interface WeatherContextType {
  isRaining: boolean;
  setIsRaining: (raining: boolean) => void;
  isLoading: boolean;
  error: string | null;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

// Weather is purely time-of-day driven via the AtmosphereCycleManager.
// No geolocation or external weather API calls — the manual weatherMode
// button in the UI is the only way to change weather effects.
export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [isRaining, setIsRaining] = useState(false);

  return (
    <WeatherContext.Provider value={{ isRaining, setIsRaining, isLoading: false, error: null }}>
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