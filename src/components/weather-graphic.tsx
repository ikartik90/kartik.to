"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { cx } from "../../styled-system/css";
import { weatherGraphic } from "../../styled-system/recipes";
import {
  BOLT_BLUR_BANDS,
  CLOUD_BIG_MASK,
  CLOUD_BIG_PATH,
  CLOUD_BLUR_BANDS,
  CLOUD_LIT_MASK,
  CLOUD_SMALL_PATH,
  LIGHTNING_PATH,
  PLASMA_GLOW_PATH,
  RAINDROPS,
  RAINDROP_PATH,
  SNOWFLAKES,
  ORB_CENTRE,
  ORB_RADIUS,
  WEATHER_VIEWBOX,
  boltBandMask,
  cloudBandMask,
  orbBandMask,
} from "@/data/weather-geometry";
import {
  weatherLabel,
  weatherVariantName,
  type TimeOfDay,
  type WeatherCondition,
} from "@/domain/weather";

// ---------------------------------------------------------------------------
// WeatherGraphic — the eleven variants of Figma 1995:24 as one drawing that
// changes its mind.
//
// The component's whole job is to make sure NOTHING is ever conditionally
// rendered. Every shape in the kit — sun, moon, corona, halo, both clouds,
// three drops, three flakes, the bolt — is in the tree in every condition, and
// the `weatherGraphic` recipe moves, tints, blurs and fades them from one
// arrangement into the next. That is what buys the transitions: clear → cloudy
// is a cloud that was already parked off-frame sliding in as it fades up, and
// cloudy → fog is that same cloud walking to the centre, growing to full size
// and dissolving from the bottom. Swapping eleven flattened SVGs — which is
// what Figma's export hands you — can only ever cross-fade.
//
// It is a STACK OF ROOT <svg> ELEMENTS rather than one SVG scene, and that is
// forced rather than chosen: WebKit does not apply CSS `filter` functions to
// SVG child elements, so a `blur()` on a <g> or a <path> renders in Chrome and
// Firefox and is silently absent in Safari — every blur, glow and the whole
// progressive dissolve came out as hard-edged shapes there. An <svg> root is a
// CSS box and does take them. One layer per box, therefore, and shapes that
// share a blur share a box.
//
// Read the arrangement in panda.config.ts (`weatherGraphic`); read the shapes
// in src/data/weather-geometry.ts. What is left here is assembly and the one
// thing neither of those can own: id namespacing.
//
// EVERY id is per-instance, because a page that shows more than one of these
// (the demo grid shows eleven) would otherwise have all of them resolving
// `url(#...)` to the FIRST instance's defs — and those defs are what the whole
// drawing is coloured with.
// ---------------------------------------------------------------------------

export interface WeatherGraphicProps {
  condition: WeatherCondition;
  /**
   * Day or night. Ignored by the drawing under an overcast sky, but still
   * honoured underneath it, so the body revealed when the weather clears is
   * the right one. See src/domain/weather.ts.
   */
  time?: TimeOfDay;
  /**
   * The accessible name. Defaults to the condition; pass `null` where the
   * graphic sits beside text that already says what the weather is, and it
   * goes decorative rather than repeating it.
   */
  label?: string | null;
  className?: string;
}

/**
 * One layer of the drawing: a root `<svg>` filling the whole frame.
 *
 * A root, not a `<g>`, and that is the load-bearing detail — see the note at
 * the top. Everything each layer needs from the recipe arrives as a class, so
 * the box itself knows nothing about the weather.
 */
function Layer({
  base,
  className,
  style,
  layer,
  ambient,
  children,
}: {
  base: string;
  className: string;
  style?: CSSProperties;
  layer?: string;
  /** Marks a root whose own animation is ambient, for the reduced-motion rest. */
  ambient?: boolean;
  children: ReactNode;
}) {
  return (
    <svg
      className={cx(base, className)}
      style={style}
      viewBox={`0 0 ${WEATHER_VIEWBOX} ${WEATHER_VIEWBOX}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden
      {...(layer ? { "data-layer": layer } : {})}
      {...(ambient ? { "data-wx-ambient": "" } : {})}
    >
      {children}
    </svg>
  );
}

export function WeatherGraphic({
  condition,
  time = "day",
  label,
  className,
}: WeatherGraphicProps) {
  const slot = weatherGraphic({ weather: condition, time });

  // React's own id, stripped to what an SVG fragment identifier may hold —
  // `useId` returns delimiters (`:r0:` / `«r0»`) that a `url(#…)` reference
  // cannot carry.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `wx-${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

  const decorative = label === null;

  // The sun and the moon are the same circle under two fills, and they are now
  // drawn as two SEPARATE stacks rather than as two circles cross-fading
  // inside one. Nothing inside a filtered layer may change — see the `orbBody`
  // slot — so the cross-fade happens a level up, on `--wx-body`.
  const BODIES = [
    { key: "sun", fade: "var(--wx-day)" },
    { key: "moon", fade: "var(--wx-night)" },
  ] as const;

  const disc = (body: string) => (
    <circle
      cx={ORB_CENTRE}
      cy={ORB_CENTRE}
      r={ORB_RADIUS}
      fill={ref(body)}
    />
  );

  return (
    <div
      className={cx(slot.root, className)}
      data-variant={weatherVariantName(condition, time)}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label ?? weatherLabel(condition) })}
    >
      {/* The gradients every layer paints with, declared once per instance
          rather than once per layer — a `url(#…)` reference resolves
          document-wide, so each layer can reach them from its own root. */}
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {/* Presentation attributes cannot hold a `var()`; an inline style
              can, and is a CSS declaration wherever it appears. That is what
              lets these stops read design tokens — and lets the cloud's top
              stop TRANSITION when the weather turns. */}
          <linearGradient id={id("sun")} x1="0" y1="0" x2="0.5" y2="1">
            <stop style={{ stopColor: "var(--colors-brand-pink)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-brand-orange)" }}
            />
          </linearGradient>
          {/* The moon is radial and off-centre: cream through most of the
              disc, turning periwinkle only at the far rim, which is what stops
              it reading as a flat yellow circle. */}
          <radialGradient
            id={id("moon")}
            cx="0"
            cy="0"
            r="1"
            gradientTransform="rotate(45) scale(1.41421 1.21493)"
          >
            <stop
              offset="0.6"
              style={{ stopColor: "var(--colors-sky-moon-core)" }}
            />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-moon-rim)" }}
            />
          </radialGradient>
          {/* The corona is the site's own gradient, put in the sky. Stated
              across the whole FRAME (Figma's 50,50 → 125,200 over a 250 box)
              rather than across the star, because it paints a full-frame rect
              that the star is masked out of — see the `plasma` slot. */}
          <linearGradient id={id("plasma")} x1="0.2" y1="0.2" x2="0.5" y2="0.8">
            <stop style={{ stopColor: "var(--colors-brand-pink)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-brand-orange)" }}
            />
          </linearGradient>
          <linearGradient id={id("cloud-big")} x1="0" y1="0" x2="0.5" y2="1">
            <stop style={{ stopColor: "var(--wx-cloud-top)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-cloud-deep)" }}
            />
          </linearGradient>
          <linearGradient id={id("cloud-small")} x1="1" y1="0" x2="0.5" y2="1">
            <stop style={{ stopColor: "var(--colors-sky-cloud-light)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-cloud-deep)" }}
            />
          </linearGradient>
          <linearGradient id={id("drop")} x1="0.69" y1="0" x2="0.37" y2="0.94">
            <stop style={{ stopColor: "var(--colors-sky-drop-light)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-drop-deep)" }}
            />
          </linearGradient>
          <linearGradient id={id("flake")} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop style={{ stopColor: "var(--colors-sky-drop-light)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-flake-deep)" }}
            />
          </linearGradient>
          <linearGradient
            id={id("bolt")}
            x1="0.744"
            y1="-0.034"
            x2="0.208"
            y2="1.02"
          >
            <stop
              offset="0.245"
              style={{ stopColor: "var(--colors-sky-bolt-core)" }}
            />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-sky-bolt-edge)" }}
            />
          </linearGradient>
        </defs>
      </svg>

      {/* --- Sky ---------------------------------------------------------- */}
      {/* The star is a MASK over a gradient-filled rect, not a gradient-filled
          path. Turning a path turns its paint with it, and the corona's pink
          would walk away from the sun's; here the mask turns and the colours
          stay where the sun's are. It also keeps the filter looking at a
          rectangle whose box never changes — see the `plasma` slot for what a
          rotating box does to the repaint. */}
      <Layer base={slot.layer} className={slot.plasma} layer="plasma">
        <defs>
          <mask
            id={id("plasma-star")}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={WEATHER_VIEWBOX}
            height={WEATHER_VIEWBOX}
          >
            <path
              className={slot.plasmaSpin}
              data-wx-ambient=""
              d={PLASMA_GLOW_PATH}
              fill="#fff"
            />
          </mask>
        </defs>
        <rect
          width={WEATHER_VIEWBOX}
          height={WEATHER_VIEWBOX}
          fill={ref("plasma")}
          mask={ref("plasma-star")}
        />
      </Layer>

      {/* The halo breathes on its LAYER rather than on the disc inside it,
          for the repaint reason in the `plasma` slot: a scale animating inside
          a filtered element re-rasterizes the blur every frame. */}
      <div className={slot.haloGate} data-layer="halo">
        <Layer base={slot.layer} className={slot.halo} ambient>
          {/* 90, not Figma's 100 — see the `halo` slot: at Figma's radius the
              blur's tail runs past the artboard on every side. */}
          <circle
            className={slot.haloDisc}
            cx={ORB_CENTRE}
            cy={ORB_CENTRE}
            r="90"
          />
        </Layer>
      </div>

      {/* Four copies of each body at four blur depths, masked into bands that
          add up — the same construction as the cloud's underside, turned on
          the sun so haze can dissolve it from below instead of smearing the
          whole disc. Every other condition sets the ramp to zero, and the four
          rungs collapse to one uniform blur. */}
      <div className={slot.orb} data-layer="orb">
        {BODIES.map((body) => (
          <div
            key={body.key}
            className={slot.orbBody}
            data-layer={body.key}
            style={{ "--wx-body": body.fade } as CSSProperties}
          >
            {CLOUD_BLUR_BANDS.map((band, i) => (
              <Layer
                key={i}
                base={slot.layer}
                className={slot.orbLayer}
                style={
                  {
                    "--wx-k": band.blur,
                    maskImage: orbBandMask(band),
                  } as CSSProperties
                }
              >
                {disc(body.key)}
              </Layer>
            ))}
          </div>
        ))}
      </div>

      {/* There is no frosting layer, and Figma's background blur on the
          cloudy clouds is deliberately not reproduced. It was here, as a
          second more-blurred copy of the body masked to the clouds, and it is
          the wrong construction: a backdrop blur REPLACES what is behind the
          cloud, this painted OVER it. Inside the silhouette you therefore got
          the body twice, which is invisible once the two blurs are far apart
          and glaring while they are not — a cloud-shaped patch of doubled sun,
          drifting across the disc for the length of every transition into or
          out of cloudy.
          
          Making it correct means punching the body OUT where the cloud is and
          filling the hole, and a punch-out cannot fade — so it would have to
          apply in conditions whose cloud is parked over the sun but invisible.
          The cloud is half translucent and the sun shows through it either
          way; this only softened what shows. */}

      {/* --- Precipitation, behind the deck it falls from ------------------ */}
      {/* A flake per layer, not per path: the fall carries a blur that clears
          as the flake drops out of the cloud, and a blur only exists on a root
          <svg> in Safari. The turn rides a second node inside it, so the two
          never contend for `transform`. */}
      <div className={slot.snow} data-layer="snow">
        {SNOWFLAKES.map((flake, i) => (
          <Layer
            key={i}
            base={slot.layer}
            className={slot.flake}
            ambient
            style={
              {
                "--wx-flake": flake.duration,
                animationDelay: flake.delay,
              } as CSSProperties
            }
          >
            <path
              className={slot.flakeSpin}
              data-wx-ambient=""
              style={{ animationDelay: flake.delay }}
              d={flake.path}
              fill={ref("flake")}
            />
          </Layer>
        ))}
      </div>

      <div className={slot.rain} data-layer="rain">
        {RAINDROPS.map((drop, i) => (
          <Layer
            key={i}
            base={slot.layer}
            className={slot.drop}
            ambient
            style={{ animationDelay: drop.delay }}
          >
            {/* The instance offset is an ATTRIBUTE and the fall is CSS, on two
                different elements: a CSS `transform` on this node would
                replace the attribute outright and stack all three drops on the
                first one's peg. */}
            <g transform={`translate(${drop.x} ${drop.y})`}>
              <path d={RAINDROP_PATH} fill={ref("drop")} />
            </g>
          </Layer>
        ))}
      </div>

      {/* --- The deck ----------------------------------------------------- */}
      <div
        className={slot.drift}
        data-wx-ambient=""
        style={{ animationDelay: "-7s" }}
      >
        <Layer base={slot.layer} className={slot.cloudSmall} layer="cloud-small">
          <path
            className={slot.cloudSmallShape}
            d={CLOUD_SMALL_PATH}
            fill={ref("cloud-small")}
          />
        </Layer>
      </div>

      <div className={slot.drift} data-wx-ambient="">
        <div className={slot.cloudBig} data-layer="cloud-big">
          <Layer base={slot.layer} className={slot.cloudShadow}>
            <path d={CLOUD_BIG_PATH} fill="var(--colors-sky-cloud-shade)" />
          </Layer>
          <div className={slot.cloudBigStack}>
            {/* Four copies of one cloud at four blur depths, each masked to
                its own band and ADDED to the others. The bands partition the
                height, so what lands is a continuous ramp from the crown's
                blur to the underside's. */}
            {CLOUD_BLUR_BANDS.map((band, i) => (
              <Layer
                key={i}
                base={slot.layer}
                className={slot.cloudBigLayer}
                style={
                  {
                    "--wx-k": band.blur,
                    maskImage: cloudBandMask(band),
                  } as CSSProperties
                }
              >
                <path d={CLOUD_BIG_PATH} fill={ref("cloud-big")} />
              </Layer>
            ))}
          </div>
        </div>
      </div>

      {/* --- The strike --------------------------------------------------- */}
      <div className={slot.litGate} data-wx-ambient="lit">
        <Layer
          base={slot.layer}
          className={slot.litCloud}
          layer="lit-cloud"
          style={{ maskImage: `${CLOUD_BIG_MASK}, ${CLOUD_LIT_MASK}` }}
        >
          <path className={slot.innerGlow} d={CLOUD_BIG_PATH} />
        </Layer>
      </div>

      {/* The bloom is the light the strike throws and stays soft the whole way
          down; the core is the bolt itself and is blurred only at the crown,
          where it is still inside the deck. Below that it is as hard-edged as
          the raindrops beside it — a bolt blurred along its free end reads as
          a smear of light rather than as a strike, and the free end is the
          part a viewer actually reads. */}
      <div className={slot.bolt} data-layer="bolt">
        {/* Marked "lit" like the cloud's glow: with the animation dropped for
            reduced motion both rest at full strength, so a still of a
            thunderstorm has a bolt in it. */}
        <div className={slot.boltFlash} data-wx-ambient="lit">
          <Layer base={slot.layer} className={slot.boltBloom}>
            <path d={LIGHTNING_PATH} fill={ref("bolt")} />
          </Layer>
          <div className={slot.boltCoreStack}>
            {BOLT_BLUR_BANDS.map((band, i) => (
              <Layer
                key={i}
                base={slot.layer}
                className={slot.boltCore}
                style={
                  {
                    "--wx-k": band.blur,
                    maskImage: boltBandMask(band),
                  } as CSSProperties
                }
              >
                <path d={LIGHTNING_PATH} fill={ref("bolt")} />
              </Layer>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
