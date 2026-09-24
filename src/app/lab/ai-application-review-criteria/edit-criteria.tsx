"use client";

import { useId, useRef } from "react";
import { css } from "../../../../styled-system/css";
import { CriteriaDrawer } from "./criteria-drawer";
import type { DraftCriterion } from "./draft";
import { useModal } from "./modal";
import { accentButton, accentButtonLabelStyle } from "./parts";
import { useWalkthrough, WalkthroughTip } from "./walkthrough";
import EditIcon from "./icons/edit.svg";
import CloseIcon from "./icons/close.svg";

// ---------------------------------------------------------------------------
// Edit, and the drawer it slides in from the right edge of the window.
//
// A native modal <dialog> (see `useModal`). Local rather than the site's
// `Dialog`: that one scales in over a blurred backdrop in the site's own
// colours, and this is the product's drawer — no scrim, only its shadow.
//
// It edits the criteria running, and closes on saving them. Pressing Edit is
// the walkthrough's first step, and its tip points here; closing the drawer
// before the walkthrough is through with it goes back to that step.
//
// It slides in from `@starting-style`, and out while `data-closing`. Reduced
// motion needs nothing here: globals.css cuts every transition to a hair for
// it, so the drawer appears in place and closes a frame after it is asked to.
// ---------------------------------------------------------------------------

// Slides far enough to take the close tab and the shadow off-screen with it.
const OFFSCREEN = "translateX(calc(100% + 40px + 10px))";

const drawerStyle = css({
  position: "fixed",
  insetBlock: 0,
  insetInlineStart: "auto",
  insetInlineEnd: 0,
  margin: 0,
  width: "960px",
  // Leaves the close tab on screen however narrow the window.
  maxWidth: "calc(100% - 40px)",
  height: "100dvh",
  maxHeight: "100dvh",
  flexDirection: "column",
  backgroundColor: "var(--cashby-surface)",
  borderInlineStartWidth: "var(--cashby-rule)",
  borderInlineStartStyle: "solid",
  borderInlineStartColor: "var(--cashby-border)",
  // A filter rather than a box shadow, so the close tab casts one too.
  filter: "drop-shadow(0 0 10px var(--cashby-border))",
  color: "var(--cashby-ink)",
  font: "var(--cashby-text-body)",
  transform: OFFSCREEN,
  transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&[open]": { display: "flex", transform: "none" },
  _starting: { "&[open]": { transform: OFFSCREEN } },
  // Out faster than in, and accelerating away rather than settling.
  "&[open][data-closing]": {
    transform: OFFSCREEN,
    transition: "transform 200ms cubic-bezier(0.64, 0, 0.78, 0)",
  },
  // No scrim: the product lays the drawer over the page with its shadow alone.
  // The site blurs every dialog's backdrop (globals.css), so that is undone.
  "&::backdrop": {
    backgroundColor: "transparent",
    // `backdropFilter` reaches the page as the prefixed property alone, which
    // Chromium ignores. The raw key — the one the config's recipes use — comes
    // out as both. The types reject it; the extractor does not.
    // @ts-expect-error -- raw CSS property, see above
    "backdrop-filter": "none",
  },
});

const closeTabStyle = css({
  position: "absolute",
  insetBlockStart: "10px",
  insetInlineStart: "-40px",
  display: "flex",
  alignItems: "center",
  width: "40px",
  height: "32px",
  paddingInlineStart: "12px",
  paddingInlineEnd: "8px",
  borderStartStartRadius: "20px",
  borderEndStartRadius: "20px",
  borderWidth: "var(--cashby-rule)",
  borderInlineEndWidth: 0,
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  backgroundImage: "linear-gradient(var(--cashby-fill), var(--cashby-fill))",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
});

export function EditCriteria({
  running,
  onSave,
}: {
  /** The criteria running, which the drawer opens on. */
  running: DraftCriterion[];
  /** Run these from now on. */
  onSave: (criteria: DraftCriterion[]) => void;
}) {
  const walkthrough = useWalkthrough();
  const drawer = useModal({
    onClosed: () => walkthrough.backTo("edit-criteria"),
  });
  const titleId = useId();
  const editRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={editRef}
        type="button"
        className={accentButton({ glyphs: "leading" })}
        aria-describedby={walkthrough.describe("edit-criteria")}
        onClick={() => {
          walkthrough.done("edit-criteria");
          drawer.open();
        }}
      >
        <EditIcon aria-hidden />
        <span className={accentButtonLabelStyle}>Edit</span>
      </button>
      <WalkthroughTip step="edit-criteria" anchor={editRef} />

      <dialog
        {...drawer.dialogProps}
        className={drawerStyle}
        aria-labelledby={titleId}
      >
        {/* First, so it is where focus lands when the drawer opens. */}
        <button
          type="button"
          className={closeTabStyle}
          aria-label="Close"
          onClick={drawer.close}
        >
          <CloseIcon aria-hidden />
        </button>
        {/* Remounted on every opening with a fresh draft — so however it was
            last closed, nothing typed survives. */}
        {drawer.session > 0 && (
          <CriteriaDrawer
            key={drawer.session}
            titleId={titleId}
            running={running}
            onSave={(criteria) => {
              onSave(criteria);
              void drawer.close();
            }}
            onCancel={drawer.close}
          />
        )}
      </dialog>
    </>
  );
}
