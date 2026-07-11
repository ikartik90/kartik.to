import Link from "next/link";
import { css, cx } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import ReturnIcon from "@/assets/icons/return.svg";
import { buttonRecipe } from "./ui/button-recipe";
import { Typography } from "./ui/typography";

const backIconStyle = menuIcon();

const backButtonStyle = css({
  gap: "sm",
  _hover: { backgroundColor: "bg.button.tertiary.hover" },
});

const backLabelStyle = css({
  textStyle: "commandItem",
});

interface ArticleIntroProps {
  /** Optional — a titleless draft still renders the back navigation. */
  title?: string | null;
}

export function ArticleIntro({ title }: ArticleIntroProps) {
  return (
    <div data-article-intro>
      <div data-article-back-anchor>
        <Link
          href="/"
          aria-label="Home"
          data-article-back
          className={cx(buttonRecipe({ variant: "icon" }), backButtonStyle)}
        >
          <ReturnIcon className={backIconStyle} />
          <span className={backLabelStyle}>Home</span>
        </Link>
      </div>
      {title && (
        <Typography tag="h1" type="title">
          {title}
        </Typography>
      )}
    </div>
  );
}
