"use client";

import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";
import { Typography } from "./ui/typography";

// Client component: MenuButton's Object.assign'd sub-parts don't survive the RSC boundary.

interface ArticleIntroProps {
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
