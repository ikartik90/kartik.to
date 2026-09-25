import { defineSlotRecipe } from "@pandacss/dev";

// Every layer stays mounted: `weather` writes custom properties that CSS interpolates. One root <svg> per layer
// (WebKit ignores filters on SVG children). Parents own state transitions, children ambient keyframes, never both.
export const weatherGraphic = defineSlotRecipe({
  className: "weather-graphic",
  description:
    "The weather illustration from Figma 1995:24 — eleven variants expressed as one scene of persistent layers whose arrangement is written by ~20 custom properties on the root, so any two conditions interpolate into each other. Each layer is its own absolutely-positioned root <svg>, because WebKit ignores CSS filter functions on SVG child elements and every blur in the drawing would otherwise be missing in Safari; blurs are sized in container units so they still scale with the graphic. `weather` places and tints the layers; `time` cross-fades the sun against the moon and re-colours the halo, independently, and keeps doing so while an overcast sky hides both. Cloud Big carries a PROGRESSIVE bottom blur (four gradient-masked copies added together, driven by a single variable) rather than a fixed one, so the cloud can dissolve into fog. Ambient motion — falling drops, drifting flakes, a turning corona, a striking bolt — lives on child nodes so it never contends with the state transitions on their parents, and is dropped outright under `prefers-reduced-motion` so each layer rests where Figma drew it.",
  slots: [
    "root",
    "layer",
    "plasma",
    "plasmaSpin",
    "haloGate",
    "halo",
    "haloDisc",
    "orb",
    "orbBody",
    "orbLayer",
    "drift",
    "cloudSmall",
    "cloudSmallShape",
    "cloudBig",
    "cloudShadow",
    "cloudBigStack",
    "cloudBigLayer",
    "litGate",
    "litCloud",
    "innerGlow",
    "rain",
    "drop",
    "snow",
    "flake",
    "flakeSpin",
    "bolt",
    "boltFlash",
    "boltBloom",
    "boltCoreStack",
    "boltCore",
  ],
  base: {
    root: {
      position: "relative",
      display: "block",
      width: "token(spacing.full)",
      aspectRatio: "1",
      // Makes `--wx-unit` (cqw) scale with the graphic.
      containerType: "inline-size",
      // The blur rungs add (`plus-lighter`); this keeps them from adding into the page.
      isolation: "isolate",

      "--wx-travel": "900ms",
      "--wx-fade": "620ms",
      "--wx-glow": "900ms",
      "--wx-ease": "cubic-bezier(0.33, 1, 0.68, 1)",

      // Floors, so no slot reads an unset variable: an invalid `translateX()` drops the whole transform.
      "--wx-unit": "0.4cqw",
      "--wx-drift": "0px",
      // One clock for the strike and the cloud it lights.
      "--wx-strike": "4.6s",
      "--wx-strike-name": "none",
      "--wx-k": "0",
      "--wx-orb-base": "0",
      "--wx-cloud-shadow": "0",
      "--wx-cloud-big-base": "0",

      // Dropped rather than left to the global reset, which ends each on its last keyframe, where drops and bolts are gone.
      "@media (prefers-reduced-motion: reduce)": {
        "& [data-wx-ambient]": { animation: "none" },
        // The cloud's inner light exists only while the bolt is out, so a still lights it deliberately.
        "& [data-wx-ambient='lit']": { opacity: 1 },
      },
    },

    // `overflow: visible`: the halo and glows reach past the artboard on purpose.
    layer: {
      position: "absolute",
      inset: 0,
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      overflow: "visible",
      pointerEvents: "none",
      // Load-bearing: an unpromoted filtered layer repaints a region that misses the blur's reach, leaving stale rectangles.
      willChange: "transform",
    },

    // Day only. A gradient rect masked by the star: the mask turns, so the paint and the filter box stay still.
    plasma: {
      opacity: "calc(var(--wx-plasma) * var(--wx-day) * 0.5)",
      filter: "blur(calc(7.5 * var(--wx-unit)))",
      // The glow clock, shared with the halo: the two are one glow.
      transition: "opacity var(--wx-glow) ease-in-out",
    },
    plasmaSpin: {
      transformBox: "view-box",
      transformOrigin: "125px 125px",
      animation: "weatherPlasmaSpin 90s linear infinite",
    },
    // A separate gate: an animation on `opacity` outranks the declaration. Carries placement as the one unfiltered node.
    haloGate: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-halo)",
      transformOrigin: "0 0",
      transform:
        "translate(calc((var(--wx-orb-x) - 125 * var(--wx-orb-scale)) * 0.4%), calc((var(--wx-orb-y) - 125 * var(--wx-orb-scale)) * 0.4%)) scale(var(--wx-orb-scale))",
      transition:
        "opacity var(--wx-glow) ease-in-out, transform var(--wx-travel) var(--wx-ease)",
    },
    // Breathes on the layer (see `plasma`): scaling inside a filtered element re-rasterizes the blur.
    halo: {
      // Pulled in from Figma's so the glow ends inside the frame instead of being cut off.
      filter: "blur(calc(12 * var(--wx-unit)))",
      transformOrigin: "center",
      animation: "weatherHaloBreathe 9s ease-in-out infinite",
    },
    haloDisc: {
      fill: "var(--wx-halo-color)",
      transition: "fill var(--wx-fade) linear",
    },
    // Four blur depths in bands that sum to 1, so haze dissolves the underside; other conditions zero the ramp.
    orb: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-orb-opacity)",
      isolation: "isolate",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // Each body is cross-faded above the filters, so their input never changes; `plus-lighter` keeps the sum opaque.
    orbBody: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-body)",
      mixBlendMode: "plus-lighter",
      isolation: "isolate",
      // `linear`: the two added opacities must sum to 1 at every instant.
      transition: "opacity var(--wx-fade) linear",
    },
    // Placement on the layer too, so the filtered result moves as a unit.
    orbLayer: {
      filter:
        "blur(calc((var(--wx-orb-base) + var(--wx-orb-blur) * var(--wx-k)) * var(--wx-unit)))",
      mixBlendMode: "plus-lighter",
      maskRepeat: "no-repeat",
      transformOrigin: "0 0",
      transform:
        "translate(calc((var(--wx-orb-x) - 125 * var(--wx-orb-scale)) * 0.4%), calc((var(--wx-orb-y) - 125 * var(--wx-orb-scale)) * 0.4%)) scale(var(--wx-orb-scale))",
      transition:
        "filter var(--wx-travel) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // Holds the ambient wander so the layer's own `transform` stays the state.
    drift: {
      position: "absolute",
      inset: 0,
      animation: "weatherCloudDrift 19s ease-in-out infinite alternate",
    },
    cloudSmall: {
      opacity: "var(--wx-cloud-small-opacity)",
      filter: "blur(calc(var(--wx-cloud-small-blur) * var(--wx-unit)))",
      // A layer's box is the frame, so N viewBox units is N × 0.4%.
      transformOrigin: "0 0",
      transform:
        "translate(calc(var(--wx-cloud-small-x) * 0.4%), calc(var(--wx-cloud-small-y) * 0.4%)) scale(var(--wx-cloud-small-scale))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), filter var(--wx-travel) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    cloudSmallShape: { opacity: 0.75 },
    cloudBig: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-cloud-big-opacity)",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // An offset blurred copy, not a group filter, whose region would clip the stack's soft bottom.
    cloudShadow: {
      opacity: "var(--wx-cloud-shadow)",
      filter: "blur(calc(4 * var(--wx-unit)))",
      transformOrigin: "0 0",
      transform:
        "translate(calc((var(--wx-cloud-big-x) - 5) * 0.4%), calc((var(--wx-cloud-big-y) - 1) * 0.4%)) scale(var(--wx-cloud-big-scale))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    cloudBigStack: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-cloud-big-fill)",
      // Keeps the rungs' additive blend inside the cloud.
      isolation: "isolate",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // `--wx-k` is set per copy. `plus-lighter` is load-bearing: normal compositing piles alpha into a halo at the soft edge.
    cloudBigLayer: {
      filter:
        "blur(calc((var(--wx-cloud-big-base) + var(--wx-cloud-big-blur) * var(--wx-k)) * var(--wx-unit)))",
      mixBlendMode: "plus-lighter",
      maskRepeat: "no-repeat",
      transformOrigin: "0 0",
      transform:
        "translate(calc(var(--wx-cloud-big-x) * 0.4%), calc(var(--wx-cloud-big-y) * 0.4%)) scale(var(--wx-cloud-big-scale))",
      transition:
        "filter var(--wx-travel) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // Outside the filtered layer, so only opacity moves over a blur rasterized once.
    litGate: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      animationName: "var(--wx-strike-name)",
      animationDuration: "var(--wx-strike)",
      animationTimingFunction: "ease-out",
      animationIterationCount: "infinite",
    },
    litCloud: {
      opacity: "calc(var(--wx-bolt) * 0.5)",
      filter: "blur(calc(7 * var(--wx-unit)))",
      // The cloud's silhouette intersected with what a strike from below reaches (`CLOUD_LIT_MASK`).
      maskRepeat: "no-repeat, no-repeat",
      maskSize: "100% 100%, 100% 100%",
      maskPosition: "0 0, 0 0",
      maskComposite: "intersect",
      transformOrigin: "0 0",
      transform:
        "translate(calc(var(--wx-cloud-big-x) * 0.4%), calc(var(--wx-cloud-big-y) * 0.4%)) scale(var(--wx-cloud-big-scale))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // A wide stroke masked to the inside, so the light follows the outline; a fill would rule a straight edge.
    innerGlow: {
      fill: "none",
      stroke: "token(colors.sky.boltGlow)",
      strokeWidth: "20",
    },

    // Each drop and flake is its own root <svg>: its blur only exists on a root in Safari.
    rain: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-rain)",
      transformOrigin: "0 0",
      transform: "translate(0, calc(var(--wx-precip-y) * 0.4%))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    drop: {
      animation:
        "weatherRainFall 1.65s cubic-bezier(0.4, 0, 1, 1) infinite",
    },
    snow: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-snow)",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    flake: {
      animation: "weatherSnowFall var(--wx-flake) linear infinite",
    },
    // The turn needs its own node, since the fall owns `transform` on the root; `fill-box` spins it about its middle.
    flakeSpin: {
      transformBox: "fill-box",
      transformOrigin: "center",
      animation: "weatherSnowSpin var(--wx-flake) linear infinite",
    },

    bolt: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-bolt)",
      transformOrigin: "0 0",
      transform: "translate(0, calc(var(--wx-precip-y) * 0.4%))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // Named through `--wx-strike-name`, so the animation starts at zero when a storm arrives; rests at 0 without it.
    boltFlash: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      animationName: "var(--wx-strike-name)",
      animationDuration: "var(--wx-strike)",
      animationTimingFunction: "ease-out",
      animationIterationCount: "infinite",
    },
    boltBloom: {
      opacity: 0.7,
      filter: "blur(calc(12 * var(--wx-unit)))",
    },
    boltCoreStack: {
      position: "absolute",
      inset: 0,
      isolation: "isolate",
    },
    boltCore: {
      filter: "blur(calc(var(--wx-k) * 5 * var(--wx-unit)))",
      mixBlendMode: "plus-lighter",
      maskRepeat: "no-repeat",
    },
  },

  variants: {
    // Hidden layers still park somewhere sensible, since that is where they travel from. The body moves only for fog.
    weather: {
      clear: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          // Half a unit, so the disc's edge does not alias against the corona.
          "--wx-orb-base": "0.5",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "1",
          "--wx-halo": "1",
          "--wx-plasma": "1",
          "--wx-cloud-big-x": "114.9932",
          "--wx-cloud-big-y": "93.875",
          "--wx-cloud-big-scale": "0.5",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "0",
          // Kept though the cloud is hidden, so the shadow never fades up behind its own cloud.
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "0",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "20.99",
          "--wx-cloud-small-y": "54.25",
          "--wx-cloud-small-scale": "0.5",
          "--wx-cloud-small-blur": "0.5",
          "--wx-cloud-small-opacity": "0",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "0px",
          "--wx-precip-y": "0",
          "--wx-rain": "0",
          "--wx-snow": "0",
          "--wx-bolt": "0",
        },
      },
      cloudy: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          "--wx-orb-base": "2.5",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "1",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "94.9932",
          "--wx-cloud-big-y": "93.875",
          "--wx-cloud-big-scale": "0.5",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "0",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "40.99",
          "--wx-cloud-small-y": "54.25",
          "--wx-cloud-small-scale": "0.5",
          "--wx-cloud-small-blur": "0.5",
          "--wx-cloud-small-opacity": "1",
          "--wx-cloud-top": "token(colors.sky.cloudLight)",
          "--wx-drift": "2px",
          "--wx-precip-y": "0",
          "--wx-rain": "0",
          "--wx-snow": "0",
          "--wx-bolt": "0",
        },
      },
      haze: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          "--wx-orb-base": "3",
          "--wx-orb-blur": "14",
          "--wx-orb-opacity": "1",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "114.9932",
          "--wx-cloud-big-y": "93.875",
          "--wx-cloud-big-scale": "0.5",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "0",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "0",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "20.99",
          "--wx-cloud-small-y": "54.25",
          "--wx-cloud-small-scale": "0.5",
          "--wx-cloud-small-blur": "0.5",
          "--wx-cloud-small-opacity": "0",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "0px",
          "--wx-precip-y": "0",
          "--wx-rain": "0",
          "--wx-snow": "0",
          "--wx-bolt": "0",
        },
      },
      fog: {
        root: {
          "--wx-orb-x": "104.5",
          "--wx-orb-y": "112.5",
          "--wx-orb-scale": "0.65",
          "--wx-orb-base": "10",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "1",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "-9.0137",
          "--wx-cloud-big-y": "20.25",
          "--wx-cloud-big-scale": "1",
          "--wx-cloud-big-base": "6",
          "--wx-cloud-big-blur": "14",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.75",
          // Parked inside the big cloud's left shoulder, so it disappears into the deck.
          "--wx-cloud-small-x": "37.2",
          "--wx-cloud-small-y": "81.2",
          "--wx-cloud-small-scale": "0.6",
          "--wx-cloud-small-blur": "6",
          "--wx-cloud-small-opacity": "0",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "4px",
          "--wx-precip-y": "0",
          "--wx-rain": "0",
          "--wx-snow": "0",
          "--wx-bolt": "0",
        },
      },
      rain: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          "--wx-orb-base": "10",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "0",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "0",
          "--wx-cloud-big-y": "0",
          "--wx-cloud-big-scale": "1",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "6.5",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "0",
          "--wx-cloud-small-y": "0",
          "--wx-cloud-small-scale": "1",
          "--wx-cloud-small-blur": "1.5",
          "--wx-cloud-small-opacity": "1",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "1.5px",
          "--wx-precip-y": "0",
          "--wx-rain": "1",
          "--wx-snow": "0",
          "--wx-bolt": "0",
        },
      },
      thundershower: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          "--wx-orb-base": "10",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "0",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "0",
          "--wx-cloud-big-y": "0",
          "--wx-cloud-big-scale": "1",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "6.5",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "0",
          "--wx-cloud-small-y": "0",
          "--wx-cloud-small-scale": "1",
          "--wx-cloud-small-blur": "1.5",
          "--wx-cloud-small-opacity": "1",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "1.5px",
          // Figma's deck nudge for the bolt is deliberately not reproduced: the overcast skies differ only in what falls.
          "--wx-precip-y": "0",
          "--wx-rain": "1",
          "--wx-snow": "0",
          "--wx-bolt": "1",
          "--wx-strike-name": "weatherBoltStrike",
        },
      },
      snow: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          "--wx-orb-base": "10",
          "--wx-orb-blur": "0",
          "--wx-orb-opacity": "0",
          "--wx-halo": "0",
          "--wx-plasma": "0",
          "--wx-cloud-big-x": "0",
          "--wx-cloud-big-y": "0",
          "--wx-cloud-big-scale": "1",
          "--wx-cloud-big-base": "0.5",
          "--wx-cloud-big-blur": "6.5",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "0",
          "--wx-cloud-small-y": "0",
          "--wx-cloud-small-scale": "1",
          "--wx-cloud-small-blur": "1.5",
          "--wx-cloud-small-opacity": "1",
          "--wx-cloud-top": "token(colors.sky.cloudMid)",
          "--wx-drift": "1.5px",
          "--wx-precip-y": "0",
          "--wx-rain": "0",
          "--wx-snow": "1",
          "--wx-bolt": "0",
        },
      },
    },

    time: {
      day: {
        root: {
          "--wx-day": "1",
          "--wx-night": "0",
          "--wx-halo-color":
            "color-mix(in srgb, token(colors.brand.orange) 15%, transparent)",
        },
      },
      night: {
        root: {
          "--wx-day": "0",
          "--wx-night": "1",
          "--wx-halo-color":
            "color-mix(in srgb, token(colors.sky.moonGlow) 25%, transparent)",
        },
      },
    },
  },

  defaultVariants: { weather: "clear", time: "day" },

  // Chosen at runtime, so the extractor never sees the variants as literals.
  staticCss: [{ weather: ["*"], time: ["*"] }],
});
