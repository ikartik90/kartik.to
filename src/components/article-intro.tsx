import ReturnIcon from "@/assets/icons/return.svg";
import { Link } from "./ui/link";
import { Typography } from "./ui/typography";

interface ArticleIntroProps {
  /** Optional — a titleless draft still renders the back navigation. */
  title?: string | null;
}

export function ArticleIntro({ title }: ArticleIntroProps) {
  return (
    <div data-article-intro>
      <div data-article-back-anchor>
        {/* Bare-string label, NOT <Link.Text>: this is a Server Component, and
            Link's Object.assign'd sub-components don't survive the RSC client
            boundary (they'd be `undefined`). The recipe styles the string the same. */}
        <Link href="/" variant="icon" aria-label="Home" data-article-back>
          <ReturnIcon />
          Home
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
