import Skyline from "@/assets/illustrations/toronto-skyline.svg";
import { css } from "../../styled-system/css";

// ---------------------------------------------------------------------------
// The foot of the reading surfaces — the homepage and the articles — and only
// those: a playground carries its own chrome at the foot of the page, and the
// editors are the admin's.
//
// The skyline is Toronto from the harbour, drawn as hairlines in the site's
// own tokens (`assets/illustrations/toronto-skyline.svg`). The drawing does
// its own cropping: a wide viewBox with the CN Tower on the centre line and
// the pier at the foot, and `preserveAspectRatio="xMidYMax slice"`, so in
// whatever box it is given the tower and the pier stay in view and the SIDES
// are what overflow — on a phone as on a wide display. The box's height is the
// one number the footer decides (`sizes.siteFooter`).
//
// `margin-block-start: auto` is what puts it at the base of the viewport on a
// page shorter than one: the body is a flex column (globals.css) and this is
// its last item.
// ---------------------------------------------------------------------------

const footerStyle = css({
  marginBlockStart: "auto",
  paddingBlockStart: "5xl",
});

const skylineStyle = css({
  display: "block",
  width: "100%",
  height: "siteFooter",
  // The page eases its background and text between themes (globals.css), and
  // the drawing's ground fills and strokes are the same tokens, so they move
  // on the same clock — or the buildings flash the new colour for the 150ms
  // the page is still on its way there.
  "& *": {
    transition: "fill 150ms ease, stroke 150ms ease",
  },
});

export function SiteFooter() {
  return (
    <footer data-site-footer className={footerStyle}>
      {/* Named, not decorative: it is a picture of a place, and the only one
          on the page. svgo takes the file's own <title> on import, so the
          name is given here. */}
      <Skyline
        className={skylineStyle}
        role="img"
        aria-label="Toronto skyline"
      />
    </footer>
  );
}
