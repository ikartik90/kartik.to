import type { CSSProperties, ReactNode } from "react";
import { css } from "../../../styled-system/css";
import { easedFadeOut } from "@/utils/eased-fade";

// Filling the graphic over its dots, the screens centred across it and running off its foot.
const stageStyle = css({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingBlockStart: "4xl",
  mdDown: { paddingBlockStart: "3xl" },
  // A toggle at its head, close to the graphic's top.
  "&[data-toggle]": { paddingBlockStart: "xxl" },
  "&[data-low]": { paddingBlockStart: "5xl", mdDown: { paddingBlockStart: "4xl" } },
});

const MASK = easedFadeOut(70);

const masked = { maskImage: MASK, WebkitMaskImage: MASK } as CSSProperties;

/** A wireframe's ground, fading what's on it out into the graphic's foot. */
export function Stage({ children, toggle, low }: { children: ReactNode; toggle?: boolean; low?: boolean }) {
  return (
    <div className={stageStyle} style={masked} data-toggle={toggle ? "" : undefined} data-low={low ? "" : undefined}>
      {children}
    </div>
  );
}
