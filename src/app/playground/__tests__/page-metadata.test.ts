import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { SITE_PAGES } from "@/data/site-paths";

// Only each route's metadata is under test, not the playground it renders.
vi.mock("../shader/shader-playground", () => ({ ShaderPlayground: () => null }));
vi.mock("../calchemy/calchemy-playground", () => ({ CalchemyPlayground: () => null }));
vi.mock("../icons/icons-playground", () => ({ IconsPlayground: () => null }));
vi.mock("@/lib/icons", () => ({ listApprovedIconsWithSvg: vi.fn() }));

import { metadata as shader } from "../shader/page";
import { metadata as calchemy } from "../calchemy/page";
import { metadata as icons } from "../icons/page";

// Every playground is listed in `sitemap.xml` and `llms.txt` (`site-index`), so
// none of them may tell a crawler to leave it out — a sitemap entry the page
// itself refuses is the two files contradicting each other. Keyed by
// `SITE_PAGES`, so a new playground does not type-check until it is added here.
const PAGES = { shader, calchemy, icons } satisfies Record<
  keyof typeof SITE_PAGES,
  Metadata
>;

describe("playground metadata", () => {
  it.each(Object.entries(PAGES))("leaves %s open to search engines", (_, metadata) => {
    expect(metadata.robots).toBeUndefined();
  });

  it.each(Object.entries(PAGES))("titles %s by its public name", (key, metadata) => {
    expect(metadata.title).toBe(SITE_PAGES[key as keyof typeof SITE_PAGES].title);
  });
});
