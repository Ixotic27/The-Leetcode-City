'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-bg font-pixel text-warm">
        <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center">
          <h2 className="mb-4 text-4xl font-pixel text-warm drop-shadow-lg">Critical System Error</h2>
          <p className="mb-8 font-pixel text-sm text-gray-400">
            A fatal error occurred that broke the entire city layout.
          </p>
          <div className="mb-8 font-pixel text-xs text-red-400 max-w-lg break-words bg-black/30 p-4 rounded text-left overflow-auto max-h-32">
            {error.message || "Unknown error"}
          </div>
          <button
            className="rounded bg-warm px-6 py-3 font-pixel text-bg hover:opacity-80 transition-opacity shadow-lg"
            onClick={() => reset()}
          >
            Reboot City
          </button>
        </div>
      </body>
    </html>
  );
}
