import { css } from "../../../../styled-system/css";

const AWAY = "translateY(8px) scale(0.98)";

export const overlayBase = css.raw({
  position: "fixed",
  inset: 0,
  flexDirection: "column",
  overflow: "hidden",
  backgroundColor: "var(--cashby-surface)",
  color: "var(--cashby-ink)",
  font: "var(--cashby-text-body)",
  // Opening may focus the dialog itself, and WebKit would ring all of it.
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
    // Overrides the site-wide dialog backdrop blur (globals.css).
    // @ts-expect-error -- raw CSS property: `backdropFilter` reaches the page prefixed alone, which Chromium ignores
    "backdrop-filter": "none",
  },
});
