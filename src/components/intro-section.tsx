import { css } from "../../styled-system/css";
import { Typography } from "./ui/typography";

const SOCIAL_LINKS = [
  { href: "https://github.com/ikartik90", label: "GitHub" },
  { href: "https://twitter.com/ikartik90", label: "Twitter" },
  { href: "https://linkedin.com/in/ikartik90", label: "LinkedIn" },
  { href: "mailto:hello@kartik.to", label: "Email" },
];

const socialLinkStyle = css({
  textStyle: "caption",
  color: "text.default",
  transition: "color 150ms ease",
  _hover: { color: "text.title" },
});

const socialListStyle = css({
  display: "flex",
  gap: "xl",
  listStyle: "none",
  marginTop: "3xl",
  flexWrap: "wrap",
});

const sectionStyle = css({
  maxWidth: "contentColumn",
  marginInline: "auto",
  width: "token(spacing.full)",
});

export function IntroSection() {
  return (
    <section className={sectionStyle}>
      <Typography tag="p" type="paragraph">
        I'm a design engineer who builds interfaces that close the gap between
        design intent and code reality. I care about the details that make
        software feel considered: the right typography scale, the transition
        that doesn't overstay its welcome, the component that works the same way
        every time.
      </Typography>
      <nav aria-label="Social links">
        <ul className={socialListStyle}>
          {SOCIAL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className={socialLinkStyle}
                target={href.startsWith("mailto:") ? undefined : "_blank"}
                rel={
                  href.startsWith("mailto:") ? undefined : "noopener noreferrer"
                }
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
