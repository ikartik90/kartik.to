"use client";

import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";
import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";

// Over the homepage hero's dithering, which runs up behind it to the page top.
const headerStyle = css({ zIndex: 1 });

export function Header() {
  const pathname = usePathname();
  // `/edit/home` is the homepage being edited, and keeps the header's furniture.
  const isHome = pathname === "/" || pathname === "/edit/home";

  if (!isHome) return null;

  return (
    <header data-site-header className={headerStyle}>
      <div data-site-menu>
        <MenuButton />
      </div>
      <ThemeToggle />
    </header>
  );
}
