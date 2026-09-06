import { css } from "../../styled-system/css";

// ---------------------------------------------------------------------------
// ScrimBlur — the frosting half of a band, pointed at whichever edge asks for
// it.
//
// A band that has to hold words over something busy — a page's chrome over a
// calendar, a card's caption over a photograph — is two halves. The WASH is the
// one that does the work: a gradient in the ground's own colour, carried by the
// band itself, so the band dissolves into what it stands on instead of ending
// on a line. This is the garnish: a pair of 1.4px backdrop blurs masked over
// different distances, which takes the detail out from under the text without
// taking the picture away.
//
// TWO layers rather than one, and rather than many. 1.4px twice, masked over
// two different distances, so the pair composes in quadrature to ~2px where
// both survive and relaxes to 1.4 where only the long one does — a blur that
// DEEPENS toward the edge, where one masked layer would only give more of the
// same softness.
//
// The alternative was to build the fade out of the blur itself, in bands. It is
// not worth it: a `backdrop-filter` samples its backdrop clipped to its own
// box, so a thin band blurs with nothing above it to mix in and clamps against
// its own edge instead. Every band then lands visibly apart from its neighbour
// however close the radii are, which is banding you can read a date through.
//
// Written knowing WebKit may well drop it altogether: an element carrying
// `mask-image` is a backdrop root, so its own backdrop-filter can end up with
// nothing behind it to filter. That is a real risk and an acceptable one, and
// it is the reason this is only ever half of a band — the caller's wash is what
// has to carry the separation, here as in the calendar's edge scrims. Never
// hang legibility on this layer alone.
//
// Promoted here from the calchemy playground on its third use — the page's two
// bands and the home grid's cards — which is the rule this repo follows and,
// more to the point, the only thing that keeps one material from becoming
// three. A card frosting at a different radius from the playground's would read
// as a different piece of glass.
// ---------------------------------------------------------------------------

const SCRIM_BLUR = "blur(1.4px)";

/**
 * The near half of the ramp, then the tail — see the note above. Built FROM the
 * edge the band stands on, because every band wants the same pair pointed
 * whichever way it faces: a foot's band fades up off the bar it carries, a
 * head's down off the controls in it.
 */
const scrimRamps = (towards: "top" | "bottom") => [
  `linear-gradient(to ${towards}, #000, transparent 55%)`,
  `linear-gradient(to ${towards}, #000, transparent)`,
];

const scrimLayerStyle = css({
  position: "absolute",
  inset: 0,
});

export interface ScrimBlurProps {
  /**
   * Which way the frosting thins out — away from the edge the band stands on.
   * A band at the foot of a box takes `top`; one at its head takes `bottom`.
   */
  towards: "top" | "bottom";
}

export function ScrimBlur({ towards }: ScrimBlurProps) {
  return (
    <>
      {scrimRamps(towards).map((ramp) => (
        <div
          key={ramp}
          className={scrimLayerStyle}
          // The blur is INLINE rather than in the class, and has to be:
          // `css()` rejects both spellings of `backdrop-filter`, and Panda's
          // own utility emits only the `-webkit-` one, which Chromium ignores.
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
