// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// StaticMeshGradient is WebGL; jsdom cannot run it. The stand-in keeps the
// `data-background-effect` hook, which is what marks the ground in the cover's
// paint order.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ className }: { className?: string }) => (
    <div data-background-effect="" className={className} />
  ),
}));

import { linkCard } from "../../../styled-system/recipes";
import { LinkCard } from "../link-card";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { DEFAULT_BACKGROUND_EFFECT, type MediaNode } from "@/domain/nodes";

/** A cover is a media object; these two spell the constant parts once. */
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
    // The card has no ratio list of its own — the recipe derives its `aspect`
    // variant from `ASPECT_RATIOS`, so a twelfth ratio is one line in one file.
    // The two sides of this are genuinely independent artefacts (the runtime
    // map in src/utils, and the variant metadata Panda generates out of
    // panda.config.ts), so forking one is what makes them disagree. Asserting
    // the CLASS a given `aspect` renders would not catch it: the recipe
    // function builds `--aspect_<value>` from the prop without consulting the
    // variant map at all, so an undeclared ratio names a class that no
    // stylesheet ever emitted and the DOM looks perfectly correct.
    expect(linkCard.variantMap.aspect).toEqual(Object.keys(ASPECT_RATIOS));
  });

  it("is a link to where it points, named by its title", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="16/9" />);

    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.getAttribute("href")).toBe("/work/atlas");
  });

  it("is ONE box at the shape it declares, with the title inside it", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    // The card used to be a shaped cover with the title stacked in a column
    // underneath it, so what is worth pinning is WHICH element wears the shape:
    // the whole card, with the words inside it, not an inner box the words sit
    // below. Put the ratio back on a child and this reads it off the wrong
    // element and fails.
    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.className).toContain("link-card__root--aspect_3/2");
    expect(link.querySelector("h2")?.textContent).toBe("Atlas");
  });

  it("carries a date over the cover when it is given one", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        date="21 August 2026"
      />,
    );

    const link = screen.getByRole("link");
    expect(link.contains(screen.getByText("21 August 2026"))).toBe(true);
  });

  it("says nothing but its title when there is no date", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    // A listing without dates — the projects one — must not get an empty meta
    // line reserving space for something it will never have.
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
    // The FORMAT decides the element, and it is the cover's own word for it —
    // never a guess off the src, which is the whole reason `kind` is carried
    // this far (see `media-source.ts`).
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
    // Muted twice over — the attribute as well as the property — because
    // without the attribute the autoplay policy declines a server-rendered
    // clip and hydration setting the property does not make it reconsider.
    expect(shown?.hasAttribute("muted")).toBe(true);
  });

  it("keeps the cover out of the link's name", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        date="21 August 2026"
        cover={picture("/opening.png")}
      />,
    );

    // The picture is the article's illustration; the link is named by what it
    // opens. A card that read its diagram's description out before its own
    // title would announce the picture in place of the destination — so the
    // accessible name is exactly what it was before covers existed.
    expect(
      screen.getByRole("link", { name: "21 August 2026 On frames" }),
    ).toBeTruthy();
  });

  it("grounds the words only where there is a picture under them", () => {
    // The wash and its frosting are what keep the caption legible over a
    // photograph. Over the flat plate a coverless card draws there is nothing
    // to separate the words from, and a `bg.surface` wash on `bg.surface`
    // would be an invisible gradient and two backdrop filters nobody asked
    // the compositor for.
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
    // Everything here is positioned with no z-index anywhere, so tree order IS
    // paint order and these lists are the behaviour rather than a description
    // of it. Two of them have been in the wrong place: a frosting layer written
    // after the wash filters a near-opaque plate and shows nothing for two
    // compositor layers, and an absolutely placed ground outpaints an in-flow
    // `<img>` — which is why the picture has a positioned box of its own
    // rather than standing in the flow.
    const { container } = render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        date="21 August 2026"
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
    // The frosting is TWO layers — one masked short, one long — and the wash
    // goes over both of them, never under.
    expect(named("[class*=link-card__scrim] > *")).toEqual([
      "frosting",
      "frosting",
      "wash",
      "caption",
    ]);
  });

  it("puts the words INSIDE the scrim, so it can never be shorter than they are", () => {
    // The scrim is the caption's own box with a floor of half the card — which
    // is how `max(half the card, the words)` is said without measuring
    // anything. Held to exactly half instead, a two-line title on a small tile
    // starts eight points ABOVE the scrim and its first line stands on bare
    // picture: 1.8:1 over a near-white screenshot in dark mode, and the date
    // over it 1.0:1, which is white on white.
    const { container } = render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        date="21 August 2026"
        cover={picture("/opening.png")}
      />,
    );

    const scrim = container.querySelector("[class*=link-card__scrim]");
    expect(scrim?.contains(screen.getByText("On frames"))).toBe(true);
    expect(scrim?.contains(screen.getByText("21 August 2026"))).toBe(true);
  });
});
