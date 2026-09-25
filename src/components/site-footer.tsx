import Skyline from "@/assets/illustrations/toronto-skyline.svg";
import { css } from "../../styled-system/css";

const footerStyle = css({
  marginBlockStart: "auto",
  paddingBlockStart: "5xl",
});

const skylineStyle = css({
  display: "block",
  width: "100%",
  height: "siteFooter",
  // Matches the page's 150ms theme transition in globals.css.
  "& *": {
    transition: "fill 150ms ease, stroke 150ms ease",
  },
});

export function SiteFooter() {
  return (
    <footer data-site-footer className={footerStyle}>
      {/* svgo strips the file's <title>, so the name is given here. */}
      <Skyline
        className={skylineStyle}
        role="img"
        aria-label="Toronto skyline"
      />
    </footer>
  );
}
