import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";
import { Typography } from "./ui/typography";

const sectionStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
  textAlign: "center",
});

const socialRowStyle = css({
  display: "flex",
  justifyContent: "center",
});

export function IntroSection() {
  return (
    <section className={sectionStyle}>
      <Typography tag="p" type="bodyLarge" wrap="balance">
        Hi, I&apos;m Kartik. As a design systems and prototyping specialist of
        12 years, I design to help startups achieve product-market-fit and
        hypergrowth. I invest care into the details that make software feel
        considered.
      </Typography>
      <nav aria-label="Social links" className={socialRowStyle}>
        <SocialLinks />
      </nav>
    </section>
  );
}
