"use client";

import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";
import { Typography } from "./ui/typography";

// A client component for one reason: it composes two controls that are
// themselves client components (`MenuButton`'s tooltip is built from Button's
// Object.assign'd sub-parts, which do not survive the RSC client boundary).
// Nothing here is server-only (no data, no env), so the cheapest way to have
// them is to sit on the client side of that boundary with them.

interface ArticleIntroProps {
  /** Optional — a titleless draft still renders the gutter controls. */
  title?: string | null;
}

export function ArticleIntro({ title }: ArticleIntroProps) {
  return (
    <div data-article-intro>
      <div data-site-menu>
        <MenuButton />
      </div>
      <ThemeToggle />
      {title && (
        <Typography tag="h1" type="title">
          {title}
        </Typography>
      )}
    </div>
  );
}
