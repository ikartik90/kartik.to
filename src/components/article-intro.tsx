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
        <Link href="/" variant="icon" aria-label="Home" data-article-back>
          <ReturnIcon />
          <Link.Text>Home</Link.Text>
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
