import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";

// The `social_links` furniture on the homepage and on its editor: the row of
// icons hanging off the intro above.
//
// The way on to the About page used to be drawn here too. It is a
// `button_link` block in the homepage's document now, written and moved like
// any other block; the extra space that stands this row off a button above it
// lives in globals.css, beside the space the row carries below.

// The icon row is centred by its own box: `text-align` cannot reach the items
// of a flex container, so the centred paragraph above it does not carry here.
const socialRowStyle = css({
  display: "flex",
  justifyContent: "center",
});

export function IntroLinks() {
  return (
    <nav aria-label="Social links" className={socialRowStyle}>
      <SocialLinks />
    </nav>
  );
}
