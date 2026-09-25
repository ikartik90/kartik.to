"use client";

import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import type { DemoInvitation as DemoInvitationState } from "@/hooks/use-demo-invitation";

export type DemoInvitationProps = DemoInvitationState;

export function DemoInvitation({ ref, visible, docked }: DemoInvitationProps) {
  return (
    <TooltipHostContext.Provider value={{ ref, visible, docked }}>
      <Tooltip tone="brand">
        <Tooltip.Text>Try it yourself</Tooltip.Text>
      </Tooltip>
    </TooltipHostContext.Provider>
  );
}
