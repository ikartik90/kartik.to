import type { Metadata } from "next";
import { SITE_PAGES } from "@/data/site-paths";
import { ShaderPlayground } from "./shader-playground";

export const metadata: Metadata = {
  title: SITE_PAGES.shader.title,
  description: "Tune a preset's shader background and copy it out as JSX.",
};

export default function ShaderPlaygroundPage() {
  return <ShaderPlayground />;
}
