import type { Metadata } from "next";
import { SITE_PAGES } from "@/data/site-paths";
import { CalchemyPlayground } from "./calchemy-playground";

export const metadata: Metadata = {
  title: SITE_PAGES.calchemy.title,
  description: "Fire natural language date queries at a year of calendar.",
};

export default function CalchemyPlaygroundPage() {
  return <CalchemyPlayground />;
}
