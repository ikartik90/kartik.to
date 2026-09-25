import type { Metadata } from "next";
import { SITE_PAGES } from "@/data/site-paths";
import { listApprovedIconsWithSvg } from "@/lib/icons";
import { IconsPlayground } from "./icons-playground";

// No session reads here: they would make this static route dynamic for everyone (see `listHeldIcons`).

export const metadata: Metadata = {
  title: SITE_PAGES.icons.title,
  description: "Scale and re-weight the icon set, and take it away as SVG.",
};

export default async function IconsPlaygroundPage() {
  return <IconsPlayground prerendered={await listApprovedIconsWithSvg()} />;
}
