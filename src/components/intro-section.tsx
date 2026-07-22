import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";
import { Typography } from "./ui/typography";

const sectionStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
});

export function IntroSection() {
  return (
    <section className={sectionStyle}>
      <Typography tag="p" type="bodyLarge">
        Hi, I&apos;m Kartik, an AI-native designer building digital experiences for
        hypergrowth businesses. I invest care into the details that make
        software feel considered.
      </Typography>
      <nav aria-label="Social links">
        <SocialLinks />
      </nav>
    </section>
  );
}
