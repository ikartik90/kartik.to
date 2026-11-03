"use client";

import { createContext, use, type ReactElement } from "react";
import { Wireframe } from "@/components/ui/wireframe";

/** Whether the team just switched to is still loading. */
export const TeamLoading = createContext(false);

/** What the team's own data draws, a skeleton while a team switched to loads; the rest of its page stays as it is. */
export function TeamData({ children }: { children: ReactElement }) {
  return (
    <Wireframe asChild enabled={use(TeamLoading)} mode="loading">
      {children}
    </Wireframe>
  );
}
