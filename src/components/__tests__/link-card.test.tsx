// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// StaticMeshGradient is WebGL, which jsdom can't run; the stand-in keeps `data-background-effect`.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ className }: { className?: string }) => (
    <div data-background-effect="" className={className} />
  ),
}));

// jsdom has no webgl2; the marker carries which shader plays and what it was handed.
vi.mock("@/components/shaders/shader-stage", () => ({
  MAX_PIXELS: 1280 * 1280,
  layerStyle: "",
  ShaderStage: ({
    spec,
    params,
    minPixelRatio,
    maxPixelCount,
  }: {
    spec: { id: string };
    params: Record<string, number>;
    minPixelRatio?: number;
    maxPixelCount?: number;
  }) => (
    <canvas
      data-shader={spec.id}
      data-speed={String(params.speed)}
      data-min-pixel-ratio={minPixelRatio}
      data-max-pixel-count={maxPixelCount}
    />
  ),
}));

// Run by the cursor and the frame clock, and tested in its own file; the marker carries how many icons it was handed.
vi.mock("@/components/icon-cubes", () => ({
  IconCubes: ({ icons }: { icons: unknown[] }) => <div data-icon-cubes={icons.length} />,
}));

/** jsdom lays nothing out, so the shader's cover reports its size as a browser would on mount. */
function stubCoverSize(width: number, height: number) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width, height } } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

import { linkCard } from "../../../styled-system/recipes";
import { LinkCard } from "../link-card";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { DEFAULT_BACKGROUND_EFFECT, type MediaNode } from "@/domain/nodes";
import { shaderPresetContentFor } from "@/domain/shader-preset";

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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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

  it("holds its own shape unless told to stretch to its container's height", () => {
    const { rerender } = render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);
    const link = () => screen.getByRole("link", { name: "Atlas" });
    expect(link().className).not.toContain("stretch_true");

    rerender(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" stretch />);
    expect(link().className).toContain("link-card__root--stretch_true");
  });

  it("rounds its corners and draws all four sides unless tiled into a grid that draws its lines", () => {
    const { rerender } = render(<LinkCard href="/work/atlas" title="Atlas" aspect="1/1" />);
    const link = () => screen.getByRole("link", { name: "Atlas" });
    expect(link().className).not.toContain("tiled_true");

    rerender(<LinkCard href="/work/atlas" title="Atlas" aspect="1/1" tiled />);
    expect(link().className).toContain("link-card__root--tiled_true");
  });

  it("plays the icon set's cubes in place of its pictures, and grounds its words over them", () => {
    const icons = [{ key: "a", svg: { viewBox: 20, flattened: false, nodes: [] } }];
    const { container } = render(
      <LinkCard href="/playground/icons" title="Crest Icons" aspect="1/1" cover={picture("/light.png")} icons={icons} />,
    );
    expect(container.querySelector("[data-icon-cubes]")?.getAttribute("data-icon-cubes")).toBe("1");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link").hasAttribute("data-covered")).toBe(true);
  });

  it("shows its pictures when it has no icons to play", () => {
    const { container } = render(
      <LinkCard href="/playground/icons" title="Crest Icons" aspect="1/1" cover={picture("/light.png")} icons={[]} />,
    );
    expect(container.querySelector("[data-icon-cubes]")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
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

  it("plays a shader preset in place of its pictures", () => {
    stubCoverSize(470, 313);
    const { container } = render(
      <LinkCard
        href="/playground/shader/comets"
        title="Comets"
        aspect="3/2"
        cover={picture("/light.png")}
        shader={shaderPresetContentFor("pixelComets")}
      />,
    );
    expect(container.querySelector("canvas")?.getAttribute("data-shader")).toBe(
      "pixelComets",
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("grounds its words over a shader as over a picture", () => {
    render(
      <LinkCard
        href="/playground/shader/comets"
        title="Comets"
        aspect="3/2"
        shader={shaderPresetContentFor("pixelComets")}
      />,
    );
    expect(screen.getByRole("link").hasAttribute("data-covered")).toBe(true);
  });

  it("plays the shader at the speed its preset was saved with", () => {
    stubCoverSize(470, 313);
    const preset = shaderPresetContentFor("cosmicTrack");
    const { container } = render(
      <LinkCard
        href="/playground/shader/track"
        title="Track"
        aspect="3/2"
        shader={{
          ...preset,
          settings: {
            ...preset.settings,
            params: { ...preset.settings.params, speed: 2 },
          },
        }}
      />,
    );
    expect(container.querySelector("canvas")?.getAttribute("data-speed")).toBe("2");
  });

  it("holds the shader still for a reader who asks for less motion", () => {
    stubCoverSize(470, 313);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const preset = shaderPresetContentFor("cosmicTrack");
    const { container } = render(
      <LinkCard
        href="/playground/shader/track"
        title="Track"
        aspect="3/2"
        shader={{
          ...preset,
          settings: {
            ...preset.settings,
            params: { ...preset.settings.params, speed: 2 },
          },
        }}
      />,
    );
    vi.unstubAllGlobals();
    expect(container.querySelector("canvas")?.getAttribute("data-speed")).toBe("0");
  });

  it("starts the shader only once the card comes near the screen", () => {
    stubCoverSize(470, 313);
    let reveal: () => void = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          reveal = () =>
            callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    const { container } = render(
      <LinkCard
        href="/playground/shader/comets"
        title="Comets"
        aspect="3/2"
        shader={shaderPresetContentFor("pixelComets")}
      />,
    );
    expect(container.querySelector("canvas")).toBeNull();

    act(() => reveal());
    vi.unstubAllGlobals();
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("draws the shader as the playground previews it, scaled down to the card", () => {
    // Half the preview's 680px, on jsdom's 1× screen (the library's 2× floor applies).
    stubCoverSize(340, 227);
    const { container } = render(
      <LinkCard
        href="/playground/shader/comets"
        title="Comets"
        aspect="3/2"
        shader={shaderPresetContentFor("pixelComets")}
      />,
    );
    const stage = container.querySelector("canvas");
    expect(stage?.getAttribute("data-min-pixel-ratio")).toBe("1");
    expect(stage?.getAttribute("data-max-pixel-count")).toBe(String(680 * 454));
  });

  it("keeps the shader out of the link's name", () => {
    render(
      <LinkCard
        href="/playground/shader/comets"
        title="Comets"
        aspect="3/2"
        shader={shaderPresetContentFor("pixelComets")}
      />,
    );
    expect(screen.getByRole("link", { name: "Comets" })).toBeTruthy();
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
