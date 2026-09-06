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
        meta="21 August 2026"
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
        meta="21 August 2026"
        cover={picture("/opening.png")}
      />,
    );

    const scrim = container.querySelector("[class*=link-card__scrim]");
    expect(scrim?.contains(screen.getByText("On frames"))).toBe(true);
    expect(scrim?.contains(screen.getByText("21 August 2026"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // The configurable card — a published link card, as opposed to a post's tile.
  //
  // A post's card always has a title and takes its picture from its own
  // document. One published from the component library has neither by default:
  // it is a shell you fill in, and every part of it is optional, so the card
  // has to be a real thing at every stage of being built.
  // -------------------------------------------------------------------------

  it("draws no caption at all when it carries no words", () => {
    // Not an empty caption box: the box has padding and a gap, so an empty one
    // is a strip of dead space across the foot of the picture — and the scrim
    // that grounds it would be shading nothing.
    const { container } = render(
      <LinkCard href="/playground/shader" aspect="1/1" cover={picture("/p.png")} />,
    );
    expect(container.querySelector("[class*=link-card__caption]")).toBeNull();
  });

  // The picture is decorative (`alt=""`, aria-hidden), so a wordless card has
  // no accessible name of its own — the caller has to give it one.
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
    // A screenshot that is already flat and dark where the caption sits needs
    // no wash, and one laid over it only greys the picture out.
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

  // The tone pins the caption's ink and the wash's colour to ONE theme instead
  // of letting them follow the reader's, and it has to: what the words stand on
  // is the picture, and the picture does not change when the page does. A
  // caption tracking the page theme goes white on a light screenshot the moment
  // the reader flips to dark.
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

  // Two files, both in the DOM, swapped in CSS — the page is rendered on the
  // server and the theme is not a question it can ask there, so a scripted
  // answer would paint the light screenshot onto a dark page and swap it a
  // frame later.
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

  // A card given only a dark picture is still a card with a picture on it —
  // the scrim and the ink reassignment key off having ANY, not off having the
  // light one.
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
    // Never `target="_blank"` without it: the opened page gets a handle on this
    // one through `window.opener` otherwise.
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("stays in this tab by default", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="1/1" />);
    expect(screen.getByRole("link").hasAttribute("target")).toBe(false);
  });

  // A card being built has not been pointed anywhere yet. An anchor with an
  // empty href is a link to the page you are already on — focusable, followable
  // and wrong — so a card with no destination is not a link at all.
  it("is not a link until it has somewhere to go", () => {
    render(<LinkCard title="Unfinished" aspect="1/1" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Unfinished")).toBeTruthy();
  });
});
