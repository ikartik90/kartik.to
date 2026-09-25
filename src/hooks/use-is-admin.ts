"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

// False on the server and through hydration (a mismatch aborts it, #418), true a commit
// later. Decides what to draw only; every mutation re-checks with `requireAdmin()`.

export function useIsAdmin(): boolean {
  const { data: session } = authClient.useSession();

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return mounted && !!session?.user;
}
