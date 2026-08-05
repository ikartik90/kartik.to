"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  collectionCellOverlay,
  collectionEmptyCell,
  collectionGrid,
  inlineEditRow,
} from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { BackgroundEffectPanel } from "@/components/background-effect-panel";
import {
  COLLECTION_MAX_ITEMS,
  DEFAULT_BACKGROUND_EFFECT,
  type BackgroundEffect,
  type CollectionItem,
} from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";
import AddIcon from "@/assets/icons/add.svg";
import EditIcon from "@/assets/icons/edit.svg";
import FeatureIcon from "@/assets/icons/feature.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";
import ShaderIcon from "@/assets/icons/shader.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// CollectionGrid — the collection block's authoring surface.
//
// Every slot is drawn, filled or not, so the six-image cap reads as a shape
// rather than as an error you discover by hitting it. A filled slot reveals its
// controls on hover; an empty one is a single "Add Image" button.
//
// The component is deliberately stateless about the collection itself: it takes
// an ordered `items` array and emits intent (feature / caption / replace /
// remove / add). All the array algebra lives in `@/utils/collection-items`, and
// the parent owns undo granularity — a reorder or a removal has to be one clean
// history step, which it can't be if it rides a caption-typing debounce.
// ---------------------------------------------------------------------------

const gridStyles = collectionGrid({ layout: "uniform" });
const emptyCellStyle = collectionEmptyCell();
// Only the Esc key-cap is borrowed from the inline-edit row — the caption card
// owns its own surface and field, and the hint is identical wherever it appears.
const editRow = inlineEditRow();

/**
 * How far a press has to travel before it counts as a drag rather than a click.
 * The controls sit over the photo, so a button that nudged the tile every time
 * a hand wobbled on it would be unusable.
 */
const DRAG_THRESHOLD = 4;

/**
 * How long the dropped photo takes to travel into the cell it landed on — and
 * how long the photo it displaced takes to fade up in the slot it vacated. The
 * two halves of a swap settle together. Kept in step with the
 * `collectionArrive` keyframe's duration in `panda.config.ts`.
 *
 * Not shorter. At 150ms this covered nine frames, the first of which already
 * crossed a third of the distance — no easing is legible in that, however
 * strongly the curve decelerates, and the move reads as a snap.
 */
const LANDING_MS = 280;

/**
 * Plain `ease-out`: leaves at speed, because the photo was already moving with
 * the pointer and stopping dead to start again would read as a second, separate
 * animation, then decelerates evenly into the slot.
 *
 * Deliberately not one of the aggressive decelerate curves. Measured over this
 * distance, `cubic-bezier(0.05, 0.7, 0.1, 1)` put 62% of the travel in the
 * first 10% of the time and 95% in the first half — which reads as a snap
 * followed by an imperceptible crawl, i.e. less legible than the gentler curve,
 * not more. This is also the easing the rest of the system's transitions use.
 */
const LANDING_EASE = "ease-out";

export interface CollectionGridProps {
  items: CollectionItem[];
  /**
   * The editor's showcase-media contract (tabindex, focus handlers, caret
   * key handling) — spread onto the grid root so a collection navigates
   * exactly like a single image block.
   */
  rootProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  onFeature: (index: number) => void;
  onEditCaption: (index: number, caption: string | undefined) => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAddImage: () => void;
  /** Exchange two slots — dragging one tile onto another. */
  onReorder: (from: number, to: number) => void;
  /** Sets, retunes or (with `undefined`) clears an image's background effect. */
  onSetBackgroundEffect: (
    index: number,
    effect: BackgroundEffect | undefined,
  ) => void;
}

export function CollectionGrid({
  items,
  rootProps,
  onFeature,
  onEditCaption,
  onReplace,
  onRemove,
  onAddImage,
  onReorder,
  onSetBackgroundEffect,
}: CollectionGridProps) {
  // Keyed on the image, NOT the slot. Featuring an image moves it to another
  // cell and removing one slides its neighbours along, so a stored index would
  // strand the open field on whatever took that slot. Pinning to `src` makes
  // "the editor follows its image" and "the editor closes when its image is
  // gone" fall out of a plain lookup, with no effect to keep them in sync.
  const [editingSrc, setEditingSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The image whose background-effect panel is open, keyed on `src` for the
  // same reason the caption editor is: featuring, removing and reordering all
  // move an image between slots, and a stored index would strand the panel on
  // whatever took that slot — retuning the wrong picture's gradient.
  const [effectSrc, setEffectSrc] = useState<string | null>(null);

  const editingIndex = editingSrc
    ? items.findIndex((item) => item.src === editingSrc)
    : -1;
  const effectIndex = effectSrc
    ? items.findIndex((item) => item.src === effectSrc)
    : -1;
  const effectItem = effectIndex === -1 ? null : items[effectIndex];

  useEffect(() => {
    if (editingIndex !== -1) inputRef.current?.select();
  }, [editingIndex]);

  function startEditing(index: number) {
    setEditingSrc(items[index].src);
    setDraft(items[index].caption ?? "");
  }

  function commit(index: number) {
    setEditingSrc(null);
    onEditCaption(index, draft.trim() || undefined);
  }

  /**
   * Opens the background-effect panel for a slot — or closes it, if that slot's
   * panel is the one already open.
   *
   * Turning the effect ON is part of opening. The panel edits a gradient, so it
   * has to have one to edit; asking for an extra click to "add" before anything
   * appears would make the first interaction a blank form. Reaching for the
   * button IS the request for an effect, and Remove is the way back.
   */
  function toggleEffectPanel(index: number) {
    const item = items[index];
    if (effectSrc === item.src) {
      setEffectSrc(null);
      return;
    }
    // The caption card stands where the toolbar stands; the panel replaces
    // both. Two editors open on one picture would be two claims on it.
    setEditingSrc(null);
    setEffectSrc(item.src);
    if (!item.backgroundEffect) {
      onSetBackgroundEffect(index, DEFAULT_BACKGROUND_EFFECT);
    }
  }

  // ---- Reordering -------------------------------------------------------
  //
  // Pointer events, NOT the HTML5 drag-and-drop API.
  //
  // That API puts the browser's own bitmap under the cursor, and the bitmap is
  // the one part of the gesture you cannot own. It is rasterised onto an OPAQUE
  // backing, so the corners a border-radius makes transparent come back white;
  // and when the drag ends the browser flies it back to where it started, an
  // animation there is no way to decline — which played on top of a grid that
  // had already reordered and read as the photo refusing to move. `setDragImage`
  // reaches neither behaviour.
  //
  // Driving the gesture ourselves means the thing under the cursor is a real
  // element with real rounded corners, and letting go simply removes it: the
  // photo is in its new cell on the very next paint, with nothing flying
  // anywhere.
  //
  // Indices are fine here where the caption editor needed a stable value,
  // because a drag is over in one gesture — the array cannot change underneath
  // it. The source index lives in a REF as well as in state: state paints the
  // affordance, but a handler must not depend on React having committed a
  // render between two events of the same gesture.
  const dragIndexRef = useRef<number | null>(null);
  // The photo under a held pointer — set the moment the press lands, which is
  // earlier than `dragIndex`: that one waits for the drag threshold. It carries
  // the point the hand landed on, because the press scales the photo ABOUT that
  // point: shrinking about the centre pulls the picture away from the cursor,
  // and it stops feeling like the thing you are holding.
  const [pressed, setPressed] = useState<{
    index: number;
    origin: string;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The slot a swap has just filled — the one the dragged photo left behind.
  const [arrivingIndex, setArrivingIndex] = useState<number | null>(null);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A flight in progress, and what the grid should show while it lasts.
   *
   * The reorder is applied to state the instant you let go — undo history and
   * autosave should not wait on an animation — so for the length of the flight
   * the model is already one move ahead of what the eye should see. Two cells
   * have to be held back to the way they looked before the drop:
   *
   *   `target` — the cell being flown into. It must not paint its incoming
   *     photo, or the picture is in two places while the clone travels. It
   *     shows `cover`, the photo it held BEFORE the swap, so the slot stays
   *     full: hiding it instead left an empty hole to see straight through.
   *   `vacated` — the cell the photo was lifted out of. It already owns the
   *     displaced photo, but that photo is still visibly in the air over on the
   *     target, so it stays the dashed empty slot until the flight lands.
   *
   * Both revert in the one call that removes the clone, so the entire swap
   * resolves in a single frame underneath it.
   */
  const [landing, setLanding] = useState<{
    target: number;
    cover: CollectionItem;
    vacated: number;
  } | null>(null);

  const pending = useRef<{
    index: number;
    pointerId: number;
    originX: number;
    originY: number;
    img: HTMLImageElement;
    /** The cell being lifted — carries the shader canvas the clone snapshots. */
    cell: HTMLElement;
    /**
     * The photo's box as it was AT THE PRESS, before the press scaled it.
     *
     * `getBoundingClientRect` reports the transformed box, so measuring the
     * photo once a drag begins would hand the clone a box already reduced by
     * the press — and the clone applies that same scale itself, shrinking the
     * picture twice over. Measured once, here, while it is still full size.
     */
    rect: DOMRect;
  } | null>(null);
  const preview = useRef<HTMLElement | null>(null);
  // The photo mid-flight into the cell it was dropped on — no longer the thing
  // under the pointer, and no longer the drag's to clean up.
  const settling = useRef<HTMLElement | null>(null);
  const grab = useRef({ x: 0, y: 0 });

  // The cells register themselves, so the tile under the pointer is found by
  // hit-testing their rects rather than by `elementFromPoint` — the preview is
  // sitting under the cursor, and pointer capture has retargeted the events
  // away from whatever they are over. Six non-overlapping rectangles; the
  // arithmetic is the honest answer and it is testable without a layout engine.
  const cellNodes = useRef(new Map<number, HTMLElement>());

  const cellIndexAt = (x: number, y: number) => {
    for (const [index, node] of cellNodes.current) {
      const r = node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return index;
      }
    }
    return null;
  };

  /** Where the photo sits for a pointer here, keeping the point it was grabbed by. */
  const translateFor = (clientX: number, clientY: number) =>
    `${clientX - grab.current.x}px ${clientY - grab.current.y}px`;

  const beginDrag = (clientX: number, clientY: number) => {
    const held = pending.current;
    if (!held) return;

    // The box from the press, not from now: the photo has since shrunk under
    // the press, and re-measuring would bake that into the clone on top of the
    // scale the clone already carries.
    const rect = held.rect;
    grab.current = { x: held.originX - rect.left, y: held.originY - rect.top };

    const node = held.img.cloneNode(true) as HTMLElement;
    node.className = gridStyles.dragPreview;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    // Carry the background effect with the picture.
    //
    // It cannot be cloned: `cloneNode` copies the <canvas> ELEMENT and not its
    // drawing buffer, so a cloned shader is a blank rectangle. It cannot be
    // re-rendered either — the preview is imperative DOM parented to the body,
    // with no React tree to mount a second shader into.
    //
    // So it is flattened to a still and painted as the clone's BACKGROUND,
    // which is exactly the relationship it has in the cell: the photo's own
    // transparent pixels reveal the gradient behind it. `100% 100%` rather than
    // `cover` because the canvas and the photo fill the same box, so they map
    // one to one — and the still then stretches with the clone as it flies into
    // its new slot.
    //
    // Snapshotting a static shader is lossless (there is only ever one frame),
    // and it happens BEFORE `setDragIndex` marks the cell, while the canvas is
    // still on screen. Guarded because a readback is the one part of this that
    // depends on the GPU: a lost context returns nothing, and a photo that
    // drags without its ground beats a drag that throws.
    const gradient = held.cell.querySelector<HTMLCanvasElement>(
      "[data-background-effect] canvas",
    );
    if (gradient) {
      try {
        node.style.backgroundImage = `url("${gradient.toDataURL()}")`;
        node.style.backgroundSize = "100% 100%";
      } catch {
        // Nothing to carry — the photo travels on its own.
      }
    }
    node.style.translate = translateFor(clientX, clientY);
    // The same anchor the in-grid photo was scaling about, so the handover
    // keeps the pixel under the cursor exactly where it was.
    node.style.transformOrigin = `${grab.current.x}px ${grab.current.y}px`;
    // Marked BEFORE it enters the document, so it is born already carrying the
    // press with no transition to play. The scale-down happened on pointer
    // down, while the photo was still in its cell; the clone is picking that
    // gesture up mid-flow, not starting it again.
    node.dataset.carried = "";
    // Parented to the body so no ancestor's overflow or stacking context can
    // clip the photo as it crosses the page.
    document.body.appendChild(node);
    preview.current = node;

    dragIndexRef.current = held.index;
    setDragIndex(held.index);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (preview.current) {
      preview.current.style.translate = translateFor(clientX, clientY);
    }
    const over = cellIndexAt(clientX, clientY);
    setDropIndex(over === dragIndexRef.current ? null : over);
  };

  /**
   * Flies the carried photo into the cell it was dropped on, and only then
   * hands back to the grid.
   *
   * Without this the photo simply blinks out at the cursor and reappears in its
   * new slot, and nothing on screen connects the two — which reads as the drag
   * having been refused. Landing it is the answer to "where did it go?", the
   * same way a card settles into the column you drop it on.
   *
   * The reorder is applied to state at once, underneath, and the two cells the
   * swap touches are held at their pre-drop appearance for the length of the
   * flight — see `landing`. So nothing in the grid moves until the photo
   * arrives, and then the whole swap resolves in one frame beneath the clone.
   *
   * Returns whether a flight actually started; if it did, it owns announcing
   * the displaced photo's arrival when it lands.
   */
  const settleInto = (
    target: number,
    cover: CollectionItem,
    vacated: number,
  ) => {
    const node = preview.current;
    if (!node) return false;
    // Detached first: whatever ends the drag must not yank it mid-flight.
    preview.current = null;

    const cell = cellNodes.current.get(target);
    const to = (cell?.querySelector("img") ?? cell)?.getBoundingClientRect();
    if (!to || typeof node.animate !== "function") {
      // Nothing is going to fly, so nothing is held back — the swap simply is
      // what the grid shows from this moment.
      node.remove();
      return false;
    }

    settling.current?.remove();
    settling.current = node;
    setLanding({ target, cover, vacated });
    const flight = node.animate(
      [
        {
          translate: node.style.translate,
          scale: getComputedStyle(node).scale || "1",
          rotate: getComputedStyle(node).rotate || "0deg",
          width: node.style.width,
          height: node.style.height,
        },
        {
          translate: `${to.left}px ${to.top}px`,
          // Released, so the press feedback lets go as it settles — it has to
          // land at full size and square to sit flush with the photo already
          // in the slot.
          scale: "1",
          rotate: "0deg",
          width: `${to.width}px`,
          height: `${to.height}px`,
          // The lift goes as it comes to rest, so what lands is flush with the
          // grid rather than a card still hovering over it.
          boxShadow: "none",
        },
      ],
      { duration: LANDING_MS, easing: LANDING_EASE, fill: "forwards" },
    );
    let timer: ReturnType<typeof setTimeout> | null = null;
    const land = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      // ORDER IS EVERYTHING HERE. The swap is committed FIRST, synchronously,
      // and only then does the clone go.
      //
      // Removing the clone first looks equivalent and is not: React batches
      // these updates into a later microtask, and the browser is free to paint
      // in between. That frame shows the cover photo where the clone just was
      // and an empty slot where the displaced photo belongs — both photos
      // flash. `flushSync` collapses the window: by the time the clone is
      // taken away, the cells underneath are already showing their final
      // contents, and the clone was sitting exactly on top of them.
      //
      // The guard is because a second drag can land while this flight is still
      // in the air: by then the state belongs to that one, and clearing it
      // here would resolve its swap early.
      flushSync(() => {
        setLanding((current) => (current?.target === target ? null : current));
        markArriving(vacated);
      });
      node.remove();
      if (settling.current === node) settling.current = null;
    };
    flight.onfinish = land;
    flight.oncancel = land;
    // `onfinish` is not a guarantee: an animation that completes while the tab
    // is hidden can reach `finished` without ever dispatching, which would
    // strand the photo over the grid until something else cleared it. Observed,
    // not theorised. The clock is the backstop — arriving early only costs the
    // flight nobody was watching anyway.
    timer = setTimeout(land, LANDING_MS + 60);
  };

  /**
   * Marks the slot the dragged photo just left, so the one that took its place
   * fades up there.
   *
   * The mark is cleared again because a CSS animation only replays when the
   * attribute driving it goes away and comes back — leave it on and the second
   * swap into the same cell would be silent.
   */
  const markArriving = (index: number) => {
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    setArrivingIndex(index);
    arriveTimer.current = setTimeout(() => {
      setArrivingIndex(null);
      arriveTimer.current = null;
    }, LANDING_MS + 60);
  };

  // Ends the whole gesture, drag or bare press — `pointerup` and
  // `pointercancel` both land here, so a press that never became a drag still
  // lets the photo back up to full size.
  const endDrag = () => {
    pending.current = null;
    dragIndexRef.current = null;
    preview.current?.remove();
    preview.current = null;
    setPressed(null);
    setDragIndex(null);
    setDropIndex(null);
  };

  // Escape abandons a drag you have thought better of. Only bound while one is
  // actually in hand, so the editor's own Escape handling is untouched
  // otherwise.
  useEffect(() => {
    if (dragIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") endDrag();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragIndex]);

  // Unmounting mid-gesture (an undo that drops the block, say) must not leave a
  // photo parented to the body — whether it is still in hand or mid-flight.
  useEffect(
    () => () => {
      preview.current?.remove();
      settling.current?.remove();
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
    },
    [],
  );

  // Six slots, always: the items in order, then empties to fill — except that
  // while a photo is in the air the cell it is heading for goes on showing the
  // one it held before the swap. See `landing`.
  const slots = Array.from({ length: COLLECTION_MAX_ITEMS }, (_, index) =>
    landing?.target === index ? landing.cover : (items[index] ?? null),
  );

  return (
    <>
    <div
      {...rootProps}
      className={gridStyles.root}
      data-collection-grid=""
      // Stands every overlay down for the whole gesture, so the scrim is not
      // blurring the cell you are aiming at.
      //
      // "The whole gesture" starts at the PRESS, not at the drag threshold:
      // the moment a hand is on the photo it is the photo being addressed, not
      // the controls floating over it, so they get out of the way. `pressed`
      // is only ever set for a press that landed on the picture — one that
      // lands on the toolbar is a press on the toolbar, and leaves it alone.
      //
      // And it ends AT THE RELEASE, not when the photo finishes travelling.
      // Deliberately: the blur then has the whole flight to come up, so it is
      // already on the cell when the photo touches down. Holding it until the
      // landing instead put the two in the wrong order — the photo arrived
      // bare and the blur washed over it a beat later, which reads as a glitch
      // on the thing you just dropped. The clone flies over the restored
      // overlay and lands beneath it, which is where it belongs anyway.
      data-reordering={
        pressed !== null || dragIndex !== null ? "" : undefined
      }
    >
      {slots.map((item, index) =>
        item ? (
          <figure
            // Keyed by SLOT, never by the photo in it. Keying on `src` made a
            // swap change both keys, so React destroyed and rebuilt the two
            // cells — including the element the browser was mid-drag on, which
            // then never received its `dragend` and left the drag resolving
            // against a source that no longer existed. The grid is six fixed
            // slots whose contents change; the slot is the identity.
            key={index}
            ref={(node) => {
              if (node) cellNodes.current.set(index, node);
              else cellNodes.current.delete(index);
            }}
            className={gridStyles.cell}
            // The hook the overlay's reveal rule keys on — an attribute rather
            // than a generated class, so the recipe can name it directly.
            data-collection-cell=""
            data-pressed={pressed?.index === index ? "" : undefined}
            // The coordinate is runtime data, so it comes through as a custom
            // property and the recipe keeps the rule. Inherits to the <img>,
            // which is what actually scales.
            style={
              pressed?.index === index
                ? ({ "--press-origin": pressed.origin } as CSSProperties)
                : undefined
            }
            // Empty and dashed while the photo is out of it — from the moment
            // it is lifted until the flight carrying it has landed. Its own
            // replacement is still visibly in the air over the target cell
            // until then, so filling this slot early would show that photo
            // twice.
            data-dragging={
              dragIndex === index || landing?.vacated === index ? "" : undefined
            }
            data-drop-target={dropIndex === index ? "" : undefined}
            data-arriving={arrivingIndex === index ? "" : undefined}
            data-landing={landing?.target === index ? "" : undefined}
            // Stands the overlay down while this cell's properties panel is
            // open: the panel is the editor for this picture now, and a scrim
            // blurring the very gradient being tuned would defeat the preview.
            data-effect-open={effectIndex === index ? "" : undefined}
            // The panel's CSS anchor (→ `--background-effect-panel` in
            // globals.css). Set on exactly ONE cell at a time — with two,
            // anchor resolution silently picks the last in tree order.
            data-effect-anchor={effectIndex === index ? "" : undefined}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              // The photo is the handle. A press that lands on the controls
              // laid over it is a press on those controls, not a grab.
              const img = (event.target as HTMLElement).closest("img");
              if (!img) return;
              // Measured BEFORE the press below, while the photo is still full
              // size — see `pending`'s `rect` note. It is also what makes the
              // press origin below a point INSIDE the photo rather than a page
              // coordinate.
              const rect = img.getBoundingClientRect();
              pending.current = {
                index,
                pointerId: event.pointerId,
                originX: event.clientX,
                originY: event.clientY,
                img: img as HTMLImageElement,
                cell: event.currentTarget,
                rect,
              };
              // Acknowledge the press immediately — before we know whether a
              // drag is coming. Reaching here at all means the press landed on
              // the photo and not on the controls over it, so the toolbar never
              // scales the picture underneath it.
              //
              // Anchored to the point the hand actually landed on, so the
              // picture shrinks TOWARDS the cursor and the pixel under it stays
              // put. About the centre it would slide away instead.
              setPressed({
                index,
                origin: `${event.clientX - rect.left}px ${event.clientY - rect.top}px`,
              });
              // Capture keeps every move and the release coming to this cell
              // even once the pointer has left it, which is what makes the
              // gesture survive crossing the rest of the page. Claimed AFTER
              // the grab is recorded: it throws for a pointer id that is not
              // live, which only a synthetic event can produce, and a drag
              // that works while the pointer stays put beats no drag at all.
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const held = pending.current;
              if (!held || held.pointerId !== event.pointerId) return;
              if (dragIndexRef.current === null) {
                const travelled = Math.hypot(
                  event.clientX - held.originX,
                  event.clientY - held.originY,
                );
                if (travelled < DRAG_THRESHOLD) return;
                beginDrag(event.clientX, event.clientY);
              }
              moveDrag(event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
              const held = pending.current;
              if (!held || held.pointerId !== event.pointerId) return;
              if (dragIndexRef.current !== null) {
                const to = cellIndexAt(event.clientX, event.clientY);
                if (to !== null && to !== held.index) {
                  // Order matters twice over: the photo has to be handed to its
                  // flight before `endDrag` clears the preview out from under
                  // it, and the target's CURRENT photo has to be captured
                  // before `onReorder` swaps it away — that is what the cell
                  // goes on showing while the clone is in the air.
                  const flew = settleInto(to, items[to], held.index);
                  onReorder(held.index, to);
                  // With no flight there is nothing to wait for, so the
                  // displaced photo fades up straight away; otherwise the
                  // landing announces it.
                  if (!flew) markArriving(held.index);
                }
                // Released over a gap, an empty slot or off the grid entirely:
                // nothing moves, and taking the preview away puts the photo
                // straight back where it was, at once and with no animation.
              }
              endDrag();
            }}
            // The system taking the pointer away — a touch that turned into a
            // scroll, a window losing focus — ends the gesture like any other.
            onPointerCancel={endDrag}
          >
            {/* Behind the photo, so it shows through wherever the picture is
                transparent. Before it in the DOM as well as beneath it in the
                stack — see the recipe's `backgroundEffect` slot. */}
            {item.backgroundEffect && (
              <BackgroundEffectLayer
                effect={item.backgroundEffect}
                className={gridStyles.backgroundEffect}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={collectionItemAlt(item)}
              className={gridStyles.image}
              // Images are draggable by default, and that native drag would
              // hijack the pointer gesture with the very bitmap this avoids.
              draggable={false}
            />
            <CellOverlay
              index={index}
              featured={index === 0}
              editing={index === editingIndex}
              hasEffect={Boolean(item.backgroundEffect)}
              effectOpen={effectIndex === index}
              onToggleEffect={() => toggleEffectPanel(index)}
              draft={draft}
              inputRef={inputRef}
              onDraftChange={setDraft}
              onStartEditing={() => startEditing(index)}
              onCommit={() => commit(index)}
              onCancel={() => setEditingSrc(null)}
              onFeature={() => onFeature(index)}
              onReplace={() => onReplace(index)}
              onRemove={() => onRemove(index)}
            />
          </figure>
        ) : (
          <button
            key={index}
            type="button"
            className={emptyCellStyle}
            onClick={onAddImage}
          >
            <AddIcon aria-hidden />
            Add Image
          </button>
        ),
      )}
    </div>

    {/* A SIBLING of the grid, not a child of the cell it edits. The grid root
        carries the editor's showcase-media contract — tabindex and caret key
        handling — and a panel full of inputs inside it would put every
        keystroke through that handler. It is `position: fixed` and anchored to
        the cell, so it takes no space here and needs none. */}
    {effectItem && (
      <BackgroundEffectPanel
        // Remounted per image, so a panel reopened on another picture starts
        // from that picture's values rather than the previous one's drafts.
        key={effectItem.src}
        // Falls back to the defaults rather than waiting for the item to come
        // back carrying them. Opening the panel already emitted them upwards,
        // but that is a ROUND TRIP through the parent, and gating the panel on
        // it made the first click appear to do nothing whenever the parent was
        // slow to echo — or, for a consumer that only observes, forever.
        effect={effectItem.backgroundEffect ?? DEFAULT_BACKGROUND_EFFECT}
        onChange={(effect) => onSetBackgroundEffect(effectIndex, effect)}
        onRemove={() => {
          setEffectSrc(null);
          onSetBackgroundEffect(effectIndex, undefined);
        }}
        onDismiss={() => setEffectSrc(null)}
      />
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Per-cell controls
// ---------------------------------------------------------------------------

interface CellOverlayProps {
  index: number;
  featured: boolean;
  editing: boolean;
  hasEffect: boolean;
  effectOpen: boolean;
  onToggleEffect: () => void;
  draft: string;
  inputRef: Ref<HTMLInputElement>;
  onDraftChange: (value: string) => void;
  onStartEditing: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onFeature: () => void;
  onReplace: () => void;
  onRemove: () => void;
}

function CellOverlay({
  index,
  featured,
  editing,
  hasEffect,
  effectOpen,
  onToggleEffect,
  draft,
  inputRef,
  onDraftChange,
  onStartEditing,
  onCommit,
  onCancel,
  onFeature,
  onReplace,
  onRemove,
}: CellOverlayProps) {
  const styles = collectionCellOverlay();
  const label = `Image ${index + 1}`;

  // The caption editor stands WHERE the toolbar stands, but is a card rather
  // than a pill — a margin note on the picture, wearing the sidenote's clothes.
  if (editing) {
    return (
      <div className={styles.root}>
        <div className={styles.scrim} aria-hidden />
        <div className={styles.captionCard}>
          <input
            ref={inputRef}
            type="text"
            aria-label="Image caption"
            placeholder="Add caption..."
            className={styles.captionField}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            // Leaving the field commits. Losing a caption you just typed to a
            // stray click elsewhere is a worse failure than committing one you
            // were unsure about — Escape is the way to discard.
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                // Stop the editor's block-level Escape handling: this key press
                // belongs to the field it is closing.
                event.stopPropagation();
                onCancel();
              }
            }}
          />
          <div className={editRow.hint} aria-hidden>
            <span className={editRow.hintKey}>Esc</span>
            <span className={editRow.hintLabel}>to exit</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.scrim} aria-hidden />
      <div className={styles.toolbar}>
        <OptionList direction="inline">
          <OptionList.Toolbar aria-label={`${label} actions`}>
            {/* Featured is a POSITION (index 0), so the first slot's button is
                simply already on. Pressed rather than disabled: a disabled
                button dims to 40%, which would fight the brand chip that is
                the whole signal here. */}
            <OptionList.Option
              aria-label="Feature image"
              pressed={featured}
              onClick={() => {
                if (!featured) onFeature();
              }}
            >
              <FeatureIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Divider />
            <OptionList.Option
              aria-label="Edit image caption"
              onClick={onStartEditing}
            >
              <EditIcon aria-hidden />
            </OptionList.Option>
            {/* Pressed while the image HAS an effect, not merely while the
                panel is open — the button reports the picture's state, and the
                panel closing does not take the gradient away. (It is also
                never visible while its own panel is open: the overlay stands
                down for that cell.) */}
            <OptionList.Option
              aria-label="Background effect"
              pressed={hasEffect || effectOpen}
              onClick={onToggleEffect}
            >
              <ShaderIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Replace image" onClick={onReplace}>
              <ReplaceIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Remove image" onClick={onRemove}>
              <TrashIcon aria-hidden />
            </OptionList.Option>
          </OptionList.Toolbar>
        </OptionList>
      </div>
    </div>
  );
}
