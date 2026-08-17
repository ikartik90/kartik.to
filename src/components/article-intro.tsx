"use client";

import ReturnIcon from "@/assets/icons/return.svg";
import { Link } from "./ui/link";
import { Tooltip } from "./ui/tooltip";
import { Typography } from "./ui/typography";

// A client component for one reason: the back control is an icon button, and an
// icon button says what it is on hover. That tooltip is composed from Link's
// Object.assign'd sub-parts (`Link.Tooltip` / `Tooltip.Text`), which do not
// survive the RSC client boundary — across it they'd be `undefined`. Nothing
// here is server-only (no data, no env), so the cheapest way to have the house
// tooltip is to sit on the client side of that boundary with it.

interface ArticleIntroProps {
  /** Optional — a titleless draft still renders the back navigation. */
  title?: string | null;
}

export function ArticleIntro({ title }: ArticleIntroProps) {
  return (
    <div data-article-intro>
      <div data-article-back-anchor>
        <Link href="/" variant="icon" aria-label="Index" data-article-back>
          <ReturnIcon />
          <Link.Tooltip>
            <Tooltip.Text>Index</Tooltip.Text>
          </Link.Tooltip>
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
