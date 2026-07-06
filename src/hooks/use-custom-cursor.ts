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
      top: "0",
      left: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      visibility: "hidden",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(canvas);

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
      if (rafId) cancelAnimationFrame(rafId);
      canvas.remove();
    };
  }, []);
}
