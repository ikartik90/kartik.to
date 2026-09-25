import { defineKeyframes } from "@pandacss/dev";

export const keyframes = defineKeyframes({
  wireframeShimmer: {
    from: { backgroundPosition: "200% 0" },
    to: { backgroundPosition: "-200% 0" },
  },
  collectionArrive: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  // Travels its own width (`100%`), via `translate` so `transform` stays free.
  propertiesPanelIn: {
    from: { translate: "100% 0", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  propertiesPanelOut: {
    from: { translate: "0 0", opacity: 1 },
    to: { translate: "100% 0", opacity: 0 },
  },
  bottomSheetIn: {
    from: { translate: "0 100%", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  bottomSheetOut: {
    from: { translate: "0 0", opacity: 1 },
    to: { translate: "0 100%", opacity: 0 },
  },
  // One keyframe for every chrome part; each sets `--entrance-from` in its own units (`0px` to only fade).
  playgroundChromeIn: {
    from: { translate: "0 var(--entrance-from, 0px)", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  // `--calendar-push` (set by `Calendar.PeriodList`) drives both halves, so they stay in lockstep.
  calendarPageIn: {
    from: { translate: "var(--calendar-push) 0" },
    to: { translate: "0 0" },
  },
  calendarPageOut: {
    from: { translate: "0 0" },
    to: { translate: "calc(var(--calendar-push) * -1) 0" },
  },
  demoCursorTap: {
    from: { opacity: 0.6, transform: "scale(0.35)" },
    to: { opacity: 0, transform: "scale(1)" },
  },

  // Weather keyframes are ambient only; state changes are transitions on the parent node.
  weatherPlasmaSpin: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
  weatherHaloBreathe: {
    "0%, 100%": { transform: "scale(1)", opacity: 0.85 },
    "50%": { transform: "scale(1.04)", opacity: 1 },
  },
  weatherCloudDrift: {
    from: { transform: "translateX(calc(var(--wx-drift) * -1))" },
    to: { transform: "translateX(var(--wx-drift))" },
  },
  // Starts blurred and faded under the cloud; falls along the drop's 15° lean (lateral = vertical × tan 15°).
  // Percentages of the frame, so the fall scales with the drawing.
  weatherRainFall: {
    "0%": {
      transform: "translate(0.857%, -3.2%)",
      opacity: 0,
      filter: "blur(calc(4 * var(--wx-unit)))",
    },
    "18%": { opacity: 1 },
    "42%": { filter: "blur(0px)" },
    "68%": { opacity: 1 },
    "100%": {
      transform: "translate(-2.144%, 8%)",
      opacity: 0,
      filter: "blur(0px)",
    },
  },
  // Each flake has its own duration, so their sway never falls into step.
  weatherSnowFall: {
    "0%": {
      transform: "translate(0, -4%)",
      opacity: 0,
      filter: "blur(calc(4 * var(--wx-unit)))",
    },
    "15%": { opacity: 1 },
    "42%": { filter: "blur(0px)" },
    "50%": { transform: "translate(1.2%, 1.6%)" },
    "78%": { opacity: 1 },
    "100%": {
      transform: "translate(-0.8%, 7.2%)",
      opacity: 0,
      filter: "blur(0px)",
    },
  },
  // On its own node: the fall owns `transform` on the layer root.
  weatherSnowSpin: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(180deg)" },
  },
  // Two flashes a third of the way in, on a clock that starts with the storm (`--wx-strike-name`).
  // The bolt and the cloud's glow share this one envelope.
  weatherBoltStrike: {
    "0%, 32%": { opacity: 0 },
    "33%": { opacity: 1 },
    "36%": { opacity: 0.1 },
    "38%": { opacity: 1 },
    "47%": { opacity: 0.9 },
    "59%": { opacity: 0 },
    "100%": { opacity: 0 },
  },
});
