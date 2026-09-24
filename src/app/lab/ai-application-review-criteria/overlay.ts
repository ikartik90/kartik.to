import { css } from "../../../../styled-system/css";

// ---------------------------------------------------------------------------
// What the prototype's modal dialogs share — the benchmark overlay and the
// validation dialog: a surface in the product's look, in the top layer over a
// scrim that dims everything behind it. It fades and settles in, the scrim
// with it, and both fade out while `data-closing` (see `useModal`).
//
// Each dialog adds its own size and place.
// ---------------------------------------------------------------------------

const AWAY = "translateY(8px) scale(0.98)";

export const overlayBase = css.raw({
  position: "fixed",
  inset: 0,
  flexDirection: "column",
  overflow: "hidden",
  backgroundColor: "var(--cashby-surface)",
  color: "var(--cashby-ink)",
  font: "var(--cashby-text-body)",
  // With nothing inside that can take focus yet, opening focuses the dialog
  // itself — and WebKit rings the whole of it for that.
  outline: "none",
  opacity: 0,
  transform: AWAY,
  transition:
    "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&[open]": { display: "flex", opacity: 1, transform: "none" },
  _starting: {
    "&[open]": { opacity: 0, transform: AWAY },
    "&[open]::backdrop": { backgroundColor: "transparent" },
  },
  "&[open][data-closing]": {
    opacity: 0,
    transform: AWAY,
    transition:
      "opacity 150ms cubic-bezier(0.64, 0, 0.78, 0), transform 150ms cubic-bezier(0.64, 0, 0.78, 0)",
    "&::backdrop": {
      backgroundColor: "transparent",
      transition: "background-color 150ms cubic-bezier(0.64, 0, 0.78, 0)",
    },
  },
  "&::backdrop": {
    backgroundColor: "var(--cashby-scrim)",
    transition: "background-color 200ms cubic-bezier(0.22, 1, 0.36, 1)",
    // The site blurs every dialog's backdrop (globals.css); the product dims it.
    // @ts-expect-error -- raw CSS property: `backdropFilter` reaches the page prefixed alone, which Chromium ignores
    "backdrop-filter": "none",
  },
});
