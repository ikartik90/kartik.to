"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { masonryGrid } from "../../../../styled-system/recipes";
import { GridItem } from "@/components/grid-item";
import { LinkCard } from "@/components/link-card";
import { MAX_GRID_SPAN } from "@/utils/listing-columns";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import { Typography } from "@/components/ui/typography";

// ---------------------------------------------------------------------------
// Local-only preview for the grid's editing controls (Figma 974:1863) — the
// per-card toolbar and the insertion rails that sit in the gutters either side
// of it.
//
// Shown here on a real `masonryGrid`, not on a mock card, because both controls
// are placed off the grid's own measurements: the toolbar centres on the card
// and the rails centre on `--grid-gap`. A showcase that stood them in a plain
// box would prove nothing about the only thing that can go wrong with them.
//
// Every control is visible at rest here. In the grid proper they appear on
// hover, which is a property of the grid rather than of these components.
// ---------------------------------------------------------------------------

const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  padding: "5xl",
  display: "flex",
  flexDirection: "column",
  gap: "5xl",
});

const containerStyle = css({
  containerType: "inline-size",
  containerName: "projectsGrid",
});

// Cards fill their cell — the cell owns the shape the grid reserved space for.
const fillStyle = css({
  position: "absolute",
  inset: 0,
  "& > *": { height: "token(spacing.full)" },
  // Editing here is always on, so the card is always scenery — same as the
  // grid proper, where following a card would discard the unsaved layout.
  pointerEvents: "none",
});

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

interface Card {
  id: string;
  title: string;
  /** Components carry an unpublish control; articles and projects do not. */
  isComponent: boolean;
}

const CARDS: Card[] = [
  { id: "a", title: "Palette", isComponent: false },
  { id: "b", title: "CosmicTrack", isComponent: true },
  { id: "c", title: "ReadTime", isComponent: false },
];

export default function GridControlsPage() {
  const [pinned, setPinned] = useState<Record<string, boolean>>({ b: true });
  const [log, setLog] = useState<string[]>([]);
  const [movedId, setMovedId] = useState<string | null>(null);
  // Real widths, not a mock: the width controls are the only ones here whose
  // effect is a layout change, so a preview that logged the press without
  // resizing the card would be showing the half that cannot go wrong.
  const [spans, setSpans] = useState<Record<string, number>>({});
  // Same again for shape: the picker is only worth previewing if the card
  // actually changes shape under it.
  const [aspects, setAspects] = useState<
    Record<string, DemoFrameAspectRatio>
  >({});
  const note = (line: string) => setLog((l) => [line, ...l].slice(0, 6));

  return (
    <main className={pageStyle}>
      <div>
        <Typography tag="h1" type="title">
          Grid controls
        </Typography>
        <Typography tag="p" type="caption">
          Controls appear on hover, as they do in the grid proper. Pin is a
          toggle; the moves stay disabled until a card is pinned. The width pair
          resizes the card for real, up to the three columns this grid has, and
          the aspect button swaps the rail for the shape picker (Esc to leave).
          CosmicTrack is a component, so it alone offers unpublish.
        </Typography>
      </div>

      <div className={containerStyle}>
        <div className={masonryGrid()} data-columns={3}>
          {CARDS.map((card, index) => (
            <GridItem
              key={card.id}
              aspect={aspects[card.id] ?? "16/9"}
              span={spans[card.id] ?? 1}
              editing
              label={card.title}
              pinned={pinned[card.id] ?? false}
              canMoveBack={index > 0}
              canMoveForward={index < CARDS.length - 1}
              moved={movedId === card.id}
              onTogglePin={() => {
                setPinned((p) => ({ ...p, [card.id]: !p[card.id] }));
                if (movedId === card.id) setMovedId(null);
                note(`toggle pin ${card.title}`);
              }}
              onMoveBack={() => {
                setMovedId(card.id);
                note(`move back ${card.title}`);
              }}
              onMoveForward={() => {
                setMovedId(card.id);
                note(`move forward ${card.title}`);
              }}
              canAddColumn={(spans[card.id] ?? 1) < MAX_GRID_SPAN}
              canRemoveColumn={(spans[card.id] ?? 1) > 1}
              onAddColumn={() => {
                setSpans((s) => ({
                  ...s,
                  [card.id]: Math.min(MAX_GRID_SPAN, (s[card.id] ?? 1) + 1),
                }));
                note(`add column ${card.title}`);
              }}
              onRemoveColumn={() => {
                setSpans((s) => ({
                  ...s,
                  [card.id]: Math.max(1, (s[card.id] ?? 1) - 1),
                }));
                note(`remove column ${card.title}`);
              }}
              onAspectChange={(aspect) => {
                setAspects((a) => ({ ...a, [card.id]: aspect }));
                note(`aspect ${aspect} ${card.title}`);
              }}
              onUnpublish={
                card.isComponent
                  ? () => note(`unpublish ${card.title}`)
                  : undefined
              }
              onInsertBefore={() => note(`insert before ${card.title}`)}
              onInsertAfter={() => note(`insert after ${card.title}`)}
            >
              <div className={fillStyle}>
                <LinkCard
                  href="#"
                  title={card.title}
                  aspect={aspects[card.id] ?? "16/9"}
                  interactive={false}
                />
              </div>
            </GridItem>
          ))}
        </div>
      </div>

      <div>
        {log.length === 0 ? (
          <p className={captionStyle}>No control pressed yet.</p>
        ) : (
          log.map((line, i) => (
            <p key={i} className={captionStyle}>
              {line}
            </p>
          ))
        )}
      </div>
    </main>
  );
}
