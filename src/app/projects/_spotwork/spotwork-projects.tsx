"use client";

import { useEffect, useRef } from "react";
import { cx } from "../../../../styled-system/css";
import { subscribeProjectSheet } from "@/utils/project-sheet-channel";
import { takeProjectIntent } from "@/utils/project-intent";
import { LandingCards } from "./landing/landing-cards";
import { PrototypeOverlay, type OverlayHandle } from "./prototype-overlay";
import { manrope, poppins, spotworkTheme } from "./theme";
import { useProjectAddress } from "./use-project-address";

const THEME = cx(poppins.variable, manrope.variable, spotworkTheme);

// The version each project opens on.
const VERSIONS: Record<string, string | undefined> = { "check-ins": "company", "activation-and-retention": "activation" };

/**
 * The homepage's work: a card per project, each opening Spotwork's prototype over the page at the project's address.
 * `project`: the one the page was served for. `base`: as for `projectPath`.
 */
export function SpotworkProjects({ id, project, base }: { id?: string; project?: string; base?: string }) {
  const overlay = useRef<OverlayHandle>(null);
  const { openId, open, switchTo, closed } = useProjectAddress(project, overlay, base);
  // The command palette's projects open here while the page is on screen, rather than loading it again.
  useEffect(() => subscribeProjectSheet((to) => !openId && open(to)));
  // A card pressed before the page was live, which the head script held.
  useEffect(() => {
    const pressed = takeProjectIntent();
    if (pressed && !openId) open(pressed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <LandingCards id={id} paused={openId !== null} base={base} onOpen={open} />
      <PrototypeOverlay
        ref={overlay}
        open={openId !== null}
        onClose={closed}
        themeClassName={THEME}
        initial={openId ? { project: openId, version: VERSIONS[openId] } : undefined}
        onProject={switchTo}
        // Out until they're written for every project.
        comments={false}
      />
    </>
  );
}
