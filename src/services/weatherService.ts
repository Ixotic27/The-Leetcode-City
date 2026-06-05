export const fetchWeatherByCoords = async (lat: number, lon: number): Promise<any> => {
  // Instead of hitting OpenWeatherMap directly, we hit our own safe Next.js API route
  const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  
  if (!response.ok) {
    throw new Error("Weather data fetch failed via internal API");
  }
  
  return response.json();
};