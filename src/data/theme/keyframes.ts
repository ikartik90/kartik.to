import { defineKeyframes } from "@pandacss/dev";

export const keyframes = defineKeyframes({
  // Driven by background-position on an over-wide gradient (see the
  // `skeleton` recipe) so it composites on the GPU and never reflows.
  wireframeShimmer: {
    from: { backgroundPosition: "200% 0" },
    to: { backgroundPosition: "-200% 0" },
  },
  // The photo displaced by a reorder, appearing in the slot the dragged
  // one just left. It has no journey to show — it was never picked up —
  // so it resolves in place rather than sliding in from somewhere it
  // never was.
  collectionArrive: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  // The properties panel arriving from the edge it is docked to. It
  // travels by its OWN width (`100%`, not a viewport unit), so the panel
  // starts exactly off-screen whatever it happens to be that wide — and
  // `translate` rather than `transform` leaves the transform property
  // free for anything the panel's contents want to do.
  //
  // Opacity rides along so the shadow doesn't sweep across the page
  // ahead of the panel; the global `prefers-reduced-motion` reset in
  // globals.css collapses the whole thing to a cut.
  propertiesPanelIn: {
    from: { translate: "100% 0", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  // ...and leaving the same way it came. A panel that slides in and then
  // simply vanishes reads as two different objects; the return journey
  // is what makes the edge it went back to legible.
  propertiesPanelOut: {
    from: { translate: "0 0", opacity: 1 },
    to: { translate: "100% 0", opacity: 0 },
  },
  // The same panel as a bottom sheet, arriving from the edge THAT is
  // docked to. Same distance in its own units, same 200ms, same opacity
  // ride — one object with two edges to come from, not two animations.
  bottomSheetIn: {
    from: { translate: "0 100%", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  bottomSheetOut: {
    from: { translate: "0 0", opacity: 1 },
    to: { translate: "0 100%", opacity: 0 },
  },
  // A piece of the shader playground's chrome taking its seat, once the
  // preset it belongs to is on screen. The page opens on a preloader
  // ALONE and then assembles itself in the order the parts depend on each
  // other: the card, then the two rails that act on it, then the panel
  // that describes it (see `shader-playground`).
  //
  // ONE keyframe for every part, because they differ only in where they
  // come from — the aspect rail out from behind the card on a phone and
  // down from the top edge on a desktop, the presets strip up from the
  // bottom edge in both — and `--entrance-from` is that difference,
  // written by each part in its own units. The alternative is four
  // near-identical keyframes that have to be kept in step by hand, and a
  // part whose travel changes with the layout could not have one at all.
  //
  // `0px` is a legitimate value for it: a part that is already in its
  // seat and only has to appear (the card) rides the same fade as the
  // ones that travel, on the same clock.
  playgroundChromeIn: {
    from: { translate: "0 var(--entrance-from, 0px)", opacity: 0 },
    to: { translate: "0 0", opacity: 1 },
  },
  // The calendar's page turn. A chevron replaces every month on screen at
  // once, so the arriving page enters from the side the range is
  // travelling toward and the leaving one is pushed out by the same
  // distance — the pair reads as one strip being moved along rather than
  // a blink between two months.
  //
  // `--calendar-push` IS that distance, set by `Calendar.PeriodList` as a
  // percentage of one month column (a turn moves by `step` columns,
  // whatever the range's width) and signed by the direction of travel.
  // One variable for both halves is what keeps them in lockstep: where a
  // walking range repeats a month, the two copies sit at exactly the same
  // x for the whole slide instead of drifting past each other.
  calendarPageIn: {
    from: { translate: "var(--calendar-push) 0" },
    to: { translate: "0 0" },
  },
  calendarPageOut: {
    from: { translate: "0 0" },
    to: { translate: "calc(var(--calendar-push) * -1) 0" },
  },
  // The ring a demo's stand-in cursor leaves where it clicked. A real
  // cursor makes no such mark — this one has to, because the pointer is
  // the only thing on screen that ISN'T under the visitor's hand, and a
  // press that only dips the arrow by a few pixels reads as a glitch
  // rather than as a click. It opens from under the cursor's tip and is
  // gone before the next stop.
  demoCursorTap: {
    from: { opacity: 0.6, transform: "scale(0.35)" },
    to: { opacity: 0, transform: "scale(1)" },
  },

  // --- Weather (see the `weatherGraphic` recipe) ---------------------
  //
  // Every one of these is AMBIENT: it says what the sky does while the
  // weather is not changing. The change itself is a transition, never a
  // keyframe, which is what lets a state swap interrupt the idle motion
  // mid-cycle instead of queueing behind it.
  //
  // They all animate `transform` or `opacity` on a node whose PARENT
  // owns the state, so the two never contend for one property: the
  // parent places and gates the layer, the child moves inside it.

  // A clear sky's corona, turning slowly enough that you notice it has
  // moved rather than watch it move. Ninety seconds is the whole point —
  // a spin you can follow reads as a loading spinner.
  weatherPlasmaSpin: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
  // The glow around a clear sun or moon, breathing. Scale and opacity
  // move together and only slightly: the edge of this disc is 25px of
  // blur, so a 4% swell is a soft bloom rather than a pulse.
  weatherHaloBreathe: {
    "0%, 100%": { transform: "scale(1)", opacity: 0.85 },
    "50%": { transform: "scale(1.04)", opacity: 1 },
  },
  // A cloud deck is never quite still. The distance is a variable rather
  // than a number because it belongs to the CONDITION — fog wanders,
  // cloudy barely stirs, and a clear sky's parked cloud must not drift
  // in the wings where it can be seen creeping past the frame edge.
  weatherCloudDrift: {
    from: { transform: "translateX(calc(var(--wx-drift) * -1))" },
    to: { transform: "translateX(var(--wx-drift))" },
  },
  // One drop's fall, from just under the cloud to the bottom of its run.
  //
  // It leaves the cloud BLURRED and resolves on the way down. A drop is
  // in the deck's diffuse underside for the first stretch of its fall —
  // the same place the cloud's own progressive blur has dissolved the
  // cloud — so a drop that is hard-edged from the first frame reads as
  // being pasted in front of the cloud rather than as having come out of
  // it. By a third of the way down it is in open air and crisp.
  //
  // It fades in on the same stretch, for the same reason: a drop that
  // pops into existence at full strength reads as a glitch on the
  // cloud's underside.
  //
  // It falls DOWN AND TO THE LEFT, along the axis the drop is drawn on
  // rather than straight down. Figma leans the drop 15° off vertical —
  // its own gradient runs 112.9,147.1 → 108.3,164.4, which is
  // atan(4.659 / 17.386) exactly — and a shape that leans one way while
  // travelling another reads as a drop that is sliding rather than
  // falling. The lateral component is the vertical one times tan 15°, so
  // the two cannot drift apart: 11.2% of travel, 3.0% of drift.
  //
  // Distances are percentages of the frame, not pixels, because the fall
  // runs on the layer's own root <svg> — see the note on WEATHER_UNIT —
  // and a pixel there would not scale with the drawing.
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
  // Snow does what rain does not: it drifts sideways. The lateral wander
  // is why each flake carries its own duration — three flakes swaying on
  // one clock is a metronome, not weather. It clears the cloud on the
  // same terms a raindrop does.
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
  // The flake's turn, on its own node: the fall above owns `transform`
  // on the layer root (where the blur has to live), and a rotation there
  // would spin the whole frame about its middle rather than the flake
  // about its own.
  weatherSnowSpin: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(180deg)" },
  },
  // A strike: two flashes a beat apart, then a long dark wait. The
  // double blink is what makes it read as lightning — a single clean
  // fade in and out reads as a lamp on a timer.
  //
  // It sits a third of the way in rather than at the top, and the clock
  // it is a third OF starts when the storm does (see `--wx-strike-name`).
  // Between them the bolt lands ~1.5s after the deck arrives: late
  // enough that the clouds have finished travelling, early enough to be
  // the middle of the time anyone holds on this condition. Fired at the
  // top it would strike into a sky still moving; left unsynchronised it
  // fired wherever it happened to land, and a storm whose bolt arrives
  // at the end spends most of its life looking like plain rain.
  //
  // The bolt AND the light it throws back into the cloud both ride this
  // one envelope, on `--wx-strike`. They used to have a keyframe each,
  // the glow decaying a beat slower on the theory that it was softer —
  // which meant the cloud stayed lit for half a second after the bolt
  // had gone, and read as two events rather than one. Two things that
  // are the same event get one timeline; the glow is made softer by the
  // half-strength gate on `litCloud`, which is a matter of how bright it
  // is and not of when.
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
