import { css } from "../../styled-system/css";

// Frosting only: WebKit may drop a masked backdrop-filter, so the caller's wash must carry legibility.
const SCRIM_BLUR = "blur(1.4px)";

const scrimRamps = (towards: "top" | "bottom") => [
  `linear-gradient(to ${towards}, #000, transparent 55%)`,
  `linear-gradient(to ${towards}, #000, transparent)`,
];

const scrimLayerStyle = css({
  position: "absolute",
  inset: 0,
});

export interface ScrimBlurProps {
  /** The direction the frosting thins out, away from the band's edge. */
  towards: "top" | "bottom";
}

export function ScrimBlur({ towards }: ScrimBlurProps) {
  return (
    <>
      {scrimRamps(towards).map((ramp) => (
        <div
          key={ramp}
          className={scrimLayerStyle}
          // Inline: css() rejects `backdrop-filter`, and Panda's utility emits only the -webkit- form.
          style={{
            backdropFilter: SCRIM_BLUR,
            WebkitBackdropFilter: SCRIM_BLUR,
            maskImage: ramp,
            WebkitMaskImage: ramp,
          }}
        />
      ))}
    </>
  );
}
