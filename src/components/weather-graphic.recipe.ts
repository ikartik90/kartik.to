import { defineSlotRecipe } from "@pandacss/dev";

// -------------------------------------------------------------------
// weatherGraphic — the eleven-variant weather illustration (Figma
// 1995:24), drawn as ONE scene rather than eleven pictures.
//
// Nothing here mounts or unmounts. Every layer the whole component set
// uses — sun, moon, halo, plasma corona, both clouds, raindrops,
// snowflakes, bolt — is in the DOM in every state, and a state change
// moves, re-tints, blurs and fades what is already on screen. That is
// the entire reason the recipe is shaped as a wall of custom
// properties: `weather` writes ~20 numbers on the root, the slots hold
// the arrangement those numbers describe, and CSS interpolates between
// any two states for free. Clear → cloudy is a cloud travelling in
// from off-frame while it fades up; cloudy → fog is that same cloud
// walking to the middle, growing, and dissolving from the bottom.
// Cross-fading eleven rendered SVGs would have given none of that.
//
// ONE ROOT <svg> PER LAYER, stacked as absolutely positioned boxes
// inside an HTML root, rather than one SVG holding everything. That is
// not a preference — WebKit does not apply CSS `filter` FUNCTIONS to
// SVG child elements, at all and without warning, so a `blur()` on a
// <g> or a <path> renders in Chrome and Firefox and is simply absent in
// Safari. Every blur, glow and the whole progressive dissolve came out
// as hard-edged shapes there. The `<svg>` root is a CSS box and does
// take them, so each layer owns one. Blurs are therefore in CSS pixels
// rather than viewBox units, and `WEATHER_UNIT` (0.4cqw, off the
// root's `container-type`) is what puts them back on the graphic's own
// scale.
//
// TWO ELEMENTS PER MOVING THING, always: the parent owns the STATE
// (transform, presence) on a transition, the child owns the AMBIENT
// motion (falling, spinning, drifting, flashing) on a keyframe
// animation. They never touch the same property, so a weather change
// lands mid-drift without a jump and the idle loop keeps its phase.
// The same discipline forbids two slots on one element: `transition`
// is a shorthand, so the second one silently takes the whole property
// and the layer loses either its travel or its fade.
//
// The one effect that is not a plain `blur()` is Cloud Big's, and that
// is the point of it: the Fog and precipitation variants dissolve the
// cloud toward its underside so the deck reads as having no floor. It
// is built as four masked copies at four blur depths that ADD — see
// CLOUD_BLUR_BANDS in src/data/weather-geometry.ts for why adding
// rather than stacking is what keeps the soft bottom edge from growing
// a bright halo — and the whole ramp is driven off ONE variable, so it
// melts continuously from cloudy's hard edge to fog's smoke.
//
// `time` is an independent axis and stays live even where it cannot be
// seen: the sun and moon cross-fade behind an overcast sky so that
// rain → clear at 2am reveals a moon, not a sunrise (see
// src/domain/weather.ts).
// -------------------------------------------------------------------
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
      // What makes `WEATHER_UNIT` mean anything: 100cqw is the
      // graphic's own width, so a blur written in cqw scales with it
      // instead of staying the same number of screen pixels at every
      // size.
      containerType: "inline-size",
      // The cloud's blur rungs add rather than stack (`plus-lighter`).
      // Without a stacking context here they would add into whatever
      // the graphic happens to be sitting on.
      isolation: "isolate",

      // ONE clock for the whole scene. Two layers arriving on
      // different durations read as two separate events; the cloud and
      // the sun it is covering have to be the same gesture.
      //
      // 900ms is deliberately unhurried: weather is the one thing on a
      // page that is allowed to take its time, and the travel is long
      // (a cloud crosses a third of the frame). The fade runs shorter
      // so a layer is at full strength before it stops moving, rather
      // than still resolving after it has parked.
      "--wx-travel": "900ms",
      "--wx-fade": "620ms",
      // The glows fade on their own clock, and it is the TRAVEL clock
      // with a symmetric ease rather than the fade's.
      //
      // `--wx-ease` is an emphasized decelerate — 45% done by 100ms,
      // 78% by 200ms — which is right for something ARRIVING at a
      // place and wrong for something dissolving. A wide soft glow
      // loses its visible strength in the first fifth of that curve
      // and is gone while the clouds still have two thirds of their
      // journey left, so the sky reads as having snapped rather than
      // cleared. Air has no arrival to decelerate into: it thins out
      // evenly, over the whole gesture.
      "--wx-glow": "900ms",
      // A REAL decelerate. The previous curve — cubic-bezier(0.32,
      // 0.72, 0, 1) — is nominally an ease-out and behaves like a
      // snap: 66% of the travel goes by in the first fifth of the
      // time and 85% in the first third, so a cloud crossed most of
      // its distance at once and then crept the last few pixels. It
      // read as arriving abruptly and settling rather than as easing
      // in. easeOutCubic spends 49% / 66% / 87% at the same marks,
      // which is the same gesture actually spread across its own
      // duration.
      "--wx-ease": "cubic-bezier(0.33, 1, 0.68, 1)",

      // Floors, so no slot can ever read an unset variable — a missing
      // `--wx-drift` would make `translateX()` invalid and silently
      // drop the whole transform, not just the drift.
      // One viewBox unit, as a share of the graphic's own width. See
      // WEATHER_UNIT in src/data/weather-geometry.ts for why the blurs
      // are measured this way rather than in pixels.
      "--wx-unit": "0.4cqw",
      "--wx-drift": "0px",
      // One clock for the strike and for the cloud it lights, so the
      // two cannot be tuned apart.
      "--wx-strike": "4.6s",
      "--wx-strike-name": "none",
      "--wx-k": "0",
      "--wx-orb-base": "0",
      "--wx-cloud-shadow": "0",
      "--wx-cloud-big-base": "0",

      // The global reset in globals.css collapses every animation to
      // 0.01ms and one iteration, which lands each of these on its
      // LAST keyframe — and the last keyframe of a fall or a flash is
      // the moment the thing has GONE. Left to that reset alone, a
      // reduced-motion visitor gets rain with no drops, snow with no
      // flakes and a thunderstorm with no lightning: three conditions
      // collapsed into one identical grey cloud.
      //
      // Dropping the animation outright instead returns each layer to
      // its base, which is the position Figma drew it in — a STILL of
      // the weather rather than the frame after it ended. That is what
      // a request for less movement asks for; less information is not
      // part of the bargain.
      "@media (prefers-reduced-motion: reduce)": {
        "& [data-wx-ambient]": { animation: "none" },
        // The one layer whose resting state is not simply its base:
        // the cloud's inner light exists only while the bolt is out,
        // so a still of a thunderstorm has to light it deliberately.
        "& [data-wx-ambient='lit']": { opacity: 1 },
        // The strike's gate rests lit rather than dark, so a still of
        // a thunderstorm is a cloud with light under it.
      },
    },

    // Every layer is the same box: the whole frame, stacked in source
    // order. `overflow: visible` because the drawing's softest parts —
    // a clear day's halo is 100 units of radius plus 12.5 of blur —
    // reach past the artboard on purpose.
    layer: {
      position: "absolute",
      inset: 0,
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      overflow: "visible",
      pointerEvents: "none",
      // Every layer gets its own compositing layer, and this one is
      // load-bearing rather than a performance hint.
      //
      // A filtered layer whose content or placement changes is
      // repainted a REGION at a time, and the region the browser
      // works out does not cover where the blur reaches — so a
      // transition leaves a soft-edged rectangle of the old sky
      // sitting in the new one, worst where the blur is widest (fog's
      // ten units) and where several rungs are being added together.
      // Promoted, each layer is recomposited whole and there is
      // nowhere for a stale region to hide.
      //
      // Established by bisection against a VIDEO capture rather than
      // screenshots: a screenshot forces a full repaint, which is
      // exactly the thing that hides this. The same capture ruled out
      // every individual layer (the artefact survives hiding each one)
      // and confirmed the additive blending is not at fault — turning
      // `plus-lighter` off leaves the artefact AND brings back the
      // banding seams it exists to remove.
      willChange: "transform",
    },

    // --- The sun / moon ------------------------------------------
    // Day only — Figma gives the night sky no corona, so it fades out
    // with the sun rather than being re-tinted.
    //
    // The layer holds a plain gradient-filled RECT, masked by the star
    // — the shape does not carry its own paint. That indirection is
    // what lets the corona turn without its colours turning with it:
    // rotate a gradient-filled path and the gradient goes round with
    // it, so the pink lobe walks away from the sun's pink and the two
    // stop agreeing about where the light is coming from. Here the
    // MASK turns and the paint stands still.
    //
    // It also keeps the corona out of the repaint bug that a rotating
    // path caused. The filtered element is the rect, whose bounding
    // box never changes, so the filter region is computed once; a
    // rotating path's box oscillates, the region is recomputed every
    // frame, and what the blur painted outside the new one is left
    // behind — the corona slowly grew a set of faint rectangles around
    // itself, worse the longer it turned.
    plasma: {
      opacity: "calc(var(--wx-plasma) * var(--wx-day) * 0.5)",
      filter: "blur(calc(7.5 * var(--wx-unit)))",
      // On the glow clock with the halo — the two are one glow and
      // must not thin at different rates. See `--wx-glow`.
      transition: "opacity var(--wx-glow) ease-in-out",
    },
    plasmaSpin: {
      transformBox: "view-box",
      transformOrigin: "125px 125px",
      animation: "weatherPlasmaSpin 90s linear infinite",
    },
    // Figma states a 50-unit DILATE on a drop shadow blurred by 12.5 —
    // a spread CSS `drop-shadow()` cannot express. A disc of the
    // dilated radius (50 + 50) under the same blur is the same
    // picture, and unlike a shadow it can breathe.
    //
    // The gate is its own node because `weatherHaloBreathe` rides
    // opacity, and an animation OUTRANKS the declaration it shares a
    // property with — gated on the same node, the halo stayed lit at
    // ~0.95 through every condition that has no halo at all, glowing
    // behind cloudy and fog.
    // Carries the body's PLACEMENT as well as the gate, because it is
    // the one node here without a filter on it. Anything that moves
    // inside a filtered element makes the browser re-rasterize the
    // blur, and what it painted outside the new damage rect stays on
    // screen — see `orbLayer`.
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
    // Breathes on the LAYER, for the same reason the corona turns on
    // one — see `plasma`. A scale animating inside a filtered element
    // re-rasterizes the blur every frame and leaves damage behind it.
    halo: {
      // Figma's dilate is 50 on a 50 sun (a 100 disc) blurred by 12.5,
      // which spills past the 250 artboard on every side — a Gaussian
      // reaches roughly two and a half sigma, so the visible edge lands
      // at ~131 from a centre 125 from the frame. Figma clips it and
      // so did this, and the cut showed. Pulled in just far enough to
      // sit inside the frame at the top of its breath instead: the
      // glow now ENDS rather than being cut off, and the graphic stops
      // painting over whatever it is placed beside.
      filter: "blur(calc(12 * var(--wx-unit)))",
      transformOrigin: "center",
      animation: "weatherHaloBreathe 9s ease-in-out infinite",
    },
    haloDisc: {
      fill: "var(--wx-halo-color)",
      transition: "fill var(--wx-fade) linear",
    },
    // The body is a STACK, on the same terms as the cloud: four copies
    // at four blur depths, masked into bands that sum to 1 and added
    // together. Haze is what it is for — a sky that thickens toward
    // the horizon leaves the sun defined along its crown and dissolved
    // underneath, and an evenly blurred disc reads instead as a
    // photograph out of focus. Every other condition sets the ramp to
    // zero, at which point all four rungs carry the same blur and the
    // partition costs nothing but the copies.
    orb: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-orb-opacity)",
      isolation: "isolate",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // The sun and the moon get a stack EACH, cross-faded here — one
    // level above the filters rather than as two circles inside them.
    //
    // That is what stops a day/night flip leaving a rectangle behind
    // it. An opacity animating inside a filtered element makes the
    // browser re-rasterize the blur every frame, and the damage rect
    // does not cover the blur's tail; at fog's 10-unit blur the
    // leftovers are a hard-edged square of the old sky sitting in the
    // new one. Up here the filters' input never changes at all — the
    // cached result is composited at a different opacity.
    //
    // `plus-lighter` because the two are complementary: added, a
    // half-and-half moment is the two colours blended at full alpha,
    // where compositing them normally dips the disc to 75% opaque
    // halfway through every sunrise.
    orbBody: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-body)",
      mixBlendMode: "plus-lighter",
      isolation: "isolate",
      // `linear`, and it is load-bearing rather than an oversight. The
      // two bodies are ADDED, so their opacities have to sum to 1 at
      // every instant or the disc brightens and dims its way through
      // each sunrise. Only a linear pair does that.
      transition: "opacity var(--wx-fade) linear",
    },
    // Placement is on the LAYER, for the same reason: a `<g>` moving
    // inside the blur is the other half of that artefact, and it is
    // the one an overcast → fog change trips, since the body walks and
    // shrinks as the cloud takes the middle. Out here the layer's
    // whole filtered result is moved as a unit.
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
    // What a cloud does to the sun BEHIND it. Figma states this as a
    // background blur, which SVG has no access to (there is no
    // BackdropImage), so it is computed instead: a second copy of the
    // body under more blur, masked to the clouds' silhouette and
    // painted between the two.
    //
    // A mask rather than a clip path because WebKit ignores a CSS
    // transform on a clip path's children — the clip would stay at the
    // cloud's canonical position while the cloud walked away from it.
    // `mask-position` and `mask-size` animate, so the mask travels on
    // the same clock the cloud does. The images themselves are set
    // inline from the SAME path constants the clouds are drawn from
    // (see CLOUD_BIG_MASK); quoting the paths again here is the one
    // duplication this component cannot afford.
    // --- Clouds ---------------------------------------------------
    // The wrapper the ambient wander lives on, so the layer's own
    // `transform` is free to be the state. Drift is measured in FRAME
    // units, not the cloud's own, so a half-scale cloud wanders as far
    // as a full-scale one rather than half as far.
    drift: {
      position: "absolute",
      inset: 0,
      animation: "weatherCloudDrift 19s ease-in-out infinite alternate",
    },
    cloudSmall: {
      opacity: "var(--wx-cloud-small-opacity)",
      filter: "blur(calc(var(--wx-cloud-small-blur) * var(--wx-unit)))",
      // A layer's own box is the whole frame, so a translation of N
      // viewBox units is N/250 of it — the same `WEATHER_UNIT`
      // relationship the blurs use, in percent.
      transformOrigin: "0 0",
      transform:
        "translate(calc(var(--wx-cloud-small-x) * 0.4%), calc(var(--wx-cloud-small-y) * 0.4%)) scale(var(--wx-cloud-small-scale))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), filter var(--wx-travel) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // No ramp on this one: Figma blurs it evenly, and a cloud this
    // small has no underside to lose.
    cloudSmallShape: { opacity: 0.75 },
    // Presence, kept apart from the fill's translucency below: one
    // says whether there is a cloud, the other how solid it is, and
    // fog changes only the second.
    cloudBig: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-cloud-big-opacity)",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // Figma's drop shadow, drawn as an offset blurred copy rather than
    // a `filter` on the group — the group is a stack of blurs, and a
    // filter over it would give them a region to be clipped by. The
    // bottom of that stack is precisely what must not be clipped.
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
      // Contains the rungs' additive blending, so they sum the cloud
      // against itself rather than against the page behind it.
      isolation: "isolate",
      transition: "opacity var(--wx-fade) var(--wx-ease)",
    },
    // One rung of the progressive blur. `--wx-k` is the rung's share
    // of the ramp and is written inline per copy; the ramp's DEPTH and
    // its uniform FLOOR are the shared variables, which is what makes
    // the dissolve one interpolating value rather than four that must
    // agree.
    //
    // `plus-lighter` is load-bearing, not a flourish. The rungs are
    // masked into bands that sum to 1, so ADDING them yields a true
    // weighted blend between blur levels. Compositing them normally
    // instead accumulates alpha wherever two blurred copies overlap —
    // which is the whole soft bottom edge — and the cloud grows a
    // bright halo exactly where it should be dissolving.
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
    // The bolt's light inside the cloud, masked to the cloud rather
    // than clipped to it, for the same WebKit reason as the frosting.
    // Here the mask needs no travel of its own: this layer carries the
    // cloud's transform, so the shape underneath it is already at the
    // canonical position the mask is drawn at.
    // The flash is on a div OUTSIDE the layer, so the blurred glow is
    // rasterized once and only its opacity moves. Animated inside, it
    // is the same re-rasterization the body's cross-fade was.
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
      // Figma's stated 50% for the cloud's inner shadow.
      opacity: "calc(var(--wx-bolt) * 0.5)",
      filter: "blur(calc(7 * var(--wx-unit)))",
      // TWO mask layers, intersected: the cloud's silhouette and the
      // part of it a strike from below can reach. See CLOUD_LIT_MASK.
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
    // A very wide stroke on the cloud's own outline, masked to the
    // shape it is stroking so only the inward half survives — light
    // banked against the inside of the cloud's underside.
    //
    // A FILL was tried here and is wrong, however evenly it lights the
    // lower half. A fill knows nothing about the cloud's shape, so its
    // top edge is wherever the mask's gradient puts it: a straight
    // horizontal line ruled across a round object, legible as a line
    // no matter how gently the gradient fades. A stroke follows the
    // outline, so the light curves up the flanks the way the cloud
    // does and there is no edge in it to see.
    //
    // Twenty is wide because only half of it is inside the silhouette
    // and the layer's blur spreads that inward half further still —
    // between them the light reaches about far enough to fill the
    // bottom lobe, rather than drawing a bright rim around it.
    innerGlow: {
      fill: "none",
      stroke: "token(colors.sky.boltGlow)",
      strokeWidth: "20",
    },

    // --- Precipitation --------------------------------------------
    //
    // Each drop and each flake is its OWN root <svg>, not a node inside
    // a shared one, because the fall now carries a blur that clears as
    // the drop leaves the cloud — and a blur only exists on a root in
    // Safari. The gate above them is therefore a plain div.
    rain: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-rain)",
      transformOrigin: "0 0",
      transform: "translate(0, calc(var(--wx-precip-y) * 0.4%))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // 1.65s is the fall; the three delays that stagger it are the
    // drops' own (see RAINDROPS). Eased INTO the ground rather than
    // out of the cloud — a drop accelerates.
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
    // The turn, split off the fall: the fall owns `transform` on the
    // layer root, where the blur has to be, so the rotation needs a
    // node of its own — and `fill-box` there is what lets a flake spin
    // about its own middle wherever Figma happened to place it, with
    // no measured origin per glyph.
    flakeSpin: {
      transformBox: "fill-box",
      transformOrigin: "center",
      animation: "weatherSnowSpin var(--wx-flake) linear infinite",
    },

    // --- The bolt --------------------------------------------------
    bolt: {
      position: "absolute",
      inset: 0,
      opacity: "var(--wx-bolt)",
      transformOrigin: "0 0",
      transform: "translate(0, calc(var(--wx-precip-y) * 0.4%))",
      transition:
        "opacity var(--wx-fade) var(--wx-ease), transform var(--wx-travel) var(--wx-ease)",
    },
    // Named through a VARIABLE, which is the whole mechanism: only
    // thundershower sets `--wx-strike-name`, so the animation does not
    // exist in any other condition and is CREATED — at time zero — the
    // moment the storm arrives. A strike that simply ran forever was
    // in an arbitrary phase by the time anyone looked at it.
    //
    // `opacity: 0` is the resting value that goes with that: with no
    // animation the element would otherwise sit at full strength, and
    // the bolt would blaze on its way out of every storm.
    boltFlash: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      animationName: "var(--wx-strike-name)",
      animationDuration: "var(--wx-strike)",
      animationTimingFunction: "ease-out",
      animationIterationCount: "infinite",
    },
    // The light the strike throws, which is soft along the bolt's
    // whole length — a glow is a glow, and the free end of a real bolt
    // is the brightest part of it. This is NOT the bolt being blurred;
    // that is the core below, and it is deliberately kept apart so one
    // can be ramped without taking the other with it.
    boltBloom: {
      opacity: 0.7,
      filter: "blur(calc(12 * var(--wx-unit)))",
    },
    boltCoreStack: {
      position: "absolute",
      inset: 0,
      isolation: "isolate",
    },
    // The bolt itself, blurred at the crown and hard-edged for the two
    // thirds below it — the head is inside the deck, the rest is in
    // open air with the raindrops. Same additive band stack as the
    // cloud, ramped the other way up; see BOLT_BLUR_BANDS.
    boltCore: {
      filter: "blur(calc(var(--wx-k) * 5 * var(--wx-unit)))",
      mixBlendMode: "plus-lighter",
      maskRepeat: "no-repeat",
    },
  },

  variants: {
    // Where every layer stands, how blurred, how solid. The parked
    // positions matter as much as the visible ones: a layer that is
    // invisible in this condition still has to be SOMEWHERE sensible,
    // because that is where it travels from when the weather turns.
    // The clouds park a SHORT way off their seats, on OPPOSITE sides
    // — the small one to the left of its, the big one to the right of
    // its, both at the height they will settle at — so clear → cloudy
    // is two clouds fading up as they drift the last little way in,
    // converging on the sun from either side.
    //
    // Twenty units, not the frame's edge. Parked off-artboard they had
    // a third of the frame to cross in the same 900ms, and a cloud
    // that has to cover that much ground in that time is a cloud
    // being FLUNG into place: the eye tracks the motion and the fade
    // never registers. The travel is now short enough that the fade is
    // the thing you notice and the drift is what makes it feel like
    // weather rather than a cross-dissolve.
    //
    // The sun and the moon do NOT park. They hold the middle of the
    // frame through clear, cloudy, haze and all three overcast
    // conditions, and move only for fog — the one variant where the
    // cloud takes the centre and the body has to step aside for it.
    // Everywhere else the body is the fixed thing the weather happens
    // in front of, so cloud cover arriving must not shove it sideways.
    weather: {
      clear: {
        root: {
          "--wx-orb-x": "125",
          "--wx-orb-y": "125",
          "--wx-orb-scale": "1",
          // Half a unit, not none. A hard-edged disc is the one
          // shape in the set with nothing softening it, and against
          // the corona behind it the aliasing on the circumference is
          // the only place the drawing looks drawn rather than lit.
          // In viewBox units, so it stays half a pixel at Figma's 250
          // artboard and grows with the graphic like every other blur
          // here.
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
          // No shadow under a cloudy sky. Figma draws one, and on the
          // half-scale cloud it reads as a smudge of dirt beside a
          // small shape rather than as depth — there is a bright sun
          // immediately behind it, which is the one background a 20%
          // blue-grey blur has nothing to offer. `clear` and `haze`
          // drop it too, since that is where the cloudy clouds arrive
          // from and it would otherwise flash on mid-slide.
          // Clear and haze carry the shadow too, even though their
          // cloud is invisible: a shadow that had to fade up
          // separately would arrive behind its own cloud.
          //
          // Figma actually draws THIS one lighter than the
          // precipitating deck's — 10% black against their 20% blue —
          // which is what the per-condition variable is here for. Held
          // at the deck's weight for now because a shadow you have to
          // look for is not obviously better than no shadow.
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.5",
          "--wx-cloud-small-x": "40.99",
          "--wx-cloud-small-y": "54.25",
          "--wx-cloud-small-scale": "0.5",
          "--wx-cloud-small-blur": "0.5",
          "--wx-cloud-small-opacity": "1",
          // The only condition whose clouds are lit white rather than
          // grey — they have a sun immediately behind them.
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
          // The only condition with a ramp. The crown keeps just
          // enough edge to read as a disc; by the underside it has
          // gone into the air around it.
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
          // The deepest ramp in the set: this is the condition the
          // progressive blur exists for. Soft along the crown already,
          // and gone entirely by the underside.
          "--wx-cloud-big-blur": "14",
          "--wx-cloud-shadow": "0.2",
          "--wx-cloud-big-opacity": "1",
          "--wx-cloud-big-fill": "0.75",
          // Parked inside the big cloud's left shoulder, so it
          // disappears INTO the deck rather than off the frame.
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
          // Figma nudges the whole deck up 4 units here (and 2 in
          // snow) to make room for the bolt, and that nudge is
          // deliberately NOT reproduced. Between three conditions that
          // are all the same overcast sky, a cloud that hops a few
          // units every time the precipitation changes reads as the
          // drawing being swapped rather than as the weather turning —
          // which is the one thing this component exists to avoid. The
          // three now differ ONLY in what is falling out of them, so
          // rain → thundershower is a bolt striking a cloud that has
          // not moved.
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

    // Independent of `weather` on purpose — see the note at the top.
    // Two numbers and a colour: the sun and moon are the same circle
    // under two fills, so the whole day/night axis is a cross-fade.
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

  // The condition is chosen at RUNTIME from a prop, so the extractor
  // never sees the variants written as literals — without this only
  // whichever ones happen to appear in a demo page would be emitted.
  // Same trap `linkCard` and `demoFrameDemoArea` sprang.
  staticCss: [{ weather: ["*"], time: ["*"] }],
});
