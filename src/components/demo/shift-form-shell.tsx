import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import CrossIcon from "@/assets/icons/cross.svg";

// ---------------------------------------------------------------------------
// ShiftFormShell — the "Post a Shift" dialog chrome the Shift Scheduling demos
// are staged inside, shared by both of them (Figma 684:1012 / 704:1605 v1,
// 723:1952 / 723:2281 v2 — identical furniture in all four).
//
// Everything here is DELIBERATELY non-interactive. The demos exist to show one
// primitive working for real; the dialog around it is scenery, so the header
// title, the close cross and the two footer buttons are plain boxes rather than
// components that would invite a click and then do nothing. Only `children` —
// the form surface — is live.
//
// The torn edges are the frame's signature and come in two flavours, because
// the two effects are doing different jobs. Header and footer carry the Figma
// shim zigzag as a background image on a wrapping container's ::after/::before,
// a 20px band that paints a torn line. The form surface between them is
// `clip-path`ed instead, so the tear actually CUTS the surface and the canvas
// shows through the teeth.
// ---------------------------------------------------------------------------

// 8 triangular teeth (matching the Figma shim's 76.875px pitch) cut into the
// top and bottom of the form container. Percentages on x keep it
// width-independent; the 20px amplitude is absolute so the teeth stay a
// constant depth. Peaks land on the corners so the left/right edges stay
// straight and full-height.
function tornEdgesClip(teeth: number, amp: number): string {
  const segments = teeth * 2;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = `${((i / segments) * 100).toFixed(3)}%`;
    points.push(`${x} ${i % 2 === 0 ? "0px" : `${amp}px`}`);
  }
  for (let i = segments; i >= 0; i--) {
    const x = `${((i / segments) * 100).toFixed(3)}%`;
    points.push(`${x} ${i % 2 === 0 ? "100%" : `calc(100% - ${amp}px)`}`);
  }
  return `polygon(${points.join(", ")})`;
}

const TORN_CLIP = tornEdgesClip(8, 20);

// The lower half of the same cut, for a band exactly one tooth tall: the fill
// runs flush to the band's top and only its bottom edge zigzags. It is what
// ends the CROPPED card, where the surface stops partway down a form rather
// than at the form's own foot — the teeth are the same drawing, on the same
// phase, so the cropped card's last edge and the dialog's read as one treatment
// (`tornEdgesClip`'s bottom row already resolves to exactly this on a 20px box;
// it is written out because the top row must stay straight).
function tornFootClip(teeth: number): string {
  const segments = teeth * 2;
  const points = ["0% 0px", "100% 0px"];
  for (let i = segments; i >= 0; i--) {
    const x = `${((i / segments) * 100).toFixed(3)}%`;
    points.push(`${x} ${i % 2 === 0 ? "100%" : "0px"}`);
  }
  return `polygon(${points.join(", ")})`;
}

const TORN_FOOT_CLIP = tornFootClip(8);

// Every row of the card that is NOT its form surface, so a demo staging one can
// work out how tall the whole card ends up without keeping a second copy of the
// answer. Each is what the styles below already produce, and each is what the
// Figma draws:
//
//   HEADER      12px of padding either side of a 28px title line
//   TEAR        the shim band, `spacing.xxl` — the FULL card carries four of
//               them (under the header, the form's own two toothed edges, and
//               above the action bar), the cropped one a single closing edge
//   FORM_INSET  the form surface's block padding above and below its content,
//               on top of that 20px tooth allowance
//   ACTION_BAR  12px either side of a 40px button
export const SHELL_HEADER_HEIGHT = 52;
export const SHELL_TEAR_HEIGHT = 20;
export const SHELL_FORM_INSET = 16;
export const SHELL_ACTION_BAR_HEIGHT = 64;

// The card stack — the DemoFrame provides the surrounding canvas frame. The
// sections abut directly (no gap); each section's own tear band (carried in its
// block padding) is the only space between the torn edges.
const stackStyle = css({
  display: "flex",
  flexDirection: "column",
  width: "615px",
  maxWidth: "token(spacing.full)",
});

// A 10%-neutral hairline — the wireframe sections' faint frame.
const wireBorder = "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)";

// The header is a plain wireframe box with top + side hairline borders; its torn
// BOTTOM edge is the Figma "bottom shim" zigzag (684:1019) painted on the wrapping
// container's `::after` — a 20px band stretched full-width directly below the
// header. Inlined as a data URI (a fixed neutral.500 @ 10% stroke, theme-neutral),
// the way the blockquote mark's mask is.
const headerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  padding: "lg",
  borderStyle: "solid",
  borderColor: wireBorder,
  borderTopWidth: "token(spacing.xxs)",
  borderInlineWidth: "token(spacing.xxs)",
  borderBottomWidth: "token(spacing.none)",
});

// The header's tear, as a background image: a 20px band carrying the Figma shim
// zigzag (684:1019). A drawn LINE rather than a cut, because there is no fill
// here to cut — the wireframe rows are the card's unfilled scenery, and the two
// sections that carry a surface tear it with `TORN_CLIP` instead.
const TEAR_IMAGE =
  "url(\"data:image/svg+xml,%3Csvg preserveAspectRatio='none' width='615.462' height='21.1273' viewBox='0 0 615.462 21.1273' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.23079 0.563635L38.6683 20.5636L77.1058 0.563635L115.543 20.5636L153.981 0.563635L192.418 20.5636L230.856 0.563635L269.293 20.5636L307.731 0.563635L346.168 20.5636L384.606 0.563635L423.043 20.5636L461.481 0.563635L499.918 20.5636L538.356 0.563635L576.793 20.5636L615.231 0.563635' stroke='%23576675' stroke-opacity='0.1'/%3E%3C/svg%3E\")";

const headerWrapStyle = css({
  "&::after": {
    content: '""',
    display: "block",
    height: "token(spacing.xxl)",
    backgroundImage: TEAR_IMAGE,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  },
});

const wireTitleStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  fontSize: "1.25rem",
  lineHeight: "1.4",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const wireIconStyle = css({
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: "field.text.placeholder",
  "& svg": { width: "token(spacing.full)", height: "token(spacing.full)", display: "block" },
});

// The interactive form surface — bg.surface with torn top & bottom edges. The
// block padding carries the 20px teeth allowance on top of the 16px inner inset.
const formStyle = css({
  backgroundColor: "bg.surface",
  paddingInline: "xl",
  paddingBlock: "calc(token(spacing.xxl) + token(spacing.xl))",
  clipPath: TORN_CLIP,
});

// Mirror of the header — a plain wireframe box with bottom + side hairline
// borders; its torn TOP edge is the Figma "top shim" zigzag (684:1057) on the
// wrapping container's `::before`, a 20px band directly above the footer. The
// shim is JUST the zigzag (the Figma export's left/right vertical corner rims are
// dropped — the side borders come only from the inner div, so the edge doesn't
// double up into the band, matching the header's rim-less bottom shim).
const footerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "lg",
  borderStyle: "solid",
  borderColor: wireBorder,
  borderBottomWidth: "token(spacing.xxs)",
  borderInlineWidth: "token(spacing.xxs)",
  borderTopWidth: "token(spacing.none)",
});

// The footer's wireframe block (Figma 902:2466) — a bare rail carrying only the
// section's side hairlines, so an EMPTY one occupies no height at all. Whatever
// fills it owns its own padding, because a demo that animates this slot open
// needs that padding to travel with the content rather than outlive it.
const footerFillStyle = css({
  borderStyle: "solid",
  borderColor: wireBorder,
  borderInlineWidth: "token(spacing.xxs)",
  borderBlockWidth: "token(spacing.none)",
});

const footerWrapStyle = css({
  "&::before": {
    content: '""',
    display: "block",
    height: "token(spacing.xxl)",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg preserveAspectRatio='none' width='616' height='21.3874' viewBox='0 0 616 21.3874' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.5 0.823798L38.9375 20.8238L77.375 0.823798L115.812 20.8238L154.25 0.823798L192.688 20.8238L231.125 0.823798L269.562 20.8238L308 0.823798L346.438 20.8238L384.875 0.823798L423.312 20.8238L461.75 0.823798L500.188 20.8238L538.625 0.823798L577.062 20.8238L615.5 0.823798' stroke='%23576675' stroke-opacity='0.1'/%3E%3C/svg%3E\")",
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    // The Figma footer-top shim node is flipped in the layout, so its exported
    // path points the same way as the header's; mirror it vertically so the
    // torn edge points UP toward the form (matching the Figma render).
    transform: "scaleY(-1)",
  },
});

// Same box as the primary button (padding, radius, height) — just no fill.
const wireButtonStyle = css({
  textStyle: "bodyLarge",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderRadius: "md",
});

const wirePrimaryButtonStyle = css({
  textStyle: "bodyLarge",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  paddingInline: "lg",
  height: "token(spacing.4xl)",
  display: "flex",
  alignItems: "center",
  borderRadius: "md",
  backgroundColor: "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)",
});

// --- The cropped card ------------------------------------------------------
//
// The same furniture arranged as a DIAGRAM rather than a dialog: header, body,
// tear, and nothing after it. A demo whose subject is the form's LAYOUT never
// reaches the action bar, so drawing one would only promise a bottom the card
// does not have — the tear says "this continues" and the argument stays on the
// arrangement above it (Figma 1137:5928 after / 1137:5971 before).

// Unlike the dialog header this one closes its own box: with no torn band
// directly beneath it, the bottom hairline is what separates the title from the
// body (Figma 1137:5972, bordered on all four sides).
const croppedHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  padding: "lg",
  borderStyle: "solid",
  borderColor: wireBorder,
  borderWidth: "token(spacing.xxs)",
});

// The form's own surface, exactly as the dialog draws it — a diagram of a form
// is still a picture OF that form, and the arrangement inside it should read
// against the surface it would really sit on rather than against the frame's
// canvas. It takes no side rails for the same reason the dialog's form section
// has none: the fill is what draws the box, and the hairlines belong to the
// wireframe rows above and below it.
const croppedBodyStyle = css({
  backgroundColor: "bg.surface",
  // The body is CROPPED, not merely short: content taller than the card runs on
  // past the tear rather than stretching it.
  overflow: "hidden",
});

// The tear as an element rather than a pseudo — it is the card's last row here,
// not decoration hung off a wrapper, and being real is what lets it sit in the
// stack's flow after a body of any height.
//
// It is the SURFACE torn, not a line drawn under it: one tooth's worth of the
// same fill, cut off along the zigzag, so the canvas shows through the teeth
// the way it does at the dialog section's own two edges. The stroked zigzag the
// band used to carry belongs to the wireframe rows — the header's bottom shim
// and the footer's top one — where there is no fill to cut.
const croppedTearStyle = css({
  height: "token(spacing.xxl)",
  backgroundColor: "bg.surface",
  clipPath: TORN_FOOT_CLIP,
});

export interface ShiftFormShellProps {
  /** The live form surface, between the two wireframe sections. */
  children: ReactNode;
  /**
   * Wireframe standing in for the rest of the form, in the footer section
   * between the torn top shim and the Action Bar (Figma 902:2466). Optional and
   * zero-height when omitted — v1 uses it as the counterweight that keeps the
   * dialog one height as its recurrence block folds away.
   *
   * Ignored when `cropped` — that card has no footer for a fill to sit in.
   */
  footerFill?: ReactNode;
  /**
   * End the card at the tear, partway down the form: header, body, torn edge,
   * no action bar. For a demo arguing about the form's SHAPE rather than
   * working it, where a Cancel/Post pair would promise a bottom that isn't
   * there. The body is clipped, so it is the consumer's to say how tall the
   * crop is and how its content fades into the cut.
   */
  cropped?: boolean;
}

/** The header's two pieces of scenery, identical in both cards. */
function ShellTitle() {
  return (
    <>
      <span className={wireTitleStyle}>Post a Shift</span>
      <span className={wireIconStyle} aria-hidden>
        <CrossIcon />
      </span>
    </>
  );
}

/** "Post a Shift" wireframe chrome: header, torn form surface, footer. */
export function ShiftFormShell({
  children,
  footerFill,
  cropped = false,
}: ShiftFormShellProps) {
  if (cropped) {
    return (
      <div className={stackStyle}>
        <div className={croppedHeaderStyle}>
          <ShellTitle />
        </div>
        <div className={croppedBodyStyle}>{children}</div>
        <div className={croppedTearStyle} aria-hidden />
      </div>
    );
  }

  return (
    <div className={stackStyle}>
      {/* Non-interactive wireframe header — top/side borders, torn bottom shim. */}
      <div className={headerWrapStyle}>
        <div className={headerStyle}>
          <ShellTitle />
        </div>
      </div>

      <div className={formStyle}>{children}</div>

      {/* Non-interactive wireframe footer — bottom/side borders, torn top shim. */}
      <div className={footerWrapStyle}>
        {footerFill ? (
          <div className={footerFillStyle} data-testid="footer-fill">
            {footerFill}
          </div>
        ) : null}
        <div className={footerStyle}>
          <span className={wireButtonStyle}>Cancel</span>
          <span className={wirePrimaryButtonStyle}>Post Shift</span>
        </div>
      </div>
    </div>
  );
}
