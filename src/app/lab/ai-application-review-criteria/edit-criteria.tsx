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

// Past the close tab (40px) and its shadow (10px).
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
  "&[open][data-closing]": {
    transform: OFFSCREEN,
    transition: "transform 200ms cubic-bezier(0.64, 0, 0.78, 0)",
  },
  // No scrim, and the site-wide backdrop blur (globals.css) undone.
  "&::backdrop": {
    backgroundColor: "transparent",
    // Raw key: `backdropFilter` emits only the prefixed property, which Chromium ignores.
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
  running: DraftCriterion[];
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
