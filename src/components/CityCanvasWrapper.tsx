'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import type { CityCanvasProps } from './CityCanvas';

const CityCanvas = dynamic(
  () => import('@/components/CityCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-[#ffa116] font-pixel text-lg">Loading City...</div>
      </div>
    )
  }
);

export default function CityCanvasWrapper(props: CityCanvasProps) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <CityCanvas {...props} />
    </Suspense>
  );
}
