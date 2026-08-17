import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";
import { Typography } from "./ui/typography";

// `textAlign` on the section rather than on the paragraph: it is inherited, so
// the one declaration centres the lines and anything else the intro ever sets
// under them, and the row of icons only has to say how its own box is placed.
const sectionStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
  textAlign: "center",
});

// The list inside is a flex row that shrink-wraps its icons, so centring it is
// the nav's job — `text-align` cannot reach a flex container's items.
const socialRowStyle = css({
  display: "flex",
  justifyContent: "center",
});

export function IntroSection() {
  return (
    <section className={sectionStyle}>
      <Typography tag="p" type="bodyLarge">
        Hi, I&apos;m Kartik, an AI-native designer building digital experiences for
        hypergrowth businesses. I invest care into the details that make
        software feel considered.
      </Typography>
      <nav aria-label="Social links" className={socialRowStyle}>
        <SocialLinks />
      </nav>
    </section>
  );
}
