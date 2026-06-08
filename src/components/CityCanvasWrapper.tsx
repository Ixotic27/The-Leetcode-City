'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

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

export default function CityCanvasWrapper(props: any) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <CityCanvas {...props} />
    </Suspense>
  );
}