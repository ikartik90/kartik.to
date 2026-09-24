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

// ---------------------------------------------------------------------------
// The homepage card, drawn as a picture.
//
// This is the same tile `LinkCard` renders — the ground, the cover composed in
// it, the wash, the meta line and the name — built a second time because the
// first one cannot be reused here at all. `LinkCard` is Panda classes and a
// stylesheet; Satori is a layout engine with flexbox, a font, and no stylesheet
// to read. Nothing about the component survives the crossing except the design,
// so the design is what is carried: the recipe's own numbers, the same wash
// curve (`cardWashGradient`), the same media composition arithmetic
// (`mediaInsetPx`, `mediaRadiusPx`), and the same tone palette.
//
// Three things do not cross, and it is worth naming them rather than leaving
// them to be noticed:
//
//   • THE GROUND is a shader, and there is no GPU here. It is approximated by
//     `effectStyle` from the effect's own colours and turn.
//   • THE FROSTING under the caption is a progressive backdrop blur. Satori has
//     no backdrop filter; the wash over it is the whole scrim here.
//   • THE CARD'S CORNER is dropped. A rounded PNG is a rounded picture on a
//     ground nobody controls — every feed would show four odd corners of
//     whatever it happens to composite against.
//
// Everything else is the card.
// ---------------------------------------------------------------------------

/** The size every social card is read at — 1.91:1, near enough for all of them. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/**
 * How wide a card is on the homepage, and therefore how much bigger this one is.
 *
 * The MEDIA needs no such number — an inset and a corner are shares of the
 * card's width by construction (`mediaInsetPx`), so the same composition
 * arrives correct at any size. TYPE is not: the caption is 16px on a card of
 * any width, so a picture of the card has to be taken at some particular width
 * or the words come out a size the card never wears.
 *
 * 400 is the grid's one-column card on a desktop, which is what almost every
 * card on the homepage actually is. At 3× the caption occupies the share of
 * this image that it occupies of that card — around two fifths of a 16:9 tile,
 * which is well past the scrim's quarter-height floor and exactly what the
 * recipe says happens when the words reach higher than it (`CARD_SCRIM_MIN_SHARE`).
 *
 * It was `OG_SIZE.width / MEDIA_PADDING_REFERENCE` first, which is a true
 * about media composition and a wrong one about type: 1.875× put a 30px title
 * on a 1200px card, and a feed showing that card at 550px across rendered the
 * name at 14px.
 */
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

/**
 * The two bands, as the `linkCard` recipe's `tone` variant reassigns them —
 * `bg.surface` and the ink the caption resolves to over a picture.
 *
 * Literal values rather than tokens because there is no stylesheet here to
 * resolve a custom property against. They are the same two neutrals: the light
 * band is `neutral.200` under `neutral.900`, the dark one `neutral.800` under
 * `neutral.100`, which is also exactly what an UNPINNED card resolves to in a
 * light and a dark theme respectively.
 */
const TONES: Record<LinkCardTone, { surface: string; ink: string; rgb: string }> = {
  light: { surface: "#D8DDE3", ink: "#1F2123", rgb: "216, 221, 227" },
  dark: { surface: "#2E3338", ink: "#EEF2F6", rgb: "46, 51, 56" },
};

/** Switzer, at the one weight the whole type scale is set in (`fontWeights.base`). */
async function switzer(): Promise<ArrayBuffer> {
  // The .woff, not the .woff2 the app itself loads and not the .ttf beside it.
  // Satori reads `ttf`, `otf` and `woff`, which rules out woff2 — and the TTF
  // in this folder is a VARIABLE font its parser chokes on outright, with a
  // `Cannot read properties of undefined (reading '256')` from somewhere deep
  // in a table lookup. The woff is the same typeface, parses, and is a quarter
  // of the size, which is worth having inside a serverless function's bundle.
  const file = await readFile(
    join(process.cwd(), "public/fonts/Switzer-Variable.woff"),
  );
  return Uint8Array.from(file).buffer;
}

/** The ground the author put behind the picture, and the plate behind that. */
function Cover({ card, tone }: { card: OgCard; tone: (typeof TONES)[LinkCardTone] }) {
  const media = card.cover;
  const src = ogCoverSrc(media);
  const effect = media?.backgroundEffect;

  // The inset and the corner as SHARES of this card's width, which is the
  // whole rule `mediaInsetPx` and `mediaRadiusPx` exist to state: a picture
  // composed with a 40px band at the reference width wears the same band here,
  // proportionally, rather than a 40px one on a card twice the size.
  const inset = media ? mediaInsetPx(media, OG_SIZE.width) : 0;
  const radius = media ? mediaRadiusPx(media, OG_SIZE.width) : 0;
  const fit = media?.objectFit ?? DEFAULT_MEDIA_FIT;

  // Sized to the picture where its shape is on record — see `containedSize`
  // for why a `contain` picture cannot simply fill its box and be rounded.
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
        // A bare <img>, and `next/image` is not an option rather than a
        // preference: this tree is never mounted in a browser. Satori reads it
        // as a layout description and fetches the source itself, so an element
        // that expects Next's runtime, its loader and a client to hydrate it
        // has nothing here to be any of those things.
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

/**
 * How long a rendered card may be held. A post's card changes when the post
 * does, which is rare and never urgent — an hour at the edge, and a day while a
 * crawler revalidates in the background, is the difference between a link
 * preview that is composed once and one composed on every share of the URL.
 */
const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

/**
 * The card, RENDERED — bytes in hand, not a stream still to be drawn.
 *
 * The `await` on the body is the whole point of this function and not a
 * formality. `ImageResponse` is lazy: the constructor returns a Response
 * immediately and Satori runs while the body is piped, so an unsupported image
 * format or a font that will not parse throws LONG AFTER any `try` around the
 * constructor has returned — which is how a fallback written around it comes to
 * catch nothing at all and every failure comes out as a bare "failed to pipe
 * response". Draining it here moves the failure back inside the caller's `try`,
 * where there is still time to draw something else.
 *
 * Written bottom-up in the tree exactly as `LinkCard` writes it, because tree
 * order is paint order in both: the cover and everything in it, then the wash,
 * then the words.
 */
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
          // The caption sits on the bottom edge, as it does on every card in
          // the grid — see the recipe's `root` slot.
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
            {/* Above the title, as on the card: the title is what the thing is
                called and belongs on the last line before the edge. */}
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

/**
 * The avatar's own ground, sampled from the PNG's corners. The picture is
 * opaque, so the card's ground has to be exactly this or its edge shows.
 */
const AVATAR_GROUND = "#CFDBE8";

/**
 * The site's card: the avatar, centred on its own ground — what a link to the
 * homepage turns into, and what a post's card falls back to. Drawn at the PNG's
 * native 350px so nothing is upscaled.
 */
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
