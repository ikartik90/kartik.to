"use client";

import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";
import { OPEN_CARDS, projectPath } from "@/app/_project-stacks/data";
import { REVIEW_BASE, reviewBase } from "@/utils/review-path";
import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";

// Over the homepage hero's dithering, which runs up behind it to the page top.
const headerStyle = css({ zIndex: 1 });

export function Header() {
  const pathname = usePathname();
  // `/edit/home` is the homepage being edited, and keeps the header's furniture. A project's address is the homepage
  // under its sheet: dropping the header there moves the page beneath as the sheet opens and closes.
  const isHome =
    pathname === "/" ||
    pathname === REVIEW_BASE ||
    pathname === "/edit/home" ||
    OPEN_CARDS.some((card) => projectPath(card.id, reviewBase(pathname)) === pathname);

  if (!isHome) return null;

  return (
    <header data-site-header className={headerStyle}>
      <div data-site-menu>
        <MenuButton shape="circle" />
      </div>
      <ThemeToggle shape="circle" />
    </header>
  );
}
