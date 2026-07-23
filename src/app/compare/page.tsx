import { Suspense } from "react";
import { CompareClient } from "./CompareClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ a?: string; b?: string }>;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedParams = await searchParams;
  const userA = resolvedParams.a || "";
  const userB = resolvedParams.b || "";

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#000206] font-pixel text-[#ffa116]">
          <div className="animate-pulse">Loading Compare Page...</div>
        </div>
      }
    >
      <CompareClient initialUserA={userA} initialUserB={userB} />
    </Suspense>
  );
}
