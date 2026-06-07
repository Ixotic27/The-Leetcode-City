'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Runtime error caught by Error Boundary:", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-4 text-3xl font-pixel text-warm drop-shadow-md">Something went wrong!</h2>
      <p className="mb-8 font-pixel text-sm text-gray-400">
        An unexpected error occurred while loading this section of the city.
      </p>
      <button
        className="rounded bg-warm px-4 py-2 font-pixel text-bg hover:opacity-80 transition-opacity shadow-lg"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
}
