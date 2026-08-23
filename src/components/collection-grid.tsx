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
  collectionCellToolbar,
  collectionEmptyCell,
  collectionGrid,
  toolbar,
} from "../../styled-system/recipes";
import { cx } from "../../styled-system/css";
import { OptionList } from "@/components/ui/input/option-list";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { MediaPropertiesPanel } from "@/components/media-properties-panel";
import {
  PROPERTIES_TRIGGER_ATTR,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import {
  COLLECTION_MAX_ITEMS,
  mediaRadiusPx,
  type BackgroundEffect,
  type CollectionItem,
} from "@/domain/nodes";
import type { MediaLayoutPatch } from "@/utils/collection-items";
import { useImageTransparency } from "@/hooks/use-image-transparency";
import { collectionItemAlt } from "@/utils/collection-items";
import AddIcon from "@/assets/icons/add.svg";
import FeatureIcon from "@/assets/icons/feature.svg";
import PropertiesIcon from "@/assets/icons/slider.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// CollectionGrid — the collection block's authoring surface.
//
// Every slot is drawn, filled or not, so the six-image cap reads as a shape
// rather than as an error you discover by hitting it. A filled slot reveals its
// controls on hover; an empty one is a single "Add Media" button.
//
// The component is deliberately stateless about the collection itself: it takes
// an ordered `items` array and emits intent (feature / caption / replace /
// remove / add). All the array algebra lives in `@/utils/collection-items`, and
// the parent owns undo granularity — a reorder or a removal has to be one clean
// history step, which it can't be if it rides a caption-typing debounce.
// ---------------------------------------------------------------------------

const gridStyles = collectionGrid({ layout: "uniform" });
const emptyCellStyle = collectionEmptyCell();

/**
 * How far a press has to travel before it counts as a drag rather than a click.
 * The controls sit over the photo, so a button that nudged the tile every time
 * a hand wobbled on it would be unusable.
 */
const DRAG_THRESHOLD = 4;

/**
 * The elements a cell can be showing — a photo or a clip (see `Media`). The
 * gesture treats them identically: whichever one is in the slot is the drag
 * handle, the box the press is measured against, and the thing that gets
 * cloned onto the cursor.
 */
const MEDIA_TAGS = "img, video";

/**
 * How long the dropped photo takes to travel into the cell it landed on — and
 * how long the photo it displaced takes to fade up in the slot it vacated. The
 * two halves of a swap settle together. Kept in step with the
 * `collectionArrive` keyframe's duration in `panda.config.ts`.
 *
 * THIS is the snappiness knob, not the curve. The travel's easing
 * (`LANDING_TRANSLATE_EASE_X`) is written in percentages, so this number alone
 * decides whether its overshoot is a flick or a wobble — and at 280ms it was a
 * wobble, the bounce stretched nearly 3× against what the curve described.
 *
 * Deliberately UNCHANGED when the travel was retuned from a spring to an
 * elastic curve. Measured at this duration the two land within a millisecond of
 * each other (arriving at 21ms against 22ms, peaking at 35ms against 34ms), so
 * the swap is a change of character and not of pace — which is the point, since
 * this pace is the one that reads as snappy. Running the elastic curve at its
 * own source timing instead would mean 161ms, and it arrives at 35ms and rests
 * at 121ms there: recognisably the same motion, noticeably less urgent.
 *
 * It also lands the release exactly on top of the press. The cell's photo
 * scales under a finger over `100ms ease` (see the `image` slot in
 * `panda.config.ts`), so letting go over the same 100ms makes the two halves of
 * the same gesture symmetrical rather than merely similar.
 *
 * The note this replaces said "not shorter than 280ms", on the grounds that a
 * DECELERATE curve has nothing legible left after its first few frames. An
 * overshooting curve is not subject to that: what carries it is a change of
 * DIRECTION, which reads in two frames where a slowing-down needs many.
 */
const LANDING_MS = 100;

/**
 * Everything about the landing EXCEPT the travel: the press letting go, and the
 * box resizing into the slot it is joining. Plain `ease-out`, the easing the
 * rest of the system's transitions use — these are settling gestures with
 * nowhere to overshoot to.
 *
 * Deliberately not one of the aggressive decelerate curves. Measured over this
 * distance, `cubic-bezier(0.05, 0.7, 0.1, 1)` put 62% of the travel in the
 * first 10% of the time and 95% in the first half — which reads as a snap
 * followed by an imperceptible crawl, i.e. less legible than the gentler curve,
 * not more.
 */
const LANDING_EASE = "ease-out";

/**
 * The curve the dropped photo TRAVELS on horizontally — `translate`, and
 * nothing else. Its vertical twin is `LANDING_TRANSLATE_EASE_Y`, and the two
 * differing is what bends the drop into an arc rather than a straight line.
 *
 * ELASTIC: it accelerates into the slot rather than bolting for it, crosses at
 * a fifth of the way through, overshoots by 9%, and holds that overshoot for a
 * beat before easing back through a shallow undershoot. That overshoot is what
 * exempts it from the objection recorded on `LANDING_EASE` above, rather than
 * contradicting it. A front-loaded DECELERATE curve is illegible because
 * everything after the first few frames is an imperceptible crawl towards a
 * target it has effectively already reached; an elastic one spends those same
 * frames moving VISIBLY, in the other direction. Snappy and legible are the
 * same mechanism here, not a trade between them.
 *
 * It replaces a stiffer spring that reached the slot in a single burst and
 * overshot 12%. Same envelope to the millisecond at this duration — see
 * `LANDING_MS` — so what changed is the character of the approach: the photo
 * now gathers speed into its slot and hangs a moment past it, instead of
 * snapping there and rebounding.
 *
 * `translate` ALONE, in an animation of its own, because past 1 this curve
 * means "further than the target". On position that is a photo sliding a little
 * past its slot and coming back. On `width`/`height` it would be a card
 * swelling bigger than the slot it is landing in, and on `boxShadow` it is not
 * even meaningful — there is nothing past `none`.
 *
 * The stops are the source curve's, rescaled by 1/0.576. The source is flat at
 * 1 from 57.6% to 100%, and the flight is what tells the grid to COMMIT the
 * swap (see `settleInto`) — so carrying that tail would leave the photo landed
 * and the grid waiting, with the photo it displaced not yet fading up in the
 * slot it vacated. Rescaled, the flight ends when the motion does.
 *
 *   source: linear(0, 0.029 1.3%, 0.119 2.8%, 0.659 8.7%, 0.871 11.6%,
 *                  1.009 14.6%, 1.052 16.2%, 1.078 17.9%, 1.088 19.7%,
 *                  1.085 21.7%, 1.014 31.4%, 0.993 38%, 1.001 57.6%, 1)
 *
 * Measured against `LANDING_MS`: the photo is on its slot at 22ms, 9% past it
 * at 34ms, and at rest by 75ms.
 *
 * The rescale is a change of units, never of motion — `rescaled @ D` and
 * `source @ D/0.576` are the same animation — so this curve and `LANDING_MS`
 * are ONE setting in two halves. Retime at `LANDING_MS`, never here. And if a
 * curve is ever swapped in without rescaling its stops, `LANDING_MS` has to
 * absorb the whole of that curve's own tail or the drop stalls at the end.
 */
const LANDING_TRANSLATE_EASE_X =
  "linear(0, 0.029 2.26%, 0.119 4.86%, 0.659 15.1%, 0.871 20.14%, 1.009 25.35%, 1.052 28.13%, 1.078 31.08%, 1.088 34.2%, 1.085 37.67%, 1.014 54.51%, 0.993 65.97%, 1)";

/**
 * The vertical half of the travel, and it LEADS. This curve puts 62% of the
 * descent into the first tenth of the flight, where the elastic one has managed
 * 39% — and that mismatch IS the curve in the path: the photo falls towards
 * its row before it has finished crossing to it, so it arcs instead of running
 * the diagonal. Measured against it: vertical is up to 32% ahead through the
 * first sixth, the two cross at ~18%, and the horizontal then overtakes and
 * overshoots. As motion, it drops in, swings across, and settles back.
 *
 * Left alone when the horizontal was retuned from a spring to an elastic curve,
 * and checked rather than assumed: the gap peaks at the same 32%, because what
 * sets it is how fast THIS curve leaves the line (45% inside the first
 * twentieth) and both horizontals are near nothing that early.
 *
 * The pairing is chosen, not inherited. Plain `ease-out` is far too slow off
 * the line here — the same gap peaks at 66% and the other way about, so the
 * photo travels most of the way ACROSS before it has meaningfully begun to
 * descend, which stops reading as a curve and starts reading as an L. This one
 * front-loads hard enough to stay a bow.
 *
 * And the OVERSHOOTING curve is the horizontal one, deliberately. It has to go
 * somewhere, and vertically there is nowhere for it to go: the grid is two rows
 * inside a prose column, so a photo dropped in the top row would swing up over
 * the heading and back. Across, the overshoot spends itself over the grid's own
 * cells. Swapping which axis carries it is these two constants trading places.
 */
const LANDING_TRANSLATE_EASE_Y = "cubic-bezier(0.05, 0.7, 0.1, 1)";

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
  /** Patches how one image sits in its frame — its fit and/or its inset. */
  onSetLayout: (index: number, patch: MediaLayoutPatch) => void;
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
  onSetLayout,
}: CollectionGridProps) {
  // The image whose properties panel is open, keyed on the IMAGE and not on
  // the slot. Featuring an image moves it to another cell and removing one
  // slides its neighbours along, so a stored index would strand the open panel
  // on whatever took that slot — captioning or retuning the wrong picture.
  // Pinning to `src` makes "the panel follows its image" and "the panel closes
  // when its image is gone" fall out of a plain lookup, with no effect to keep
  // them in sync.
  const [propertiesSrc, setPropertiesSrc] = useState<string | null>(null);
  // Closing goes through the PANEL, never through this state directly — see
  // `togglePropertiesPanel`.
  const propertiesPanelRef = useRef<PropertiesPanelHandle>(null);

  const propertiesIndex = propertiesSrc
    ? items.findIndex((item) => item.src === propertiesSrc)
    : -1;
  const propertiesItem = propertiesIndex === -1 ? null : items[propertiesIndex];

  // Which of these pictures you can see through. A transparent screenshot with
  // no gradient behind it is standing on the page, and on a dark theme a dark
  // screenshot exported on a transparent canvas simply is not there — nothing
  // on screen distinguishes "the picture has no background" from "the slot is
  // empty" or "the upload failed". The checkerboard is what says it, in the
  // vocabulary every image editor already uses for it.
  //
  // PICTURES only, and the filter is load-bearing rather than an optimisation.
  // The scan decodes with `new Image()`, so a clip sent through it spends two
  // failed loads to answer a question a video could not have had — and it is
  // the extensionless R2 key, the case this whole `kind` field exists for, that
  // would reach it. Filtered HERE and not inside the hook: `kind` is the item's
  // own word about itself, and pushing it down would teach a hook that knows
  // about alpha channels and `<canvas>` what a document node is.
  const transparentSrcs = useImageTransparency(
    items.filter((item) => item.kind === "image").map((item) => item.src),
  );

  /**
   * Opens the properties panel for a slot — or closes it, if that slot's panel
   * is the one already open.
   *
   * Opening applies NOTHING. The panel's sections each own their property, and
   * adding one is a click inside the panel: reaching for this button is a
   * request to SEE the properties of a picture, which must not be the same
   * gesture as giving it a gradient it didn't have.
   *
   * Closing ASKS the panel rather than dropping it from the tree. Clearing
   * this state unmounts it on the spot, which takes its closing slide with it
   * — the panel arrives from the edge of the screen and would simply blink
   * out. It calls back when it has finished leaving.
   */
  function togglePropertiesPanel(index: number) {
    const item = items[index];
    if (propertiesSrc === item.src) {
      propertiesPanelRef.current?.dismiss();
      return;
    }
    setPropertiesSrc(item.src);
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
  /**
   * The pointer is sitting where a drag left it, and has not been moved since.
   *
   * A drag ends with the cursor over the photo you dropped — necessarily, that
   * is what dropping it there means. `:hover` cannot tell that apart from
   * reaching for the picture, so without this the controls come up the instant
   * you let go, as an answer to a question nobody asked. The cursor's position
   * is DESCRIBING the gesture that just finished, not requesting anything.
   *
   * So the overlay stays down until the pointer moves — and moving it is the
   * whole ask, not travelling any particular distance. Cleared by the keyboard
   * too, since the suppression is blunt enough to hide a toolbar you had tabbed
   * into.
   */
  const [pointerIdle, setPointerIdle] = useState(false);
  /**
   * Where it came to rest, so a `pointermove` dispatched at the position the
   * pointer already occupies — which is a move in name only — does not count as
   * one. Written from `lastPoint` rather than from an event, so the three ways a
   * drag can end (release, cancel, Escape) all arm this the same way.
   */
  const restPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPoint = useRef({ x: 0, y: 0 });
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
    /** The photo or the clip — whichever element the cell is showing. */
    media: HTMLElement;
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

    const node = held.media.cloneNode(true) as HTMLElement;
    node.className = gridStyles.dragPreview;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    // The corner the CELL was drawing on this picture, resolved to PIXELS for
    // the journey.
    //
    // An INSET picture is not touching the cell's edge, so the corner on screen
    // is its own — and the clone carries the picture's inline style, where that
    // corner is a `cqw` share of the cell that was its query container.
    // Parented to <body> the clone has no container at all, so the same
    // declaration would resolve against the viewport and put a corner several
    // times the right size on the thing in hand. Same arithmetic, against the
    // box we already measured.
    //
    // A picture that FILLS its slot is a different matter: what you see is the
    // card's corner, because the cell clips it there. The clone has no cell
    // around it to do the clipping, so it takes that corner from its own class
    // (see the `dragPreview` slot) — and the cloned inline `cqw` has to be
    // CLEARED for the class to be reached at all. Left in place it would not
    // merely be the wrong shape, it would be the viewport's share of it.
    const carried = items[held.index];
    node.style.borderRadius = carried?.padding
      ? `${mediaRadiusPx(carried, rect.width)}px`
      : "";
    // A cloned <video> is a video with nothing playing in it: `cloneNode`
    // copies attributes, and React never wrote the `muted` one, so the clone
    // would sit on frame zero while the cell it left goes on playing. Muted and
    // wound to the same playhead, it takes the performance over mid-frame —
    // which is the same handover the press does (see `data-carried`).
    if (node instanceof HTMLVideoElement && held.media instanceof HTMLVideoElement) {
      node.muted = true;
      node.currentTime = held.media.currentTime;
      void node.play()?.catch(() => {});
    }
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
    lastPoint.current = { x: clientX, y: clientY };
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
    const to = (cell?.querySelector(MEDIA_TAGS) ?? cell)?.getBoundingClientRect();
    if (!to || typeof node.animate !== "function") {
      // Nothing is going to fly, so nothing is held back — the swap simply is
      // what the grid shows from this moment.
      node.remove();
      return false;
    }

    settling.current?.remove();
    settling.current = node;
    setLanding({ target, cover, vacated });

    // Read BEFORE either animation starts — once one is running with
    // `fill: forwards`, the computed values are the animation's own.
    const held = getComputedStyle(node);
    const from = {
      translate: node.style.translate,
      scale: held.scale || "1",
      rotate: held.rotate || "0deg",
    };

    // THREE animations over the same 280ms — two for the travel, one axis
    // each, and one for everything that merely settles (the press releasing,
    // the box resizing into its new slot).
    //
    // The travel is split because `translate` is ONE property taking two
    // values, so a single animation can only ease both axes identically, which
    // is a straight line by construction. `composite: "add"` is what gets round
    // that: each animation contributes a DELTA that is summed onto the
    // underlying inline `translate` the drag left behind, rather than replacing
    // it, so `base + dx·easeX(t) + dy·easeY(t)` is a curve whenever the two
    // easings disagree. (Same trick, different lever, as the disjoint property
    // sets that let the settle below carry its own easing.)
    //
    // Deltas, therefore, not destinations: the keyframes are what to ADD, and
    // the photo's current position is the base they add to.
    const [fromX, fromY] = from.translate
      .split(" ")
      .map((value) => parseFloat(value) || 0);
    const travel = (dx: number, dy: number, easing: string) =>
      node.animate([{ translate: "0px 0px" }, { translate: `${dx}px ${dy}px` }], {
        duration: LANDING_MS,
        easing,
        fill: "forwards",
        composite: "add",
      });

    const flight = travel(to.left - fromX, 0, LANDING_TRANSLATE_EASE_X);
    travel(0, to.top - fromY, LANDING_TRANSLATE_EASE_Y);
    node.animate(
      [
        {
          scale: from.scale,
          rotate: from.rotate,
          width: node.style.width,
          height: node.style.height,
        },
        {
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
    // Only a gesture that actually TRAVELLED parks the cursor somewhere it was
    // not put deliberately. A press that never became a drag leaves it exactly
    // where the hand placed it, so the hover it is sitting in is the one it
    // asked for and must not be taken away.
    if (dragIndexRef.current !== null) {
      restPoint.current = { ...lastPoint.current };
      setPointerIdle(true);
    }
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

  // Waiting to be asked for. Bound only while the overlay is actually being
  // held down, so the ordinary case pays for no document listeners at all.
  //
  // On the DOCUMENT rather than the grid: leaving the grid entirely is a move
  // like any other, and the next thing that should happen is the overlay
  // behaving normally — not staying suppressed until the pointer wanders back.
  useEffect(() => {
    if (!pointerIdle) return;
    const wake = () => setPointerIdle(false);
    const onPointerMove = (event: PointerEvent) => {
      const rest = restPoint.current;
      if (rest && event.clientX === rest.x && event.clientY === rest.y) return;
      wake();
    };
    document.addEventListener("pointermove", onPointerMove);
    // Focus is discrete, so React flushes this synchronously and the overlay is
    // up in the same frame the toolbar takes focus — no frame of a focused
    // control nobody can see.
    document.addEventListener("focusin", wake);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("focusin", wake);
    };
  }, [pointerIdle]);

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
      // Stands every cell's control rail down for the whole gesture, so
      // nothing is floating over the cell you are aiming at.
      //
      // "The whole gesture" starts at the PRESS, not at the drag threshold:
      // the moment a hand is on the photo it is the photo being addressed, not
      // the controls floating over it, so they get out of the way. `pressed`
      // is only ever set for a press that landed on the picture — one that
      // lands on the toolbar is a press on the toolbar, and leaves it alone.
      //
      // And it ends AT THE RELEASE, not when the photo finishes travelling —
      // but what comes back at the release is only the RIGHT to be hovered.
      // `data-pointer-idle` below then holds the overlay down until the pointer
      // is moved, so in practice nothing washes over a photo mid-flight unless
      // the hand is already reaching for it.
      //
      // (This used to be the whole story, on the reasoning that releasing early
      // gave the rail the length of the flight to fade up, so it was on the
      // cell as the photo touched down. That was answering "when may the
      // controls return?" with a time, when the honest answer is a gesture.)
      data-reordering={
        pressed !== null || dragIndex !== null ? "" : undefined
      }
      // The cursor is where the drag left it and has not moved since, so
      // nothing has been asked for — see `pointerIdle`. Stands the overlay down
      // over whichever cell it happens to be sitting on.
      data-pointer-idle={pointerIdle ? "" : undefined}
    >
      {slots.map((item, index) =>
        item ? (
          // The cell AND the rail that edits it, as one grid item. The cell
          // clips — that is what rounds a photo filling it — and the rail is
          // centred on the cell's top edge with half of it outside, so the two
          // have to be siblings in a box that does not clip. See the recipe's
          // `slot` slot, and `grid-item.tsx`, which pairs a home-grid card with
          // its toolbar the same way and for the same reason.
          //
          // Keyed by SLOT, never by the photo in it. Keying on `src` made a
          // swap change both keys, so React destroyed and rebuilt the two
          // cells — including the element the browser was mid-drag on, which
          // then never received its `dragend` and left the drag resolving
          // against a source that no longer existed. The grid is six fixed
          // slots whose contents change; the slot is the identity.
          <div key={index} className={gridStyles.slot}>
            <figure
              ref={(node) => {
                if (node) cellNodes.current.set(index, node);
                else cellNodes.current.delete(index);
              }}
              className={gridStyles.cell}
              // The hook the rail's reveal rule keys on — an attribute rather
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
              // Which picture the open panel is editing. The control rail is
              // NOT styled off it — a cell whose panel is open behaves like
              // every other one — but the state is worth surfacing on the
              // element it is about rather than living only inside this
              // component.
              data-properties-open={propertiesIndex === index ? "" : undefined}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                // The picture is the handle — a clip as much as a photo. A
                // press that lands on the controls laid over it is a press on
                // those controls, not a grab.
                const media = (event.target as HTMLElement).closest(MEDIA_TAGS);
                if (!media) return;
                // Measured BEFORE the press below, while the photo is still
                // full size — see `pending`'s `rect` note. It is also what
                // makes the press origin below a point INSIDE the photo rather
                // than a page coordinate.
                const rect = media.getBoundingClientRect();
                pending.current = {
                  index,
                  pointerId: event.pointerId,
                  originX: event.clientX,
                  originY: event.clientY,
                  media: media as HTMLElement,
                  cell: event.currentTarget,
                  rect,
                };
                // Acknowledge the press immediately — before we know whether a
                // drag is coming. Reaching here at all means the press landed
                // on the photo and not on the controls over it, so the toolbar
                // never scales the picture underneath it.
                //
                // Anchored to the point the hand actually landed on, so the
                // picture shrinks TOWARDS the cursor and the pixel under it
                // stays put. About the centre it would slide away instead.
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
                    // Order matters twice over: the photo has to be handed to
                    // its flight before `endDrag` clears the preview out from
                    // under it, and the target's CURRENT photo has to be
                    // captured before `onReorder` swaps it away — that is what
                    // the cell goes on showing while the clone is in the air.
                    const flew = settleInto(to, items[to], held.index);
                    onReorder(held.index, to);
                    // With no flight there is nothing to wait for, so the
                    // displaced photo fades up straight away; otherwise the
                    // landing announces it.
                    if (!flew) markArriving(held.index);
                  }
                  // Released over a gap, an empty slot or off the grid
                  // entirely: nothing moves, and taking the preview away puts
                  // the photo straight back where it was, at once and with no
                  // animation.
                }
                endDrag();
              }}
              // The system taking the pointer away — a touch that turned into a
              // scroll, a window losing focus — ends the gesture like any
              // other.
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
              {/* A clip in a cell is a tile like any other — no transport,
                  since the cell's own gesture is a press-and-drag and a
                  control strip laid over it would take the grip away. */}
              <Media
                src={item.src}
                // The item's own word about what it is — never re-derived from
                // the src here, so a clip under an extensionless key shows as a
                // clip in the grid the author is arranging.
                kind={item.kind}
                alt={collectionItemAlt(item)}
                className={gridStyles.image}
                // Fit and inset are per-picture DATA, so they ride as a style
                // rather than as recipe variants — a slider that emits a value
                // per frame has nothing a static variant table could enumerate.
                // The padding shrinks the picture's content box while the
                // gradient behind it stays sized to the whole cell, which is
                // what lets the ground out from under a photo that would
                // otherwise cover it.
                layout={item}
                // The checkerboard, which is the photo's OWN background rather
                // than a layer behind it — see the recipe's `image` slot. So it
                // is the exclusive alternative to a gradient and not a
                // companion to one: a background box paints over any sibling
                // behind it, and a picture that has been given a ground does
                // not need one offered.
                data-checkered={
                  !item.backgroundEffect && transparentSrcs.has(item.src)
                    ? ""
                    : undefined
                }
                // Images are draggable by default, and that native drag would
                // hijack the pointer gesture with the very bitmap this avoids.
                draggable={false}
              />
            </figure>
            <CellToolbar
              index={index}
              featured={index === 0}
              propertiesOpen={propertiesIndex === index}
              onToggleProperties={() => togglePropertiesPanel(index)}
              onFeature={() => onFeature(index)}
              onReplace={() => onReplace(index)}
              onRemove={() => onRemove(index)}
            />
          </div>
        ) : (
          <button
            key={index}
            type="button"
            className={emptyCellStyle}
            onClick={onAddImage}
          >
            <AddIcon aria-hidden />
            Add Media
          </button>
        ),
      )}
    </div>

    {/* A SIBLING of the grid, not a child of the cell it edits. The grid root
        carries the editor's showcase-media contract — tabindex and caret key
        handling — and a panel full of inputs inside it would put every
        keystroke through that handler. It docks to the viewport (and portals
        to the body to get there), so it takes no space here and needs none. */}
    {propertiesItem && (
      <MediaPropertiesPanel
        ref={propertiesPanelRef}
        // Remounted per image, so a panel reopened on another picture starts
        // from that picture's values rather than the previous one's drafts —
        // and its sections re-derive which of them are open.
        key={propertiesItem.src}
        objectFit={propertiesItem.objectFit}
        onObjectFitChange={(fit) =>
          onSetLayout(propertiesIndex, { objectFit: fit })
        }
        padding={propertiesItem.padding}
        onPaddingChange={(padding) =>
          onSetLayout(propertiesIndex, { padding })
        }
        borderRadius={propertiesItem.borderRadius}
        onBorderRadiusChange={(borderRadius) =>
          onSetLayout(propertiesIndex, { borderRadius })
        }
        caption={propertiesItem.caption}
        onCaptionChange={(caption) => onEditCaption(propertiesIndex, caption)}
        effect={propertiesItem.backgroundEffect}
        onEffectChange={(effect) =>
          onSetBackgroundEffect(propertiesIndex, effect)
        }
        onDismiss={() => setPropertiesSrc(null)}
      />
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Per-cell controls
// ---------------------------------------------------------------------------

interface CellToolbarProps {
  index: number;
  featured: boolean;
  /** Whether THIS cell's properties panel is the one currently open. */
  propertiesOpen: boolean;
  onToggleProperties: () => void;
  onFeature: () => void;
  onReplace: () => void;
  onRemove: () => void;
}

function CellToolbar({
  index,
  featured,
  propertiesOpen,
  onToggleProperties,
  onFeature,
  onReplace,
  onRemove,
}: CellToolbarProps) {
  const label = `Image ${index + 1}`;

  return (
    <div className={cx(toolbar(), collectionCellToolbar())}>
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
          {/* ONE button for everything about the picture that isn't an
              action on the picture. Caption and background each had their
              own before, which put two editors on a five-button pill and
              made "add a caption" and "add a gradient" look like different
              KINDS of thing; they are both properties, and the panel is
              where properties are.

              Pressed while its own panel is OPEN — the state it reports is
              the panel's, not the picture's. It is the way back out as well
              as in, so it has to look held down while it is holding
              something open. The rail behaves no differently over a cell
              being edited than over any other one, so the button is always
              there to be pressed again and close the panel.

              Marked as the panel's trigger so that second press actually
              closes it — see PROPERTIES_TRIGGER_ATTR. */}
          <OptionList.Option
            {...PROPERTIES_TRIGGER_ATTR}
            aria-label="Image properties"
            pressed={propertiesOpen}
            onClick={onToggleProperties}
          >
            <PropertiesIcon aria-hidden />
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
  );
}
