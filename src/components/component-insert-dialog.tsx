"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  dialogPanel,
  dialogHeader,
  dialogTitle,
  dialogFooter,
  libraryBody,
  mediaLibrarySidebar,
  mediaPreviewPane,
  menuIcon,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptionList } from "@/components/ui/input/option-list";
import { DemoFrame } from "@/components/demo-frame";
import { DemoComponent } from "@/components/demo-component";
import { demoComponents } from "@/components/demo/registry";
import CloseIcon from "@/assets/icons/cross.svg";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// The preview renders the demo at its full showcase layout width (960px, the
// `articleShowcase` token) so its container queries resolve to the desktop
// layout the reader sees — then scales the whole thing down with `transform`
// (which, unlike `zoom`, leaves the layout box at 960px so those queries are
// unaffected) to fit the library preview column.
//
// HEIGHT is the only fixed constraint (280px, matching the image dialog's
// preview); the width follows the demo's own aspect ratio and stretches at most
// to the pane's CONTENT box. So the scale is whichever of the two limits binds
// first — see `previewScale`.
const SHOWCASE_WIDTH_PX = 960; // token(sizes.articleShowcase)
const PREVIEW_MAX_HEIGHT_PX = 280; // token(sizes.imagePreviewMax)

/** Clips the scaled stage; both its dimensions are set inline from the scale. */
const previewViewportStyle = css({
  maxWidth: "token(spacing.full)",
  flexShrink: 0,
  overflow: "hidden",
});

/**
 * The pane's CONTENT width — `clientWidth` includes padding, so subtract it to
 * match what a percentage max-width (and ResizeObserver's `contentRect`) sees.
 */
function contentWidth(el: HTMLElement) {
  const { paddingLeft, paddingRight } = getComputedStyle(el);
  return (
    el.clientWidth - (parseFloat(paddingLeft) || 0) - (parseFloat(paddingRight) || 0)
  );
}

/** Full-width showcase stage; scaled down via an inline transform. */
const showcaseStageStyle = css({
  width: "token(sizes.articleShowcase)",
  transformOrigin: "top left",
});

const demoPreviewStyle = css({
  width: "full",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
});

// The sidebar column (`mediaLibrarySidebar`) owns the frame, padding and scroll,
// so neutralize the OptionList `list` slot's self-contained popover framing —
// its 4px inset and 7-row max-height cap — and let the list fill the column.
// Atomic `css()` reliably outranks the recipe slot (utilities cascade layer).
const libraryListStyle = css({
  flex: "1 1 auto",
  minHeight: 0,
  maxHeight: "none",
  padding: "none",
});

const iconStyle = menuIcon();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ComponentInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (componentId: string) => void;
}

export function ComponentInsertDialog({
  open,
  onClose,
  onInsert,
}: ComponentInsertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    demoComponents[0]?.id ?? null,
  );

  const selected =
    demoComponents.find((demo) => demo.id === selectedId) ?? null;

  // Default-select the first component each time the dialog (re)opens. Adjusted
  // during render — the sanctioned pattern for resetting on a prop transition.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelectedId(demoComponents[0]?.id ?? null);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Track the stage's natural (un-transformed) height so the clipping viewport
  // can collapse to the scaled height. offsetHeight ignores the transform, and
  // the observer catches the demo settling its own aspect-ratio height.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      setStageHeight(0);
      return;
    }
    const measure = () => setStageHeight(stage.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [open, selectedId]);

  // Track the preview pane's content width — the other half of the scale. The
  // pane's own width is set by the dialog layout (it fills what the sidebar
  // leaves), so measuring it can't feed back into the scaled stage inside it.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) {
      setPaneWidth(0);
      return;
    }
    const measure = () => setPaneWidth(contentWidth(pane));
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    measure();
    return () => observer.disconnect();
  }, [open]);

  // Fit the 960px stage into the pane: shrink to the 280px height cap, or to the
  // pane's width, whichever binds first. Both measurements start at 0 (and stay
  // there in jsdom), so the preview is simply collapsed until they land.
  const previewScale = Math.min(
    stageHeight > 0 ? PREVIEW_MAX_HEIGHT_PX / stageHeight : Infinity,
    paneWidth > 0 ? paneWidth / SHOWCASE_WIDTH_PX : 0,
  );

  function handleInsert() {
    if (!selectedId) return;
    onInsert(selectedId);
    onClose();
  }

  return (
    <Dialog
      ref={dialogRef}
      align="center"
      justify="center"
      aria-label="Insert Component"
      className={dialogPanel({ size: "md" })}
      onClose={onClose}
    >
      <header className={dialogHeader()}>
        <h2 className={dialogTitle()}>Insert Component</h2>
        <Button
          type="button"
          variant="icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <CloseIcon className={iconStyle} />
        </Button>
      </header>

      <div className={libraryBody()}>
        {/* Only mount the (dynamically imported) previews while open. */}
        {open && (
        <>
        <div className={mediaLibrarySidebar()}>
          <OptionList
            value={selectedId}
            onValueChange={(value) => setSelectedId(value)}
            tone="plain"
          >
            <OptionList.Listbox
              className={libraryListStyle}
              aria-label="Component library"
            >
              {demoComponents.map((demo) => (
                <OptionList.Option key={demo.id} value={demo.id}>
                  {demo.label}
                </OptionList.Option>
              ))}
            </OptionList.Listbox>
          </OptionList>
        </div>

        <div ref={paneRef} className={mediaPreviewPane()}>
          {selected && (
            <div
              className={previewViewportStyle}
              style={{
                width: SHOWCASE_WIDTH_PX * previewScale,
                height: stageHeight * previewScale,
              }}
            >
              <div
                ref={stageRef}
                className={showcaseStageStyle}
                style={{ transform: `scale(${previewScale})` }}
              >
                <DemoFrame
                  aspectRatio={selected.aspectRatio}
                  logger={selected.logger}
                  interactive={false}
                >
                  <div inert className={demoPreviewStyle}>
                    {selected ? <DemoComponent entry={selected} /> : null}
                  </div>
                </DemoFrame>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Two buttons, so the footer's own space-between does the placing — no
          grouping wrapper (that's for the image dialog, which has a cluster). */}
      <footer className={dialogFooter()}>
        <Button type="button" emphasis="tertiary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!selectedId}
          onClick={handleInsert}
        >
          Insert Component
        </Button>
      </footer>
    </Dialog>
  );
}
