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
import { LinkCard } from "@/components/link-card";
import { demoComponents } from "@/components/demo/registry";
import CloseIcon from "@/assets/icons/cross.svg";

// Rendered at the 960px showcase width so container queries match the reader, then scaled with
// `transform` (not `zoom`, which would change the layout box) to fit the preview.
const SHOWCASE_WIDTH_PX = 960; // token(sizes.articleShowcase)
const PREVIEW_MAX_HEIGHT_PX = 280; // token(sizes.imagePreviewMax)

const previewViewportStyle = css({
  maxWidth: "token(spacing.full)",
  flexShrink: 0,
  overflow: "hidden",
});

/** `clientWidth` minus padding, to match a percentage max-width and ResizeObserver's `contentRect`. */
function contentWidth(el: HTMLElement) {
  const { paddingLeft, paddingRight } = getComputedStyle(el);
  return (
    el.clientWidth - (parseFloat(paddingLeft) || 0) - (parseFloat(paddingRight) || 0)
  );
}

const showcaseStageStyle = css({
  width: "token(sizes.articleShowcase)",
  transformOrigin: "top left",
});

const demoPreviewStyle = css({
  width: "token(spacing.full)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
});

const libraryListStyle = css({
  flex: "1 1 auto",
  minHeight: 0,
  maxHeight: "none",
  padding: "none",
});

const iconStyle = menuIcon();

export type ComponentDialogMode = "insert" | "change";

export interface ComponentInsertDialogProps {
  open: boolean;
  mode?: ComponentDialogMode;
  /** Only read in `change` mode; a retired id falls back to the first entry. */
  currentComponentId?: string | null;
  onClose: () => void;
  onInsert: (componentId: string) => void;
}

export function ComponentInsertDialog({
  open,
  mode = "insert",
  currentComponentId,
  onClose,
  onInsert,
}: ComponentInsertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);
  const openingSelection = () =>
    (mode === "change" &&
    currentComponentId &&
    demoComponents.some((demo) => demo.id === currentComponentId)
      ? currentComponentId
      : demoComponents[0]?.id) ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(openingSelection);

  const selected =
    demoComponents.find((demo) => demo.id === selectedId) ?? null;

  // Re-seat the selection on each open, adjusted during render (React's pattern for prop transitions).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelectedId(openingSelection());
  }

  const title = mode === "change" ? "Replace Component" : "Insert Component";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The stage's untransformed height (offsetHeight ignores the transform), for the clipping viewport.
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
      aria-label={title}
      className={dialogPanel({ size: "md" })}
      onClose={onClose}
    >
      <header className={dialogHeader()}>
        <h2 className={dialogTitle()}>{title}</h2>
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
                {selected.card ? (
                  <div inert className={demoPreviewStyle}>
                    <LinkCard
                      title={selected.label}
                      aspect={selected.aspectRatio ?? "3/2"}
                      interactive={false}
                    />
                  </div>
                ) : (
                <DemoFrame
                  aspectRatio={selected.aspectRatio}
                  chrome={selected.chrome}
                  logger={selected.logger}
                  fill={selected.fill}
                  interactive={false}
                >
                  <div inert className={demoPreviewStyle}>
                    {selected ? (
                      <DemoComponent
                        entry={selected}
                        aspect={selected.aspectRatio}
                      />
                    ) : null}
                  </div>
                </DemoFrame>
                )}
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

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
          {title}
        </Button>
      </footer>
    </Dialog>
  );
}
