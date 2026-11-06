"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";
import { pageOpening } from "../../styled-system/recipes";
import { openingLineDelay } from "@/data/page-opening";
import { PROJECT_CARDS, projectPath } from "@/data/project-cards";
import { REVIEW_BASE, reviewBase } from "@/utils/review-path";
import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";

// Over the homepage hero's dithering, which runs up behind it to the page top.
const headerStyle = css({ zIndex: 1 });

// Fades in with the hero's heading. On the controls themselves: opacity on a wrapper would cut off their frost's blur.
const fadeOpening = pageOpening({ part: "fade" });
const headingDelay = { "--opening-delay": `${openingLineDelay(1)}ms` } as CSSProperties;

export function Header() {
  const pathname = usePathname();
  // `/edit/home` is the homepage being edited, and keeps the header's furniture. A project's address is the homepage
  // under its overlay: dropping the header there moves the page beneath as the overlay opens and closes.
  const isHome =
    pathname === "/" ||
    pathname === REVIEW_BASE ||
    pathname === "/edit/home" ||
    PROJECT_CARDS.some((card) => projectPath(card.id, reviewBase(pathname)) === pathname);

  if (!isHome) return null;

  return (
    <header data-site-header className={headerStyle} style={headingDelay}>
      <div data-site-menu>
        <MenuButton shape="circle" className={fadeOpening} />
      </div>
      <ThemeToggle shape="circle" className={fadeOpening} />
    </header>
  );
}
