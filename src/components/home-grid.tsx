"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { css } from "../../styled-system/css";
import {
  CardPropertiesPanel,
  type CardMediaSlot,
} from "@/components/card-properties-panel";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoComponent } from "@/components/demo-component";
import { DemoFrame } from "@/components/demo-frame";
import { GridItem } from "@/components/grid-item";
import { ImageInsertDialog } from "@/components/image-insert-dialog";
import { LinkCard } from "@/components/link-card";
import { type PropertiesPanelHandle } from "@/components/ui/properties-panel";
import { getDemoComponent, pendingInsertFor } from "@/components/demo/registry";
import { listingColumnsFor } from "@/utils/listing-columns";
import { useGridDraftStore } from "@/store/grid-draft";
import { applyGridDraft } from "@/utils/grid-draft";
import { linkCardHref, linkCardTitle, type LinkCardConfig } from "@/domain/link-card";
import { postCardMedia, type PostCardConfig } from "@/domain/post";
import type { ImageInsertPayload } from "@/hooks/use-image-insert";
import type { MediaNode } from "@/domain/nodes";
import type { GridCard } from "@/lib/grid";
import UnpublishIcon from "@/assets/icons/unpublish.svg";

const containerStyle = css({
  containerType: "inline-size",
  containerName: "projectsGrid",
});

// In flow so the cell can measure the card; `flexGrow` fills it, since a % height resolves to nothing here.
const fillStyle = css({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  "& > *": { flexGrow: 1 },

  // Scenery while editing; `LinkCard`'s `interactive` also takes it out of the tab order.
  "&[data-inert]": { pointerEvents: "none" },
});

/** A linked demo's card: always inert to the pointer, since every click belongs to the link. */
const demoLinkStyle = css({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  "& > *": { flexGrow: 1, pointerEvents: "none" },
});

// Publishes the grid's px width as `--grid-width`: WebKit miscomputes `tan(atan2())` on cqw units.
// Writes only when the width changes, or the observer loops (Safari reports that as an error).
function useGridWidth(grid: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) return;

    let published = 0;

    const publish = () => {
      // Up, never down, or the span understates the card's rows.
      const width = Math.ceil(node.getBoundingClientRect().width);
      // A measured zero would make every span negative.
      if (width <= 0) return;
      // A height-only notification: writing here would start the loop.
      if (width === published) return;
      published = width;
      node.style.setProperty("--grid-width", `${width}px`);
      node.setAttribute("data-measured", "");
    };

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    publish();

    return () => observer.disconnect();
  }, [grid]);
}

interface PendingInsert {
  index: number;
}

/** Names the card by key, since the grid re-projects through the draft while the dialog is open. */
interface PendingPick {
  key: string;
  /** Absent when the file is a document. */
  slot?: CardMediaSlot;
}

function mediaNodeFrom(payload: ImageInsertPayload): MediaNode {
  return {
    type: "media",
    kind: payload.kind,
    src: payload.src,
    ...(payload.alt ? { alt: payload.alt } : {}),
    ...(payload.width && payload.height
      ? { width: payload.width, height: payload.height }
      : {}),
  };
}

interface HomeGridProps {
  cards: GridCard[];
  /** From the route, which already gates the admin; the client can't tell signed-out from not-yet-read. */
  editable?: boolean;
  /** Server-rendered demos by card key; a missing key falls back to the browser loader. */
  demos?: Record<string, ReactNode>;
}

// Masonry: `grid-lanes` where supported, else 1px rows with spans computed via `tan(atan2())`,
// the only CSS length/length division. WebKit gets that wrong on cqw, hence the px `--grid-width`.
const masonryGridStyle = css({
  // A custom property because the span arithmetic reads it back.
  "--grid-gap": "token(spacing.xxl)",
  "--columns": "1",

  containerType: "inline-size",
  display: "grid",
  gridTemplateColumns: "repeat(var(--columns), minmax(0, 1fr))",
  columnGap: "var(--grid-gap)",
  rowGap: "var(--grid-gap)",
  width: "token(spacing.full)",
  marginInline: "auto",

  "& > *": {
    // Clamped here: unclamped, a wide span mints implicit columns.
    gridColumn: "span min(var(--span, 1), var(--columns))",
    minWidth: "0",

    "--span-clamped": "min(var(--span, 1), var(--columns))",
    // The `100cqw` fallback applies only before measurement; the `[data-measured]` gate keeps it out of `atan2`.
    "--col-width":
      "calc((var(--grid-width, 100cqw) - (var(--columns) - 1) * var(--grid-gap)) / var(--columns))",
    "--cell-width":
      "calc(var(--col-width) * var(--span-clamped) + (var(--span-clamped) - 1) * var(--grid-gap))",
    "--aspect-height":
      "calc(var(--cell-width) * var(--aspect-h, 9) / var(--aspect-w, 16))",
    // `start`, not `stretch`, which fills the gutter rows and feeds the card's height back into its span.
    alignSelf: "start",
  },

  "@supports (grid-row: span calc(tan(atan2(1px, 1px))))": {
    // `:where()` keeps the gate specificity-free, so the `grid-lanes` tier still wins on source order.
    "&:where([data-measured])": {
      gridAutoRows: "1px",
      rowGap: "0",
      "& > *": {
        // Height plus gutter in 1px rows (row-gap is 0), using the larger of the shape and the measured card.
        gridRow:
          "span calc(tan(atan2(max(var(--aspect-height), var(--card-height, 0px)), 1px)) + tan(atan2(var(--grid-gap), 1px)))",
      },
    },
  },

  // Last, so it wins on source order where both are supported.
  "@supports (display: grid-lanes)": {
    display: "grid-lanes",
    gridAutoRows: "auto",
    rowGap: "var(--grid-gap)",
    "& > *": {
      gridRow: "auto",
      alignSelf: "auto",
    },
  },

  // The tiers overlap, so the wider one comes later.
  "@container projectsGrid (min-width: 640px)": {
    "&[data-columns='2'], &[data-columns='3']": { "--columns": "2" },
  },
  "@container projectsGrid (min-width: 960px)": {
    width: "min(100%, token(sizes.listingGrid3Up))",
    "&[data-columns='3']": { "--columns": "3" },
  },
});

export function HomeGrid({ cards, editable = false, demos }: HomeGridProps) {
  const draft = useGridDraftStore();
  const [insert, setInsert] = useState<PendingInsert | null>(null);
  const [pick, setPick] = useState<PendingPick | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<{
    key: string;
  } | null>(null);

  // Keyed by card, not seat, since pins and unpublishing move cards between seats.
  const [propertiesKey, setPropertiesKey] = useState<string | null>(null);
  // Closing goes through the panel; see `togglePropertiesPanel`.
  const propertiesPanelRef = useRef<PropertiesPanelHandle>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  useGridWidth(gridRef);

  const [movedKey, setMovedKey] = useState<string | null>(null);

  // The draft applies only in edit mode, so an unsaved layout never reaches visitors.
  const shown = useMemo(
    () => (editable ? applyGridDraft(cards, draft) : cards),
    [cards, draft, editable],
  );

  const columns = listingColumnsFor(shown.length);

  // From the drafted list, or edits would spring back to the stored value.
  const propertiesCard =
    shown.find((card) => card.key === propertiesKey) ?? null;

  const propertiesEntry =
    propertiesCard?.kind === "component"
      ? getDemoComponent(propertiesCard.componentId)
      : undefined;

  const propertiesLogger =
    propertiesCard?.kind === "component" && propertiesEntry?.logger
      ? {
          shown: propertiesCard.logger,
          onShownChange: (visible: boolean) =>
            draft.setLogger(propertiesCard.key, visible),
        }
      : undefined;

  // Gated on the registry's `card`, the same fact that decides how the tile renders.
  const propertiesLinkCard =
    propertiesCard?.kind === "component" && propertiesEntry?.card
      ? {
          config: propertiesCard.props ?? {},
          onChange: (config: LinkCardConfig) =>
            draft.setProps(propertiesCard.key, config),
          onPickMedia: (slot: CardMediaSlot) =>
            setPick({ key: propertiesCard.key, slot }),
          onPickDocument: () => setPick({ key: propertiesCard.key }),
        }
      : undefined;

  const propertiesPostCard =
    propertiesCard?.kind === "post"
      ? {
          config: propertiesCard.card,
          cover: propertiesCard.cover,
          meta: propertiesCard.date,
          onChange: (config: PostCardConfig) =>
            draft.setCard(propertiesCard.key, config),
          onPickMedia: (slot: CardMediaSlot) =>
            setPick({ key: propertiesCard.key, slot }),
        }
      : undefined;

  const picked = shown.find((card) => card.key === pick?.key) ?? null;

  function fillPickedSlot(payload: ImageInsertPayload) {
    if (!pick || !picked) return;
    if (picked.kind === "post") {
      if (pick.slot) {
        draft.setCard(pick.key, {
          ...picked.card,
          media: { ...picked.card.media, [pick.slot]: mediaNodeFrom(payload) },
        });
      }
    } else {
      const config = picked.props ?? {};
      draft.setProps(
        pick.key,
        pick.slot
          ? {
              ...config,
              media: { ...config.media, [pick.slot]: mediaNodeFrom(payload) },
            }
          : {
              ...config,
              // Only the URL: the payload's kind and size describe nothing about a document.
              link: {
                kind: "document",
                href: payload.src,
                newTab: config.link?.newTab,
              },
            },
      );
    }
    setPick(null);
  }

  /** Closing asks the panel, so its exit slide plays before it calls back. */
  function togglePropertiesPanel(key: string) {
    if (propertiesKey === key) {
      propertiesPanelRef.current?.dismiss();
      return;
    }
    setPropertiesKey(key);
  }

  return (
    <section aria-label="Work" className={containerStyle}>
      {/* `data-measured` is set by the observer, never rendered: only layout can know it. */}
      <div ref={gridRef} className={masonryGridStyle} data-columns={columns}>
        {shown.map((card, index) => (
          <GridItem
            key={card.key}
            aspect={card.aspect}
            span={card.span}
            editing={editable}
            pinned={card.gridIndex !== null}
            canMoveBack={index > 0}
            canMoveForward={index < shown.length - 1}
            label={card.kind === "post" ? card.title : card.componentId}
            onTogglePin={() => {
              draft.setPin(card.key, card.gridIndex === null ? index : null);
              if (card.key === movedKey) setMovedKey(null);
            }}
            moved={card.key === movedKey}
            onMoveBack={() => {
              draft.setPin(
                card.key,
                Math.max(0, (card.gridIndex ?? index) - 1),
              );
              setMovedKey(card.key);
            }}
            onMoveForward={() => {
              draft.setPin(card.key, (card.gridIndex ?? index) + 1);
              setMovedKey(card.key);
            }}
            canAddColumn={card.span < columns}
            canRemoveColumn={card.span > 1}
            onAddColumn={() =>
              draft.setSpan(card.key, Math.min(columns, card.span + 1))
            }
            onRemoveColumn={() =>
              draft.setSpan(card.key, Math.max(1, card.span - 1))
            }
            onAspectChange={(aspect) => draft.setAspect(card.key, aspect)}
            propertiesOpen={propertiesKey === card.key}
            onToggleProperties={() => togglePropertiesPanel(card.key)}
            onUnpublish={
              card.kind === "component"
                ? () => setConfirmUnpublish({ key: card.key })
                : undefined
            }
            onInsertBefore={() => setInsert({ index })}
            onInsertAfter={() => setInsert({ index: index + 1 })}
          >
            <div className={fillStyle} data-inert={editable ? "" : undefined}>
              {card.kind === "post" ? (
                <PostCard card={card} editable={editable} />
              ) : (
                <ComponentCard
                  card={card}
                  demo={demos?.[card.key]}
                  editable={editable}
                />
              )}
            </div>
          </GridItem>
        ))}
      </div>

      {editable && propertiesCard && (
        <CardPropertiesPanel
          ref={propertiesPanelRef}
          // Keyed per card, so a reopened panel starts from that card's values.
          key={propertiesCard.key}
          logger={propertiesLogger}
          linkCard={propertiesLinkCard}
          postCard={propertiesPostCard}
          onDismiss={() => setPropertiesKey(null)}
        />
      )}

      {/* Editing only: a closed <dialog> still renders its contents, leaking admin copy into public HTML. */}
      {editable && (
        <>
          <ComponentInsertDialog
            open={insert !== null}
            onClose={() => setInsert(null)}
            onInsert={(componentId) => {
              draft.addInsert(pendingInsertFor(componentId, insert?.index ?? 0));
              setInsert(null);
            }}
          />

          {/* Here, not in the panel, whose outside-press dismiss would fight a modal.
              Two elements, since the hook refetches on every open. */}
          <ImageInsertDialog
            open={pick !== null && pick.slot !== undefined}
            mode="change"
            initialPhase="library"
            onClose={() => setPick(null)}
            onInsert={fillPickedSlot}
          />

          <ImageInsertDialog
            open={pick !== null && pick.slot === undefined}
            accepts="document"
            mode="change"
            initialPhase="library"
            onClose={() => setPick(null)}
            onInsert={fillPickedSlot}
          />

          <ConfirmDialog
            open={confirmUnpublish !== null}
            title="Unpublish Component"
            message="You are about to unpublish this component. Do you want to proceed?"
            confirmLabel="Unpublish"
            confirmIcon={UnpublishIcon}
            onConfirm={() => {
              if (confirmUnpublish) draft.remove(confirmUnpublish.key);
            }}
            onClose={() => setConfirmUnpublish(null)}
          />
        </>
      )}
    </section>
  );
}

/** A post's tile. The post's own meta line wins over the authored one. */
function PostCard({
  card,
  editable,
}: {
  card: Extract<GridCard, { kind: "post" }>;
  editable: boolean;
}) {
  const { light, dark } = postCardMedia(card.card, card.cover);
  return (
    <LinkCard
      href={card.href}
      title={card.title}
      aspect={card.aspect}
      meta={card.date ?? card.card.meta}
      cover={light}
      coverDark={dark}
      scrim={card.card.scrim}
      tone={card.card.tone}
      interactive={!editable}
    />
  );
}

/** A published demo, rendered in the frame the article renderer gives it. */
function ComponentCard({
  card,
  demo,
  editable,
}: {
  card: Extract<GridCard, { kind: "component" }>;
  demo?: ReactNode;
  editable: boolean;
}) {
  const entry = getDemoComponent(card.componentId);
  if (!entry) return null;

  if (entry.card) {
    const config = card.props ?? {};
    return (
      <LinkCard
        href={linkCardHref(config)}
        title={config.content?.title}
        meta={config.content?.meta}
        label={linkCardTitle(config)}
        aspect={card.aspect}
        cover={config.media?.light}
        coverDark={config.media?.dark}
        scrim={config.content?.scrim}
        tone={config.content?.tone}
        newTab={config.link?.newTab}
        interactive={!editable}
      />
    );
  }

  const frame = (
    // The entry's logger config travels once the card says yes; a bare `true` would drop it.
    <DemoFrame
      aspectRatio={card.aspect}
      logger={card.logger ? entry.logger ?? true : false}
      chrome={entry.chrome}
      fill={entry.fill}
    >
      {demo ?? <DemoComponent entry={entry} aspect={card.aspect} />}
    </DemoFrame>
  );

  if (!entry.link) return frame;

  return (
    // Out of the tab order while editing: Enter navigates as well as a click.
    <a
      href={entry.link.href}
      aria-label={entry.link.label}
      className={demoLinkStyle}
      tabIndex={editable ? -1 : undefined}
    >
      {frame}
    </a>
  );
}
