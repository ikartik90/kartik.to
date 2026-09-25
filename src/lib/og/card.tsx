import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  DEFAULT_MEDIA_FIT,
  mediaInsetPx,
  mediaRadiusPx,
} from "@/domain/nodes";
import { CARD_SCRIM_MIN_SHARE, cardWashGradient } from "@/utils/card-scrim";
import { containedSize } from "@/utils/contained-size";
import { effectStyle } from "@/utils/effect-gradient";
import { ogCoverSrc, type OgCard } from "@/utils/og-card";
import type { LinkCardTone } from "@/domain/link-card";

// The homepage card redrawn for Satori, which has no stylesheet, so the recipe's numbers are carried
// by hand. The shader ground is approximated; the frosting and the card's corner are dropped.

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/** Type is drawn as on the homepage's 400px one-column card, scaled up to this width. */
const TYPE_SCALE = OG_SIZE.width / 400;

/** The `caption` slot's `padding: xl` and `gap: sm`, at this card's size. */
const CAPTION_PADDING = 16 * TYPE_SCALE;
const CAPTION_GAP = 4 * TYPE_SCALE;

/** `textStyles.caption` and `textStyles.bodyLarge`, at this card's size. */
const META_SIZE = 12 * TYPE_SCALE;
const META_LINE_HEIGHT = 2;
const META_TRACKING = 0.005;
const TITLE_SIZE = 16 * TYPE_SCALE;
const TITLE_LINE_HEIGHT = 1.75;

/** The `linkCard` tones as literals: there is no stylesheet here to resolve tokens against. */
const TONES: Record<LinkCardTone, { surface: string; ink: string; rgb: string }> = {
  light: { surface: "#D8DDE3", ink: "#1F2123", rgb: "216, 221, 227" },
  dark: { surface: "#2E3338", ink: "#EEF2F6", rgb: "46, 51, 56" },
};

async function switzer(): Promise<ArrayBuffer> {
  // The .woff: Satori can't read woff2, and chokes on the variable TTF.
  const file = await readFile(
    join(process.cwd(), "public/fonts/Switzer-Variable.woff"),
  );
  return Uint8Array.from(file).buffer;
}

function Cover({ card, tone }: { card: OgCard; tone: (typeof TONES)[LinkCardTone] }) {
  const media = card.cover;
  const src = ogCoverSrc(media);
  const effect = media?.backgroundEffect;

  const inset = media ? mediaInsetPx(media, OG_SIZE.width) : 0;
  const radius = media ? mediaRadiusPx(media, OG_SIZE.width) : 0;
  const fit = media?.objectFit ?? DEFAULT_MEDIA_FIT;

  // See `containedSize` for why a `contain` picture can't simply fill its box.
  const fitted =
    fit === "contain" && media
      ? containedSize(media, OG_SIZE.width - inset * 2, OG_SIZE.height - inset * 2)
      : null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: inset,
        backgroundColor: tone.surface,
        ...(effect ? effectStyle(effect) : {}),
      }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{
            ...(fitted
              ? { width: fitted.width, height: fitted.height }
              : { width: "100%", height: "100%" }),
            objectFit: fit,
            borderRadius: radius,
          }}
        />
      )}
    </div>
  );
}

const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

/** Drains the body, so Satori's lazy failures throw inside the caller's `try` rather than mid-pipe. */
export async function renderOgCard(card: OgCard): Promise<Response> {
  const tone = TONES[card.tone];

  const image = new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: tone.surface,
          fontFamily: "Switzer",
        }}
      >
        <Cover card={card} tone={tone} />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            minHeight: OG_SIZE.height * CARD_SCRIM_MIN_SHARE,
          }}
        >
          {card.scrim && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                backgroundImage: cardWashGradient(
                  (alpha) => `rgba(${tone.rgb}, ${alpha.toFixed(3)})`,
                ),
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: CAPTION_GAP,
              padding: CAPTION_PADDING,
              color: tone.ink,
            }}
          >
            {card.meta && (
              <div
                style={{
                  fontSize: META_SIZE,
                  lineHeight: META_LINE_HEIGHT,
                  letterSpacing: META_SIZE * META_TRACKING,
                }}
              >
                {card.meta}
              </div>
            )}
            <div style={{ fontSize: TITLE_SIZE, lineHeight: TITLE_LINE_HEIGHT }}>
              {card.title}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Switzer",
          data: await switzer(),
          style: "normal",
          weight: 400,
        },
      ],
    },
  );

  return new Response(await image.arrayBuffer(), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": OG_CACHE_CONTROL,
    },
  });
}

/** Sampled from the avatar PNG's corners; the picture is opaque, so this must match exactly. */
const AVATAR_GROUND = "#CFDBE8";

/** The avatar on its own ground, at the PNG's native 350px. */
export async function renderAvatarOgCard(): Promise<Response> {
  const avatar = await readFile(
    join(process.cwd(), "public/assets/kartik-iyer-logo.png"),
  );
  const src = `data:image/png;base64,${avatar.toString("base64")}`;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: AVATAR_GROUND,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
        <img src={src} width={350} height={350} alt="" />
      </div>
    ),
    OG_SIZE,
  );

  return new Response(await image.arrayBuffer(), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": OG_CACHE_CONTROL,
    },
  });
}
