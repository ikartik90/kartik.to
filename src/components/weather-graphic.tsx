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

// Nothing is conditionally rendered: the recipe moves every shape between arrangements.
// Each layer is a root <svg> because WebKit ignores CSS filters on SVG children.

export interface WeatherGraphicProps {
  condition: WeatherCondition;
  /** Hidden under overcast skies but still honoured, so clearing reveals the right body. */
  time?: TimeOfDay;
  /** Defaults to the condition; `null` makes the graphic decorative. */
  label?: string | null;
  className?: string;
}

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
  /** Ambient animation, stilled for reduced motion. */
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

  // Per instance, or every `url(#…)` hits the first instance's defs; stripped of `useId`'s delimiters.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `wx-${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

  const decorative = label === null;

  // Two stacks cross-faded via `--wx-body`: nothing inside a filtered layer may change.
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
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {/* Inline styles, not attributes, so the stops can read tokens and transition. */}
          <linearGradient id={id("sun")} x1="0" y1="0" x2="0.5" y2="1">
            <stop style={{ stopColor: "var(--colors-brand-pink)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--colors-brand-orange)" }}
            />
          </linearGradient>
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
          {/* Across the whole frame: it paints a full-frame rect the star is masked out of. */}
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

      {/* A mask over a fixed rect, so the colours hold still and the filtered box never changes as the star turns. */}
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

      {/* Breathes on the layer: animating inside a filtered element re-rasterizes the blur every frame. */}
      <div className={slot.haloGate} data-layer="halo">
        <Layer base={slot.layer} className={slot.halo} ambient>
          {/* 90, not 100: at 100 the blur's tail runs past the artboard. */}
          <circle
            className={slot.haloDisc}
            cx={ORB_CENTRE}
            cy={ORB_CENTRE}
            r="90"
          />
        </Layer>
      </div>

      {/* Four blur depths masked into additive bands, so haze can dissolve the body from below. */}
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

      {/* A layer per flake: the blur needs a root <svg> in Safari; the turn rides a separate node. */}
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
            {/* The offset is an attribute and the fall is CSS, on separate nodes; a CSS transform would replace it. */}
            <g transform={`translate(${drop.x} ${drop.y})`}>
              <path d={RAINDROP_PATH} fill={ref("drop")} />
            </g>
          </Layer>
        ))}
      </div>

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
            {/* Four blur depths masked into bands that add up to one continuous ramp. */}
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

      <div className={slot.bolt} data-layer="bolt">
        {/* Marked "lit", so a reduced-motion still of a thunderstorm keeps its bolt. */}
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
