"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CompareRedirect({ userA, userB }: { userA: string; userB: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/?compare=${encodeURIComponent(userA)},${encodeURIComponent(userB)}`);
  }, [router, userA, userB]);

  return null;
}
