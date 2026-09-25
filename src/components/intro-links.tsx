import { css } from "../../styled-system/css";
import { SocialLinks } from "./social-links";

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
