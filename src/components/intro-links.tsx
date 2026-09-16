import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";
import { Link } from "./ui/link";

// The `social_links` furniture on the homepage and on its editor: the way on to
// the about page, then the row of icons, both hanging off the intro above.
//
// A column rather than two blocks, so the pair keeps the article's own 16px
// between them and the extra space the row carries below (globals.css) still
// lands under the icons, not under the button.
const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "xl",
});

// The icon row is centred by its own box: `text-align` cannot reach the items
// of a flex container, so the centred paragraph above it does not carry here.
//
// The extra top margin stands the row off the BUTTON, so it is spent only when
// there is a button above it; under the intro alone the row keeps the
// article's own gap, which is what it had before the button existed.
const socialRowStyle = css({
  display: "flex",
  justifyContent: "center",
  "&[data-below-button]": { marginTop: "xxl" },
});

const pillStyle = css({ borderRadius: "full" });

interface IntroLinksProps {
  /** Whether `/about` is published. Until it is, the button would be a 404. */
  aboutPublished: boolean;
}

export function IntroLinks({ aboutPublished }: IntroLinksProps) {
  return (
    <div className={columnStyle}>
      {/* A bare string, not `Link.Text`: this renders from Server Components,
          and the compound sub-parts do not survive the client boundary. */}
      {aboutPublished && (
        <Link href="/about" className={pillStyle}>
          About me
        </Link>
      )}
      <nav
        aria-label="Social links"
        className={socialRowStyle}
        data-below-button={aboutPublished ? "" : undefined}
      >
        <SocialLinks />
      </nav>
    </div>
  );
}
