import { defineSlotRecipe } from "@pandacss/dev";

/**
 * The transparency checkerboard — the ground under a picture that has an alpha
 * channel and no background effect of its own.
 *
 * Painted as the PICTURE'S OWN background rather than as a layer behind it,
 * which the gradient has to be. A background box is the one ground that cannot
 * come apart from the thing standing on it: it clips to the same corners, and
 * it takes the editor's press scale and tilt for free, where the shader needed
 * its own transform rules stated to keep up. It is also why the drag clone gets
 * this for nothing — the clone IS the <img>, so the checkerboard travels with
 * it exactly as the gradient's snapshot does.
 *
 * Two 8px squares in a 16px tile, from the app's own surfaces rather than the
 * usual white/grey: on a dark theme a grey checkerboard is a light box behind a
 * dark picture. `canvas` and `surface` are one neutral step apart in either
 * theme, which is enough to read as a pattern and not enough to compete with
 * the artwork it is holding up.
 */
const transparencyCheckerboard = {
  backgroundColor: "bg.canvas",
  backgroundImage:
    "conic-gradient(token(colors.bg.surface) 25%, transparent 0 50%, token(colors.bg.surface) 0 75%, transparent 0)",
  backgroundSize: "token(spacing.xl) token(spacing.xl)",
} as const;

export const collectionGrid = defineSlotRecipe({
  className: "collection-grid",
  description:
    "Collection tile grid — a 3×2 slot grid in the editor, and in the reader a featured 2×2 with two stacked tiles (3+ images), an equal pair (2), or a single natural-ratio tile (0–1). Figma 828:6837/826:6501 editor, 829:6911/828:6658 reader.",
  slots: [
    "root",
    "slot",
    "cell",
    "tile",
    "image",
    "backgroundEffect",
    "dragPreview",
    "surplus",
    "surplusDivider",
    "surplusLabel",
  ],
  base: {
    root: {
      display: "grid",
      // 20px, and sized by what has to FIT between two cards rather
      // than by the grid on its own: the editor's control rail is a
      // 40px pill centred on a cell's TOP EDGE, so exactly half of it
      // hangs into the row above. At 20px that overhang lands in the
      // gap instead of over the neighbouring photo.
      gap: "xxl",
      width: "token(spacing.full)",
      maxWidth: "token(sizes.articleShowcase)",
      // Reordering is a pointer gesture rather than a native drag, so
      // the two things a native drag would have handled are stated
      // here: the cursor for the whole grip, and the selection that a
      // press-and-sweep across the editor would otherwise start.
      "&[data-reordering]": { cursor: "grabbing", userSelect: "none" },
    },
    // The editor's grid item: a cell and the control rail that belongs
    // to it, as one box. The cell CLIPS — that is what rounds a photo
    // filling its slot, since a picture nobody has rounded carries a
    // corner of zero (`DEFAULT_MEDIA_RADIUS`) — and the rail is centred
    // on the cell's top edge with half of it outside. A rail inside the
    // cell would be sliced off along that edge, so the two are siblings
    // in a box that does not clip, exactly as a home-grid card and its
    // toolbar are (see `grid-item-toolbar.tsx`).
    //
    // `grid` rather than `block` so the cell stretches to the slot in
    // BOTH axes without having to restate a size; the rail is absolute,
    // so it never becomes a second track. The reader has no rail and no
    // wrapper — its tiles are grid items themselves.
    slot: { position: "relative", display: "grid" },
    cell: {
      position: "relative",
      overflow: "hidden",
      // The CARD's corner — a constant of the design system, and
      // nothing to do with the picture inside it. The properties
      // panel's slider rounds the media OBJECT and only the media
      // object; this is the container that object and its ground sit
      // in, and it wears the same corner every surface of its kind
      // wears (`radii.xxl`, which the empty slot beside it and the
      // surplus badge over it already draw).
      //
      // The two are independent by design, not in tension: the cell
      // clips at this radius, so a picture filling its slot takes the
      // card's shape, and the picture's OWN corner is what shows once
      // an inset lifts it off this edge — exactly as
      // `MEDIA_RADIUS_STEP` describes it.
      //
      // `xl`, the corner a demo frame draws: a collection is a showcase
      // block sitting in the same column as those, so the two read as
      // the same kind of surface. Four other boxes are this same card
      // seen from somewhere else and move with it — the empty slot, the
      // hover scrim, the clone in hand, and the lightbox's ground.
      borderRadius: "xl",
      // Editor cells only — the reader's tiles carry `zoom-in` on the
      // button that opens the lightbox.
      "&[data-media-cell]": { cursor: "grab" },
      // Pressing a photo answers the hand the way pressing a button
      // does, over the same 100ms as `action`'s `_active` — but at
      // TWICE its travel: 0.94 against the button's 0.97. A deliberate
      // divergence, not an oversight. A 40px control only has to twitch
      // to be felt; a 312px tile moving 3% still reads as sitting
      // still, because what registers is the shift against the tile's
      // own size, not the absolute pixels.
      //
      // KEEP IN STEP with `dragPreview`'s `&[data-carried]` below — the
      // clone takes this exact gesture over mid-press, and any gap
      // between the two shows up as the photo flinching at the moment
      // the drag begins. The two cannot share a custom property: the
      // clone is parented to <body>, outside this subtree.
      //
      // On POINTER DOWN, not when the drag threshold is crossed: the
      // grid has to acknowledge the press before it knows whether a
      // drag is coming, or holding a photo feels like holding nothing.
      //
      // Scoped to the direct picture — an <img> or a <video>, whichever
      // the cell is showing (see `Media`) — so it never reaches the
      // controls laid over it, and a press that LANDS on those never
      // sets this state at all, since the toolbar is not a drag handle.
      // Scaled ABOUT the point the hand landed on, which the component
      // supplies as `--press-origin` on the cell. Shrinking about the
      // centre slides the picture away from the cursor, so the pixel
      // you pressed is no longer the pixel you are holding; anchoring
      // there keeps it under the pointer. `center` only as a fallback,
      // for a state somehow set without a coordinate.
      // A pressed cell stops clipping, so the picture can tilt out of
      // its slot instead of being sliced off along the edge it is
      // turning past. Safe to drop the clip here because the photo
      // carries the SAME `borderRadius` itself (see the `image` slot),
      // so the rounded corners are the photo's own and survive without
      // the cell masking them. Raised at the same time, or the next
      // cell in source order paints over the part that now overhangs.
      "&[data-pressed]": { overflow: "visible", zIndex: 1 },
      // The photo AND the ground it sits on. They are siblings rather
      // than one nested pair — the gradient fills the CELL, so that a
      // change of crop cannot shift it — which means the press has to
      // name both or the picture shrinks off its own background and the
      // artifact appears to lift away from the thing it is standing on.
      //
      // The same values, the same anchor, no `transform-box` juggling:
      // both fill the identical box, so one `--press-origin` (a point
      // measured inside that box) lands on the same pixel in each and
      // they scale and turn as one card.
      //
      // This is also what the drag clone already does — its background
      // is a snapshot of this gradient, so the whole clone carries the
      // press. Missing it here made the two halves of one gesture
      // disagree: nothing moved until the drag threshold, and then the
      // gradient snapped into the tilt it should already have been in.
      "&[data-pressed] > :is(img, video), &[data-pressed] > [data-background-effect]":
        {
          scale: "0.94",
          // Tilts about the same anchor, so the picture pivots around
          // the hand rather than swinging past it.
          rotate: "2deg",
          transformOrigin: "var(--press-origin, center)",
        },
      // The hairline round the card, on the cell's own box, which is
      // what makes it follow the corner above.
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // No transition anywhere in here on purpose. Reordering is a
      // direct-manipulation gesture: the slot empties the instant you
      // lift the photo and is full again the instant you let go, with
      // nothing easing in behind it. Anything that fades reads as the
      // grid catching up with you rather than tracking you.
      // Reordering (editor only). The tile being CARRIED empties out
      // entirely and leaves a dashed outline of the slot: you are
      // holding that photo, so the grid should show the hole it came
      // from rather than a ghost of it still sitting there. Dashed
      // rather than the solid hairline an occupied tile wears, so a
      // vacated slot reads as temporary — and 1px rather than the
      // usual 0.5px, since a half-pixel dash barely renders.
      "&[data-dragging]": {
        borderStyle: "dashed",
        borderWidth: "token(spacing.xxs)",
        borderColor: "field.border.default",
        "& > *": { opacity: 0 },
      },
      // NOTE: the cell a photo is flying into carries `data-landing`,
      // but it is NOT styled here and must not be. Hiding its photo for
      // the length of the flight left a hole to see the page background
      // through — the very flash this was meant to avoid. The component
      // keeps that cell showing the photo it held BEFORE the swap
      // instead, so the slot is never empty and the incoming picture is
      // never in two places. The attribute is the marker the grid reads
      // to know a flight is still in the air.
      //
      // The other half of a swap. The dragged photo TRAVELS into the
      // cell you dropped it on, because you carried it there and the
      // eye should be able to follow it home. The photo it displaced
      // has no such journey — nobody moved it — so sliding it across
      // the grid would animate a trip that never happened. It fades up
      // in the slot instead, in step with the flight landing.
      // Duration and curve match the flight's `LANDING_MS` /
      // `LANDING_EASE` in `collection-grid.tsx` — the two halves of a
      // swap have to come to rest together.
      "&[data-arriving] > *": {
        animation: "collectionArrive 100ms ease-out",
      },
      // The tile about to RECEIVE it says so twice: a brand wash laid
      // over the photo, and the accent ring — the same one focus uses,
      // because both answer "this is the thing you are acting on".
      //
      // BOTH live on the pseudo-element, and the ring has to. An inset
      // box-shadow paints on the cell's own background, which its
      // <img> child then covers completely — the ring was being drawn
      // and immediately painted over. A ::after carrying the wash and
      // the ring together sits above the photo instead.
      // (Also why not `opacity` on the cell: that would drag the ring
      // down with it, when the point is to veil the OUTGOING photo
      // while the marker stays at full strength on top of it.)
      //
      // Being positioned is NOT enough to clear the photo, though it
      // was until the background effect arrived: the gradient has to
      // fill the cell, so the photo was lifted to `z-index: 1` to stay
      // over it, and this marker went under the picture it marks. See
      // the `backgroundEffect` slot for the whole ladder.
      "&[data-drop-target]::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        zIndex: 2,
        borderRadius: "inherit",
        backgroundColor: "field.bg.activeVeil",
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        // Decoration only — it lies over the whole tile, and the drop
        // events belong to the cell beneath it.
        pointerEvents: "none",
      },
      // The tile that carries the surplus badge turns into its own 2×2
      // grid purely to park the badge in the bottom-right quadrant at
      // quarter size; the photo leaves the flow so the grid positions
      // nothing but the badge (Figma 829:6912). The badge is a SIBLING
      // of the photo's button, never nested inside it — one interactive
      // control may not contain another, and the two open different
      // images anyway.
      "&[data-surplus]": {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        padding: "sm",
        gap: "sm",
        "& > [data-media-tile]": {
          position: "absolute",
          inset: 0,
        },
        // The badge has taken this cell's bottom-right quadrant, so a
        // clip's transport crosses to the other corner rather than
        // sitting under it. Stated here, where the quadrant layout is,
        // because it is the badge's arrival that moves the chip.
        "& [data-media-transport]": { right: "auto", left: "lg" },
      },
    },
    tile: {
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      padding: "none",
      border: "none",
      background: "none",
      appearance: "none",
      cursor: "zoom-in",
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    image: {
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      objectFit: "cover",
      // No corner here either. It is the picture's own property and
      // arrives as an inline style (`mediaObjectStyle`), which outranks
      // this class — a default stated here could only ever be the value
      // the panel does NOT show.
      // The press feedback the editor's cell drives above. Stated here
      // because the transition belongs to the thing that moves; the
      // reader never sets the state, so it costs it nothing.
      //
      // `scale` and `rotate` are the INDEPENDENT transform properties,
      // never `transform` itself — the drag preview writes `translate`
      // on every pointer move, and a transition covering `transform`
      // would be a transition on the pointer tracking too.
      scale: "1",
      rotate: "0deg",
      transition: "scale 100ms ease, rotate 100ms ease",
      // Middle rung of the cell's paint ladder — see `backgroundEffect`
      // below for the whole of it. Without a z-index the shader, which
      // must be positioned to fill the cell, would cover the photo
      // entirely: a positioned element always paints over a static
      // sibling however late in the DOM that sibling comes.
      position: "relative",
      zIndex: 1,
      // The picture is see-through and has no gradient standing behind
      // it, so it stands on the checkerboard instead. The editor says
      // which pictures those are (`useImageTransparency`); the reader
      // never sets this, and a picture WITH a gradient never sets it
      // either — a photo's background box paints over the layer behind
      // it, so the two grounds are exclusive by construction as well as
      // by intent.
      //
      // Deliberately NOT a rung of the paint ladder below. A picture
      // has exactly one ground, so a second layer would only be
      // something to order against the first; as the photo's own
      // background box it cannot come apart from the photo at all. That
      // is also what carries it onto the drag clone, which is a copy of
      // this <img> — see `dragPreview`.
      "&[data-checkered]": transparencyCheckerboard,
    },
    // The gradient painted behind a photo whose background effect is
    // on. The image stays `cover`, so this shows only where the picture
    // is itself transparent — which is exactly the case it exists for: a
    // screenshot of UI exported on a transparent canvas.
    //
    // Sized by the CELL rather than by the photo. The photo is a
    // cropped fill of the cell, so anchoring the gradient to it would
    // shift the ground every time the crop changed.
    //
    // THE CELL'S PAINT LADDER. All three rungs are stated explicitly
    // because introducing this one forced the other two: a positioned
    // element outranks every static sibling, so the moment the gradient
    // needed `position: absolute` the photo had to be lifted over it,
    // and lifting the photo silently sank everything laid over the
    // picture that had been left at `auto`. Keep them in step:
    //
    //   0  backgroundEffect — the ground
    //   1  image            — the picture
    //   2  cell's ::after   — the drop-target wash and ring
    //   3  the editor's control rail (`mediaObjectToolbar`)
    //
    // The rail is on this ladder despite being a SIBLING of the cell
    // rather than a child of it: the cell is `position: relative` with
    // no z-index of its own, so it is not a stacking context and its
    // contents compete with the rail in the same one. Rung 3 is what
    // keeps the rail over a neighbouring cell's drop-target ring, which
    // its overhanging half reaches into.
    //
    // Rungs 2 and 3 were both written as `auto` and both sank under the
    // photo the moment rung 1 was raised. Neither is optional: every
    // positioned child of a cell has to name its rung, because "it is
    // positioned, so it is on top" stops being true as soon as ONE
    // sibling carries a z-index.
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      // The CELL's corner, not the picture's: the ground fills the
      // card, so it is the card's shape it has to take — the picture
      // in front of it wears its own, which is a property of the
      // picture and stops at the picture.
      //
      // Its OWN copy of that corner rather than the cell's clip, though.
      // A pressed cell sets `overflow: visible` so the picture can tilt
      // out of its slot, and anything relying on that clip squares off
      // the moment the press lands.
      borderRadius: "inherit",
      // Decoration under the picture — the cell beneath it owns the
      // press that starts a reorder, and the tile above it owns clicks.
      pointerEvents: "none",
      // Matches the photo's, so the two ease into the press together.
      // Without it the ground would snap to 0.94 while the picture
      // standing on it took 100ms to get there.
      scale: "1",
      rotate: "0deg",
      transition: "scale 100ms ease, rotate 100ms ease",
    },
    // The photo that rides the cursor while you reorder — a clone the
    // editor appends to the body and positions itself. This is the
    // whole reason the gesture is built on pointer events instead of
    // the drag-and-drop API: a real element keeps its transparent
    // corners (a native drag bitmap composites onto white) and vanishes
    // the instant you let go (a native one animates itself home).
    // `left`/`top` stay at zero and movement goes through `transform`,
    // so tracking the pointer never touches layout. Size, position and
    // the corner are the only things set inline, because only they are
    // dynamic.
    //
    // The card's corner, because a picture filling its slot is clipped
    // to it and the clone has no cell around it to do that clipping —
    // it rides the cursor parented to the body. An INSET picture is not
    // touching that edge, so its own corner is the one on screen and
    // the editor writes it inline, in pixels: the `cqw` the picture
    // carries would resolve against the viewport out here and hand the
    // thing in hand a corner several times the one it left behind. See
    // `beginDrag`.
    dragPreview: {
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 60,
      pointerEvents: "none",
      objectFit: "cover",
      borderRadius: "xl",
      // Position rides the INDEPENDENT `translate` property, and the
      // press feedback below rides `scale`, precisely so they do not
      // share `transform`. A transition on `transform` would be a
      // transition on the pointer tracking too, and the photo would
      // swim after the cursor instead of sticking to it.
      translate: "0 0",
      // Born already carrying the press, with NO transition to play:
      // the photo was scaled down on pointer down, back when it was
      // still in its cell, and the clone takes over mid-press. Easing
      // it down again here would pop it up to full size first.
      //
      // Must equal the cell's `&[data-pressed] > img` scale AND tilt
      // above — this is the same press, on a second element.
      "&[data-carried]": { scale: "0.94", rotate: "2deg" },
      // The clone's className is REPLACED with this slot's, so the
      // checkerboard has to be restated here — but the attribute
      // driving it survives `cloneNode`, so nothing in the drag has to
      // know about it. A picture that was standing on its checkerboard
      // in the cell keeps standing on it in the air, which is the same
      // deal the gradient gets from its snapshot (and the two never
      // collide: a picture with a gradient is not marked). Careful with
      // the ordering — that snapshot is written as an INLINE
      // `background-image`, which replaces this pattern rather than
      // layering over it.
      "&[data-checkered]": transparencyCheckerboard,
      willChange: "translate, scale, rotate",
      // Lifted off the grid, so it reads as being held rather than
      // lying in a slot.
      boxShadow:
        "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 24%, transparent)",
    },
    surplus: {
      gridColumn: 2,
      gridRow: 2,
      justifySelf: "stretch",
      alignSelf: "stretch",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "sm",
      minWidth: 0,
      paddingBlock: "sm",
      paddingInline: "md",
      borderRadius: "xxl",
      borderWidth: "token(spacing.xxs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      backgroundColor: "bg.surfaceGlass",
      color: "field.text.default",
      cursor: "zoom-in",
      appearance: "none",
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
      // The photo beside it is absolutely positioned, so it paints in
      // the positioned layer — above ANY static sibling, however late
      // in the DOM. The badge has to join that layer to sit on top of
      // the image it is captioning.
      position: "relative",
      zIndex: 1,
      // Panda's `backdropFilter` utility emits ONLY the -webkit- form,
      // which Chromium does not recognise, so the blur silently never
      // lands. The raw key is the one that works; the prefixed
      // spelling stays for older WebKit. (Same workaround as the
      // calendar's edge scrims.)
      backdropFilter: "blur(token(spacing.md))",
      "-webkit-backdrop-filter": "blur(token(spacing.md))",
      "backdrop-filter": "blur(token(spacing.md))",
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
    },
    surplusDivider: {
      flexShrink: 0,
      width: "token(spacing.xxs)",
      height: "token(sizes.toolbarButton)",
      backgroundColor: "border.divider",
    },
    surplusLabel: {
      textStyle: "bodyLarge",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  variants: {
    layout: {
      uniform: {
        root: {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          aspectRatio: "3 / 2",
        },
      },
      featured: {
        root: {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          aspectRatio: "3 / 2",
          // The 20px gutter in `base` is the EDITOR's: it is sized for
          // the control rail's overhang, and the reader has no rail.
          // On a phone (below `md`, the page's own breakpoint) a
          // gutter that wide is a large share of a tile three across,
          // so the reader's layouts close it to 8px. Here and on
          // `pair`; `single` has no gutter, and `uniform` IS the
          // editor (see `collectionLayout`).
          mdDown: { gap: "md" },
          // Positional rather than a `data-featured` hook: index 0 IS
          // the featured image in this model, so the selector and the
          // data agree by construction.
          "& > *:first-child": {
            gridColumn: "1 / 3",
            gridRow: "1 / 3",
          },
        },
      },
      pair: {
        root: {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          // See `featured`.
          mdDown: { gap: "md" },
        },
        cell: { aspectRatio: "1" },
      },
      single: {
        root: { gridTemplateColumns: "minmax(0, 1fr)" },
        // No crop for a lone image: it should look exactly like the
        // `image` block it stands in for, not a 3:2 slice of itself.
        tile: { height: "auto" },
        image: { height: "auto" },
      },
    },
  },
  defaultVariants: { layout: "featured" },
  // Both consumers pick `layout` at runtime from the item count.
  staticCss: [{ layout: ["*"] }],
});
