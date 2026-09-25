"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { Dialog } from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import {
  MEDIA_PADDING_REFERENCE,
  mediaContainerWidth,
  mediaHeightBudgetFactor,
  mediaInsetPx,
  mediaPictureShare,
  mediaRadiusPx,
  type MediaNode,
} from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";

const lightboxPanelStyle = css({
  background: "transparent",
  border: "none",
  padding: "none",
  overflow: "visible",
  maxWidth: "none",
  maxHeight: "none",
  // The dialog holds focus itself, so the UA ring would outline the photo.
  focusVisibleRing: "none",
});

const lightboxFigureStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "md",
  margin: "none",
});

const lightboxFrameStyle = css({
  position: "relative",
  display: "flex",
  minWidth: 0,
  overflow: "hidden",
});

const lightboxBackgroundEffectStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  borderRadius: "xl",
});

const lightboxImageStyle = css({
  display: "block",
  // Both auto, so the maxima scale the image on its own aspect ratio.
  width: "auto",
  height: "auto",
  maxWidth: "85vw",
  maxHeight: "calc(85vh - token(spacing.4xl))",
  objectFit: "contain",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  // Above the ground behind it.
  position: "relative",
  zIndex: 1,
});

const lightboxCaptionStyle = css({
  maxWidth: "min(85vw, token(sizes.articleShowcase))",
  textAlign: "center",
  // No `textWrap`: Typography's utilities layer would override it.
});

export interface MediaLightboxProps {
  items: readonly MediaNode[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: MediaLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Stamped with its index, so stepping discards it without an effect.
  const [measured, setMeasured] = useState<{
    index: number;
    width: number;
    height: number;
  } | null>(null);
  const intrinsic = measured?.index === index ? measured : null;
  const intrinsicWidth = intrinsic?.width ?? null;
  const item = index === null ? null : items[index];

  // Measured off the picture, not the frame: the frame includes the band derived from it.
  const [picture, setPicture] = useState<HTMLElement | null>(null);
  const [framed, setFramed] = useState<{ index: number; width: number } | null>(
    null,
  );
  useEffect(() => {
    if (index === null || !picture || typeof ResizeObserver !== "function")
      return;
    const observer = new ResizeObserver(([entry]) =>
      setFramed({
        index,
        width: mediaContainerWidth(items[index], entry.contentRect.width),
      }),
    );
    observer.observe(picture);
    return () => observer.disconnect();
    // `picture` is state, not a ref, so this runs once it mounts.
  }, [index, items, picture]);
  const boxWidth = framed?.index === index ? framed.width : null;
  const corner = item
    ? mediaRadiusPx(item, boxWidth ?? MEDIA_PADDING_REFERENCE)
    : 0;
  const inset = item
    ? mediaInsetPx(item, boxWidth ?? MEDIA_PADDING_REFERENCE)
    : 0;
  const share = item ? mediaPictureShare(item) : 1;
  const widthCap = share === 1 ? "85vw" : `calc(85vw * ${share})`;
  // From the file's shape, not the measured box, or the cap would chase its own effect.
  const heightFactor = item
    ? mediaHeightBudgetFactor(
        item,
        intrinsic?.height ? intrinsic.width / intrinsic.height : 1,
      )
    : 1;

  // Must stay mounted and driven by `index`: a cleanup calling close() fires onClose,
  // which dismisses the lightbox under React's dev double-run.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    else if (index === null && dialog.open) dialog.close();
  }, [index]);

  return (
    <Dialog
      ref={dialogRef}
      align="center"
      justify="center"
      aria-label={
        item ? collectionItemAlt(item) || `Image ${index! + 1}` : "Image viewer"
      }
      className={lightboxPanelStyle}
      onClose={onClose}
      onKeyDown={(event) => {
        if (index === null) return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        onIndexChange((index + step + items.length) % items.length);
      }}
    >
      {item && index !== null && (
        <figure className={lightboxFigureStyle}>
          {/* `data-media-surface` is the box a clip's transport pins to; see the `mediaTransport` recipe. */}
          <div data-media-surface="" className={lightboxFrameStyle}>
          {item.backgroundEffect && (
            <BackgroundEffectLayer
              effect={item.backgroundEffect}
              className={lightboxBackgroundEffectStyle}
            />
          )}
          <Media
            // Keyed so stepping remounts: no stale bitmap, no inherited playhead.
            key={index}
            src={item.src}
            kind={item.kind}
            alt={collectionItemAlt(item)}
            className={lightboxImageStyle}
            // Pins itself to the frame above, hence the frame's `position: relative`.
            transport
            // No `layout`: this frame is sized by the image, so inset and corner arrive as pixels.
            // The inset is a margin, not padding, so the ground still fills the whole card.
            style={{
              margin: inset,
              borderRadius: corner,
              ...(intrinsicWidth ? { maxWidth: `min(${intrinsicWidth}px, ${widthCap})` } : {}),
              ...(share === 1
                ? {}
                : {
                    ...(intrinsicWidth ? {} : { maxWidth: widthCap }),
                    maxHeight: `calc((85vh - var(--spacing-4xl)) / ${heightFactor})`,
                  }),
            }}
            elementRef={setPicture}
            onMeasure={(width, height) => setMeasured({ index, width, height })}
          />
          </div>
          {item.caption && (
            <Typography
              tag="figcaption"
              type="caption"
              className={lightboxCaptionStyle}
            >
              {item.caption}
            </Typography>
          )}
        </figure>
      )}
    </Dialog>
  );
}
