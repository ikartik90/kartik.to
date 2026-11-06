"use client";

import { useEffect } from "react";
import { useFirstFoldSettled } from "@/hooks/use-first-fold-settled";
import { loadSiteStyles } from "@/utils/site-styles";

/** Adds the whole site's stylesheet once the first fold has settled, ready for what this page or the next loads. */
export function SiteStyles() {
  const settled = useFirstFoldSettled();
  useEffect(() => {
    if (settled) void loadSiteStyles();
  }, [settled]);
  return null;
}
