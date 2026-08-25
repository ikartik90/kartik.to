"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

// ---------------------------------------------------------------------------
// Whether the author is signed in — the one client-side answer to that.
//
// It is a hook rather than a read of the session because the answer has to LIE
// for exactly one render, and every consumer needs the same lie. The admin
// session lives client-side (localStorage), invisible to the server, so the
// server always renders the logged-out tree; a first client render that
// answered `true` would put admin-only nodes against markup that has none of
// them, and React aborts hydration with error #418 rather than patching it up.
// So: false on the server, false through hydration, and the truth one commit
// later — at which point the admin UI appears.
//
// This is the CLIENT's answer, and it is a question of what to draw, never of
// what may be done. Every action that touches the database checks the session
// again on the server (`requireAdmin`), because this one is trivially faked by
// anyone with a console open.
// ---------------------------------------------------------------------------

export function useIsAdmin(): boolean {
  const { data: session } = authClient.useSession();

  const [mounted, setMounted] = useState(false);
  // Deliberate mount-flag flip: the one-commit-later render is the whole point
  // of the hydration guard described above.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return mounted && !!session?.user;
}
