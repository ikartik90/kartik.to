// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// StaticMeshGradient is WebGL, which jsdom can't run; the stand-in keeps `data-background-effect`.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ className }: { className?: string }) => (
    <div data-background-effect="" className={className} />
  ),
}));

import { linkCard } from "../../../styled-system/recipes";
import { LinkCard } from "../link-card";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { DEFAULT_BACKGROUND_EFFECT, type MediaNode } from "@/domain/nodes";

const picture = (src: string, over: Partial<MediaNode> = {}): MediaNode => ({
  type: "media",
  kind: "image",
  src,
  ...over,
});

const clip = (src: string): MediaNode => ({
  type: "media",
  kind: "video",
  src,
});

describe("LinkCard", () => {
  afterEach(cleanup);

  it("offers exactly the shapes the app's one ratio map defines", () => {
    expect(linkCard.variantMap.aspect).toEqual(Object.keys(ASPECT_RATIOS));
  });

  it("is a link to where it points, named by its title", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="16/9" />);

    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.getAttribute("href")).toBe("/work/atlas");
  });

  it("is ONE box at the shape it declares, with the title inside it", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.className).toContain("link-card__root--aspect_3/2");
    expect(link.querySelector("h2")?.textContent).toBe("Atlas");
  });

  it("carries a meta line over the cover when it is given one", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        meta="21 August 2026"
      />,
    );

    const link = screen.getByRole("link");
    expect(link.contains(screen.getByText("21 August 2026"))).toBe(true);
  });

  it("says nothing but its title when there is no meta line", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    expect(screen.getByRole("link").textContent).toBe("Atlas");
  });

  it("lays its cover across the card, as the element that can show it", () => {
    const { container } = render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        cover={picture("/opening.png")}
      />,
    );

    const shown = container.querySelector("img");
    expect(shown?.getAttribute("src")).toBe("/opening.png");
    expect(container.querySelector("video")).toBeNull();
  });

  it("plays a clip rather than showing it as a broken picture", () => {
    const { container } = render(
      <LinkCard
        href="/work/atlas"
        title="Atlas"
        aspect="3/2"
        cover={clip("/demo.mp4")}
      />,
    );

    const shown = container.querySelector("video");
    expect(shown?.getAttribute("src")).toBe("/demo.mp4");
    expect(shown?.hasAttribute("autoplay")).toBe(true);
    expect(shown?.hasAttribute("loop")).toBe(true);
    expect(shown?.hasAttribute("muted")).toBe(true);
  });

  it("keeps the cover out of the link's name", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        meta="21 August 2026"
        cover={picture("/opening.png")}
      />,
    );

    expect(
      screen.getByRole("link", { name: "21 August 2026 On frames" }),
    ).toBeTruthy();
  });

  it("grounds the words only where there is a picture under them", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        cover={picture("/opening.png")}
      />,
    );
    expect(screen.getByRole("link").hasAttribute("data-covered")).toBe(true);

    cleanup();

    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);
    expect(screen.getByRole("link").hasAttribute("data-covered")).toBe(false);
  });

  it("stacks every layer in paint order, ground to caption", () => {
    const { container } = render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        meta="21 August 2026"
        cover={picture("/opening.png", {
          backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
        })}
      />,
    );

    const named = (selector: string) =>
      [...container.querySelectorAll(selector)].map((node) =>
        node.hasAttribute("data-background-effect")
          ? "ground"
          : node.getAttribute("style")?.includes("backdrop-filter")
            ? "frosting"
            : node.className.includes("link-card__wash")
              ? "wash"
              : node.className.includes("link-card__caption")
                ? "caption"
                : node.querySelector("img")
                  ? "picture"
                  : "?",
      );

    expect(named("[class*=link-card__cover] > *")).toEqual([
      "ground",
      "picture",
    ]);
    expect(named("[class*=link-card__scrim] > *")).toEqual([
      "frosting",
      "frosting",
      "wash",
      "caption",
    ]);
  });

  it("puts the words INSIDE the scrim, so it can never be shorter than they are", () => {
    const { container } = render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        meta="21 August 2026"
        cover={picture("/opening.png")}
      />,
    );

    const scrim = container.querySelector("[class*=link-card__scrim]");
    expect(scrim?.contains(screen.getByText("On frames"))).toBe(true);
    expect(scrim?.contains(screen.getByText("21 August 2026"))).toBe(true);
  });

  it("draws no caption at all when it carries no words", () => {
    const { container } = render(
      <LinkCard href="/playground/shader" aspect="1/1" cover={picture("/p.png")} />,
    );
    expect(container.querySelector("[class*=link-card__caption]")).toBeNull();
  });

  it("is named by its label when it shows no words", () => {
    render(
      <LinkCard
        href="/playground/shader"
        label="Shader playground"
        aspect="1/1"
        cover={picture("/p.png")}
      />,
    );
    expect(screen.getByRole("link", { name: "Shader playground" })).toBeTruthy();
  });

  it("shows a meta line with no title under it", () => {
    render(<LinkCard href="/playground/shader" meta="Playground" aspect="1/1" />);
    expect(screen.getByRole("link").textContent).toBe("Playground");
  });

  it("can carry words over a picture with no scrim under them", () => {
    const { container } = render(
      <LinkCard
        href="/playground/shader"
        title="Shader"
        aspect="1/1"
        cover={picture("/p.png")}
        scrim={false}
      />,
    );
    expect(container.querySelector("[class*=link-card__wash]")).toBeNull();
    expect(container.querySelector("[class*=link-card__caption]")).toBeTruthy();
  });

  it("pins the scrim and its ink to the tone it was given", () => {
    const { container } = render(
      <LinkCard
        href="/playground/shader"
        title="Shader"
        aspect="1/1"
        cover={picture("/p.png")}
        tone="dark"
      />,
    );
    const scrim = container.querySelector("[class*=link-card__scrim]");
    expect(scrim?.className).toContain("link-card__scrim--tone_dark");
  });

  it("lets the words follow the reader's theme when no tone is set", () => {
    const { container } = render(
      <LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />,
    );
    expect(
      container.querySelector("[class*=link-card__scrim]")?.className,
    ).not.toContain("tone_");
  });

  it("carries a picture per theme, and shows one of them at a time", () => {
    const { container } = render(
      <LinkCard
        href="/playground/shader"
        aspect="1/1"
        label="Shader"
        cover={picture("/light.png")}
        coverDark={picture("/dark.png")}
      />,
    );
    const sources = [...container.querySelectorAll("img")].map((img) =>
      img.getAttribute("src"),
    );
    expect(sources).toEqual(["/light.png", "/dark.png"]);
  });

  it("shows the one picture in both themes when only one was given", () => {
    const { container } = render(
      <LinkCard
        href="/playground/shader"
        aspect="1/1"
        label="Shader"
        cover={picture("/one.png")}
      />,
    );
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  it("counts a dark-only picture as a cover", () => {
    render(
      <LinkCard
        href="/playground/shader"
        aspect="1/1"
        label="Shader"
        coverDark={picture("/dark.png")}
      />,
    );
    expect(screen.getByRole("link").hasAttribute("data-covered")).toBe(true);
  });

  it("opens away from here when it is told to", () => {
    render(
      <LinkCard href="https://example.com" title="Elsewhere" aspect="1/1" newTab />,
    );
    const link = screen.getByRole("link", { name: "Elsewhere" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("stays in this tab by default", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="1/1" />);
    expect(screen.getByRole("link").hasAttribute("target")).toBe(false);
  });

  it("is not a link until it has somewhere to go", () => {
    render(<LinkCard title="Unfinished" aspect="1/1" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Unfinished")).toBeTruthy();
  });
});
