"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { CollectionGrid } from "@/components/collection-grid";
import { CollectionShowcase } from "@/components/collection-showcase";
import type { CollectionItem } from "@/domain/nodes";
import {
  featureItem,
  removeItem,
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

const SEED: CollectionItem[] = PHOTOS.map((src, i) => ({
  src,
  alt: `Landscape ${i + 1}`,
  caption: i === 0 ? "The featured one, with a caption" : undefined,
}));

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
          onReplace={(i) =>
            setItems(
              items.map((item, index) =>
                index === i ? { ...item, src: PHOTOS[(i + 3) % 6] } : item,
              ),
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
