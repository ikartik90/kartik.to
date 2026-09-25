"use client";

import { useRef, useState, type DragEvent as ReactDragEvent } from "react";

export interface IconDropSurfaceProps {
  onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
}

export interface IconDropOptions {
  /** False attaches no handlers, so the browser handles a visitor's drop itself. */
  enabled: boolean;
  onFiles: (files: File[]) => void;
}

export interface IconDrop {
  surfaceProps: IconDropSurfaceProps;
  over: boolean;
}

/** Reads `types`: `files` stays empty until the drop. */
function carriesFiles(event: ReactDragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function useIconDrop({ enabled, onFiles }: IconDropOptions): IconDrop {
  const [over, setOver] = useState(false);
  /** Nested elements the drag is inside: enter/leave fire per element, so the offer ends at zero. */
  const depth = useRef(0);

  if (!enabled) return { surfaceProps: {}, over: false };

  const onDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  };

  const onDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!carriesFiles(event)) return;
    // Only a prevented `dragover` lets the drop fire.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    // Self-heals a drag that entered before mount; guarded so it writes once.
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
