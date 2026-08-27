// ---------------------------------------------------------------------------
// Media queries a stylesheet and a script both have to agree on.
//
// A CSS condition is normally the whole answer — the layout changes and nothing
// in JS needs to know. These are the exceptions: the ones where a POINTER
// HANDLER has to ask the same question the stylesheet asked, and the two being
// written out separately would let a rotation put them a pixel out of step.
//
// `panda.config.ts` imports these to define the matching conditions, so the
// query exists once and the generated CSS and the runtime check cannot drift.
// ---------------------------------------------------------------------------

/**
 * The properties panel is a bottom sheet rather than a side rail: a phone held
 * upright, where a 360px rail would take most of the width and leave a column
 * too narrow to judge a picture in. Turned on its side the same phone has width
 * to spare and goes back to the rail — this asks about the shape of the
 * viewport, not about the device.
 *
 * One pixel under `breakpoints.md` (820px), which is where the page starts
 * making room for a docked rail (globals.css): above that line a rail is
 * affordable by definition, so the sheet stops exactly where the inset begins.
 */
export const BOTTOM_SHEET_QUERY =
  "(orientation: portrait) and (max-width: 819px)";

/**
 * The other half of the same phone: turned on its side, where the panel goes
 * back to being a rail but the PAGE is still too narrow for globals.css to
 * have made room for it (that inset starts at 820px, and this ends at 819).
 *
 * Left alone the rail would lie over the canvas — over the picture being
 * judged, and over the gutter controls in its top corner, which is a theme
 * toggle you cannot reach. The canvas gives up the width itself here.
 */
export const NARROW_RAIL_QUERY =
  "(orientation: landscape) and (max-width: 819px)";

/** Whether the panel is a sheet right now. False wherever there is no `matchMedia`. */
export function isBottomSheetLayout(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(BOTTOM_SHEET_QUERY).matches
  );
}

/**
 * There is a cursor on this device — a mouse or a trackpad, not a finger.
 *
 * The site's affordances split on it: hover chrome and keyboard-shortcut hints
 * are an offer to a visitor who has the hardware to take them up, and are noise
 * on a touch-first device where there is no pointer to reveal them with and no
 * key to press. `panda.config.ts` defines its `hasCursor` condition from this,
 * and the custom cursor in globals.css asks the same question.
 *
 * It is here rather than written out at each site because the command palette
 * has to ask it in JS too: whether the search field takes focus the moment the
 * palette opens is not something a stylesheet can decide.
 */
export const HAS_CURSOR_QUERY = "(hover: hover) and (pointer: fine)";
