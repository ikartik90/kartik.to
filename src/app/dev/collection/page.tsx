"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { CollectionGrid } from "@/components/collection-grid";
import { CollectionShowcase } from "@/components/collection-showcase";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type CollectionItem,
} from "@/domain/nodes";
import {
  featureItem,
  removeItem,
  replaceItem,
  setItemBackgroundEffect,
  setItemLayout,
  setItemCaption,
  swapItems,
} from "@/utils/collection-items";

// Six freely-usable photographs at mixed aspect ratios — enough to exercise the
// featured skeleton, the surplus badge and the lightbox's portrait/landscape
// clamping without reaching into the R2 library.
const PHOTOS = [
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=900",
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1600",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
];

// A stand-in for the case the background effect exists for: a UI screenshot
// exported on a TRANSPARENT canvas, floating in a frame far larger than it. An
// inline SVG rather than a file, so the transparency is obvious from the source
// and the route pulls nothing over the network to demonstrate it.
const UI_SCREENSHOT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <g transform="translate(360 280)">
        <rect width="480" height="240" rx="16" fill="#12161B"/>
        <rect width="480" height="36" rx="16" fill="#1B2128"/>
        <rect y="20" width="480" height="16" fill="#1B2128"/>
        <circle cx="22" cy="18" r="5" fill="#FF4D97"/>
        <circle cx="40" cy="18" r="5" fill="#FFAB6F"/>
        <circle cx="58" cy="18" r="5" fill="#5A6675"/>
        <rect x="24" y="64" width="180" height="12" rx="6" fill="#A9BFD6"/>
        <rect x="24" y="94" width="312" height="10" rx="5" fill="#5A6675"/>
        <rect x="24" y="118" width="264" height="10" rx="5" fill="#5A6675"/>
        <rect x="24" y="170" width="112" height="32" rx="8" fill="#FF4D97"/>
      </g>
    </svg>`,
  );

const SEED: CollectionItem[] = [
  {
    src: UI_SCREENSHOT,
    alt: "A UI window on a transparent canvas",
    caption: "Transparent PNG — the gradient shows through",
    backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
  },
  ...PHOTOS.slice(1).map((src, i) => ({
    src,
    alt: `Landscape ${i + 1}`,
    caption: undefined,
  })),
];

const sectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  width: "token(spacing.full)",
  maxWidth: "token(sizes.articleShowcase)",
});

const headingStyle = css({ textStyle: "subheading", color: "text.title" });

/** Local-only preview route for the collection block, editor and reader. */
export default function CollectionPreviewPage() {
  const [items, setItems] = useState<CollectionItem[]>(SEED);

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "5xl",
        padding: "5xl",
      })}
    >
      <section className={sectionStyle}>
        <h2 className={headingStyle}>
          Editor — hover a cell for its toolbar ({items.length}/6)
        </h2>
        <CollectionGrid
          items={items}
          onFeature={(i) => setItems(featureItem(items, i))}
          onReorder={(from, to) => setItems(swapItems(items, from, to))}
          onRemove={(i) => setItems(removeItem(items, i))}
          onEditCaption={(i, caption) =>
            setItems(setItemCaption(items, i, caption))
          }
          onSetBackgroundEffect={(i, effect) =>
            setItems(setItemBackgroundEffect(items, i, effect))
          }
          onSetLayout={(i, patch) => setItems(setItemLayout(items, i, patch))}
          // Through the real algebra, and with the shape the picker actually
          // hands over — a source and the new file's own alt, nothing more — so
          // this route shows what a replacement keeps rather than a local
          // spread's more generous answer.
          onReplace={(i) =>
            setItems(
              replaceItem(items, i, {
                src: PHOTOS[(i + 3) % 6],
                alt: "Replacement",
              }),
            )
          }
          onAddImage={() =>
            setItems([
              ...items,
              { src: PHOTOS[items.length % 6], alt: "Added" },
            ])
          }
        />
      </section>

      <section className={sectionStyle}>
        <h2 className={headingStyle}>Reader — click any tile for the lightbox</h2>
        <CollectionShowcase items={items} />
      </section>

      <section className={sectionStyle}>
        <h2 className={headingStyle}>Reader — two images, equal split</h2>
        <CollectionShowcase items={SEED.slice(0, 2)} />
      </section>

      <section className={sectionStyle}>
        <h2 className={headingStyle}>Reader — one image, natural ratio</h2>
        <CollectionShowcase items={SEED.slice(3, 4)} />
      </section>
    </main>
  );
}
