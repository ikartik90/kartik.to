import { reviewBase } from "./review-path";

export interface BackTarget {
  href: string;
  label: string;
}

export function getBackTarget(pathname: string): BackTarget | null {
  const base = reviewBase(pathname);
  const isIndex = pathname.slice(base.length).split("/").filter(Boolean).length === 0;
  return isIndex ? null : { href: base || "/", label: "index" };
}
