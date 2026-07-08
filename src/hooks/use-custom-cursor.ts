"use client";

import { useEffect } from "react";
import { CURSOR_HOTSPOT, CURSOR_SIZE } from "@/data/cursor";

const CURSOR_SRC = "/cursors/cursor-selection.svg";

function prefersCustomCursor() {
  return window.matchMedia("(pointer: fine) and (hover: hover)").matches;
}

function paintCursor(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  dpr: number,
) {
  const pixelSize = Math.round(CURSOR_SIZE * dpr);

  canvas.width = pixelSize;
  canvas.height = pixelSize;
  canvas.style.width = `${CURSOR_SIZE}px`;
  canvas.style.height = `${CURSOR_SIZE}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, pixelSize, pixelSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, pixelSize, pixelSize);
}

/** Replaces the system cursor with a DPR-scaled canvas rendering of cursor-selection.svg. */
export function useCustomCursor() {
  useEffect(() => {
    if (!prefersCustomCursor()) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.customCursor = "";
    Object.assign(canvas.style, {
      position: "fixed",
      margin: "0",
      inset: "auto",
      top: "0",
      left: "0",
      // Reset popover UA styles (Canvas background, border, padding, overflow)
      background: "transparent",
      border: "0",
      padding: "0",
      overflow: "visible",
      zIndex: "2147483647",
      pointerEvents: "none",
      visibility: "hidden",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>);

    // Native <dialog> (showModal) renders in the top layer, above any z-index.
    // Promote the cursor into the top layer via the popover API so it stays
    // visible above modal overlays; z-index above is the pre-popover fallback.
    const supportsPopover =
      typeof canvas.showPopover === "function" &&
      typeof canvas.hidePopover === "function";
    if (supportsPopover) canvas.setAttribute("popover", "manual");

    document.body.appendChild(canvas);

    function promoteToTopLayer() {
      if (!supportsPopover || !canvas.isConnected) return;
      try {
        if (canvas.matches(":popover-open")) canvas.hidePopover();
        canvas.showPopover();
      } catch {
        // Popover promotion is best-effort; ignore transient state errors.
      }
    }

    promoteToTopLayer();

    // Top-layer order follows promotion order — when a modal <dialog> opens it
    // jumps above the cursor, so re-promote the cursor to the top on each open.
    const dialogObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target as HTMLElement;
        if (
          target.tagName === "DIALOG" &&
          (target as HTMLDialogElement).open
        ) {
          promoteToTopLayer();
          break;
        }
      }
    });
    dialogObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });

    let rafId = 0;
    let x = 0;
    let y = 0;
    let visible = false;
    let image: CanvasImageSource | null = null;

    function syncPosition() {
      rafId = 0;
      canvas.style.transform = `translate3d(${x - CURSOR_HOTSPOT.x}px, ${y - CURSOR_HOTSPOT.y}px, 0)`;
      canvas.style.visibility = visible ? "visible" : "hidden";
    }

    function schedulePosition() {
      if (!rafId) rafId = requestAnimationFrame(syncPosition);
    }

    function onPointerMove(event: PointerEvent) {
      x = event.clientX;
      y = event.clientY;
      visible = true;
      schedulePosition();
    }

    function hideCursor() {
      visible = false;
      schedulePosition();
    }

    function redrawForDpr() {
      if (!image) return;
      paintCursor(canvas, image, window.devicePixelRatio || 1);
    }

    const img = new Image();
    img.onload = () => {
      image = img;
      redrawForDpr();
      schedulePosition();
    };
    img.src = CURSOR_SRC;

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("mouseleave", hideCursor);
    window.addEventListener("blur", hideCursor);
    window.addEventListener("resize", redrawForDpr);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
      window.removeEventListener("resize", redrawForDpr);
      dialogObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      canvas.remove();
    };
  }, []);
}
