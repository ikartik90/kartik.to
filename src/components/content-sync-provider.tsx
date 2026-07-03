"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeContentUpdated } from "@/utils/content-sync";

export function ContentSyncProvider() {
  const router = useRouter();

  useEffect(() => {
    return subscribeContentUpdated(() => router.refresh());
  }, [router]);

  return null;
}
