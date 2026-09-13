"use client";

import { useRef, useState, type DragEvent as ReactDragEvent } from "react";

// ---------------------------------------------------------------------------
// Files dragged onto the set, and the offer to take them.
//
// It lives beside the marquee and takes the same surface for the same reason:
// the canvas is the whole room under the chrome, and a hand that starts beside
// the set is still reaching for the set. Hung off the grid instead, a drop
// would only be taken over the 960px column and the margins either side of it
// would silently refuse — which, without a browser's default to fall back on,
// is worse than having no drop target at all.
//
// Two things make this harder than an `onDrop`:
//
//   The offer must not strobe. `dragenter` and `dragleave` fire on EVERY
//   element the pointer crosses, so over a sheet of two hundred tiles a naive
//   "leave means gone" beat the overlay on and off once per icon. What is
//   tracked is therefore a DEPTH — how many nested elements the drag is inside
//   — and the offer goes away when that reaches zero, not when a leave fires.
//
//   Only a drag carrying FILES may count. Text dragged out of the search box
//   crosses the grid on its way to nowhere, and an overlay offering to add it
//   as an icon would be a lie. `dataTransfer.types` says so during the drag,
//   which `files` cannot: for security a browser hands over the file list only
//   on the drop itself, and reports it empty until then.
//
// Nothing here decides what an icon IS — see `svgFilesFrom` in
// `use-icon-library`, which sorts the batch this hands over. And nothing here
// is a permission: `enabled` is only whether the gesture is DRAWN, and the
// upload behind it is gated on the server (`actions/icon-set`) like every
// other write on this page.
// ---------------------------------------------------------------------------

/** Handlers for the surface. Empty when the gesture is not the visitor's. */
export interface IconDropSurfaceProps {
  onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
}

export interface IconDropOptions {
  /**
   * Whether the surface takes drops at all. False attaches NOTHING — not a
   * handler that returns early — so a visitor's drop is the browser's own,
   * which opens the file. That is the behaviour on every other page of the
   * site, and the point: a page that swallowed the drop silently would be
   * advertising that it has somewhere to put it.
   */
  enabled: boolean;
  onFiles: (files: File[]) => void;
}

export interface IconDrop {
  surfaceProps: IconDropSurfaceProps;
  /** True while a drag carrying files is over the surface. */
  over: boolean;
}

/** Whether the drag in progress is carrying files, asked before the drop. */
function carriesFiles(event: ReactDragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function useIconDrop({ enabled, onFiles }: IconDropOptions): IconDrop {
  const [over, setOver] = useState(false);
  /** How many nested elements the drag is inside. See the note above. */
  const depth = useRef(0);

  // Nothing attached, and nothing drawn. The handlers are withheld rather than
  // made to return early, so the browser's own handling of the drop is what a
  // visitor gets — see `enabled` above.
  if (!enabled) return { surfaceProps: {}, over: false };

  const onDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  };

  const onDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    // Without this the drop never fires at all: a browser's default for a
    // dragged file is to navigate to it, and only a prevented `dragover`
    // marks an element as somewhere a file may be let go of.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    // A self-heal, not a second way in: a drag that entered before this
    // mounted would otherwise hover over a surface that takes the drop while
    // showing nothing. Guarded on the depth so it costs one write, not one
    // per `dragover` — which fires every few hundred milliseconds, forever.
    if (depth.current === 0) {
      depth.current = 1;
      setOver(true);
    }
  };

  const onDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };

  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setOver(false);

    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFiles(files);
  };

  return {
    surfaceProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
    over,
  };
}
