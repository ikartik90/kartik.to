import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { SITE_PAGES } from "@/data/site-paths";

vi.mock("../shader/shader-playground", () => ({ ShaderPlayground: () => null }));
vi.mock("../calchemy/calchemy-playground", () => ({ CalchemyPlayground: () => null }));
vi.mock("../icons/icons-playground", () => ({ IconsPlayground: () => null }));
vi.mock("@/lib/icons", () => ({ listApprovedIconsWithSvg: vi.fn() }));

import { metadata as shader } from "../shader/page";
import { metadata as calchemy } from "../calchemy/page";
import { metadata as icons } from "../icons/page";

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
