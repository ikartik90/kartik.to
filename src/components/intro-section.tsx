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

// Bold prose as the articles set it — 550 and the full-strength ink, so an
// emphasised run steps out of the 75% the paragraph around it reads at. Both
// have to be named rather than left to the `<strong>`: the rule that pairs them
// (globals.css, `article :is(strong, b)`) is scoped to article content, which
// the home page is not, and the tag alone would take the UA's `bolder` — 700,
// well past what this type scale calls bold.
const emphasisStyle = css({
  fontWeight: "bold",
  color: "text.default",
});

export function IntroSection() {
  return (
    <section className={sectionStyle}>
      {/* Three sentences centred under the logo and nothing beside them: the
          lines have to come out even, which `pretty` — the body default — only
          promises for the last one. */}
      <Typography tag="p" type="bodyLarge" wrap="balance">
        Hi, I&apos;m Kartik. A design systems and prototyping specialist of 12
        years,{" "}
        <strong className={emphasisStyle}>
          driving startups into hypergrowth
        </strong>
        . I invest care into the details that make software feel considered.
      </Typography>
      <nav aria-label="Social links" className={socialRowStyle}>
        <SocialLinks />
      </nav>
    </section>
  );
}
