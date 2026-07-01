import { css } from "../../styled-system/css";
import KartikIyerSvg from "@/assets/icons/kartik-iyer.svg";
import { Typography } from "./ui/typography";

const logoStyle = css({
  color: "logo.default",
  display: "block",
  transition: "color 150ms ease",
});

export function Header() {
  return (
    <header data-site-header>
      <a href="/" aria-label="Home" className={logoStyle}>
        <KartikIyerSvg aria-label="Kartik Iyer" role="img" />
        <Typography tag="p" type="caption">
          Designer. Engineer. Builder.
        </Typography>
      </a>
    </header>
  );
}
