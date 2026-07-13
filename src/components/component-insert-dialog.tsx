"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  dialogPanel,
  dialogHeader,
  dialogTitle,
  dialogFooter,
  dialogFooterGroup,
  libraryBody,
  mediaLibrarySidebar,
  mediaLibraryItem,
  mediaPreviewPane,
  menuIcon,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DemoFrame } from "@/components/demo-frame";
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
const SHOWCASE_WIDTH_PX = 960; // token(sizes.articleShowcase)
const PREVIEW_WIDTH_PX = 280; // token(sizes.imagePreviewMax)
const PREVIEW_SCALE = PREVIEW_WIDTH_PX / SHOWCASE_WIDTH_PX;

/** Clips the scaled stage and collapses to its scaled height (set inline). */
const previewViewportStyle = css({
  width: "token(sizes.imagePreviewMax)",
  flexShrink: 0,
  overflow: "hidden",
});

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

const labelStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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
  const [stageHeight, setStageHeight] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    demoComponents[0]?.id ?? null,
  );

  const selected =
    demoComponents.find((demo) => demo.id === selectedId) ?? null;
  const Demo = selected?.Component;

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
        <aside className={mediaLibrarySidebar()} aria-label="Component library">
          {demoComponents.map((demo) => (
            <button
              key={demo.id}
              type="button"
              role="option"
              aria-selected={demo.id === selectedId}
              className={mediaLibraryItem()}
              onClick={() => setSelectedId(demo.id)}
            >
              <span className={labelStyle}>{demo.label}</span>
            </button>
          ))}
        </aside>

        <div className={mediaPreviewPane()}>
          {selected && (
            <div
              className={previewViewportStyle}
              style={{ height: stageHeight * PREVIEW_SCALE }}
            >
              <div
                ref={stageRef}
                className={showcaseStageStyle}
                style={{ transform: `scale(${PREVIEW_SCALE})` }}
              >
                <DemoFrame
                  aspectRatio={selected.aspectRatio}
                  logger={selected.logger}
                  interactive={false}
                >
                  <div inert className={demoPreviewStyle}>
                    {Demo ? <Demo /> : null}
                  </div>
                </DemoFrame>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      <footer className={dialogFooter()}>
        <div className={dialogFooterGroup()}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <Button type="button" disabled={!selectedId} onClick={handleInsert}>
          Insert Component
        </Button>
      </footer>
    </Dialog>
  );
}
