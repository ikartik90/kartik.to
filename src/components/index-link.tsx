"use client";

import ReturnIcon from "@/assets/icons/return.svg";
import { Link } from "./ui/link";
import { Tooltip } from "./ui/tooltip";

// ---------------------------------------------------------------------------
// IndexLink — the way back to the front page, as an icon control.
//
// Shared the moment it was wanted twice: an article's intro carries it, and so
// does the cover playground. It brings no box of its own — where it SITS differs
// by surface (an article hangs it off `[data-article-back-anchor]`, the
// playground stands it in the band across the top of its canvas), and a
// component that positioned itself could only ever be right on one of them.
//
// `data-article-back` travels with it: that attribute is one declaration in
// globals.css (`position: relative`, which the tooltip anchors against), and
// splitting the hook off from the thing it hooks would be a second name for the
// same control.
//
// A client component for the same reason `ArticleIntro` is one: the tooltip is
// composed from `Link`'s Object.assign'd sub-parts, which do not survive the
// RSC client boundary.
// ---------------------------------------------------------------------------

export function IndexLink() {
  return (
    <Link href="/" variant="icon" aria-label="Index" data-article-back>
      <ReturnIcon />
      <Link.Tooltip>
        <Tooltip.Text>Index</Tooltip.Text>
      </Link.Tooltip>
    </Link>
  );
}
