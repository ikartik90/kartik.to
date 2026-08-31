// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type MediaNode,
} from "@/domain/nodes";

// StaticMeshGradient is WebGL; jsdom can't run it. Stand it in with a marker
// element carrying the colours, so a test can assert what was rendered.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({
    colors,
    className,
  }: {
    colors: string[];
    className?: string;
  }) => (
    <div
      data-background-effect=""
      data-colors={colors.join(",")}
      className={className}
    >
      <canvas />
    </div>
  ),
}));

import { MediaObject } from "../media-object";

afterEach(cleanup);

const classes = {
  root: "root",
  frame: "frame",
  image: "image",
  backgroundEffect: "ground",
};

const image = (over: Partial<MediaNode> = {}): MediaNode =>
  ({ type: "media", kind: "image", src: "a.png", ...over }) as MediaNode;

function setup(props: Partial<Parameters<typeof MediaObject>[0]> = {}) {
  const handlers = {
    onToggleProperties: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <MediaObject
      item={image()}
      classes={classes}
      label="Image"
      propertiesOpen={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

const toolbar = () => screen.getByRole("toolbar");

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

describe("MediaObject toolbar", () => {
  it("offers properties, replace and remove on every object", () => {
    setup();
    const rail = within(toolbar());
    expect(rail.getByRole("button", { name: "Image properties" })).toBeDefined();
    expect(rail.getByRole("button", { name: "Replace image" })).toBeDefined();
    expect(rail.getByRole("button", { name: "Remove image" })).toBeDefined();
  });

  // Absent, not disabled: a standalone block has no other slot to be featured
  // OVER, so the control is not merely unavailable — it is meaningless.
  it("withholds the feature control when no handler is given", () => {
    setup();
    expect(
      within(toolbar()).queryByRole("button", { name: "Feature image" }),
    ).toBeNull();
  });

  it("offers the feature control to an object that has a position", () => {
    setup({ featured: false, onFeature: vi.fn() });
    expect(
      within(toolbar()).getByRole("button", { name: "Feature image" }),
    ).toBeDefined();
  });

  // Pressed rather than disabled — a disabled button dims to 40%, which would
  // fight the brand chip that is the whole signal here.
  it("holds the feature control down on the featured object", () => {
    setup({ featured: true, onFeature: vi.fn() });
    expect(
      within(toolbar())
        .getByRole("button", { name: "Feature image" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("reports the PANEL's state on the properties control, not the object's", () => {
    setup({ propertiesOpen: true });
    expect(
      within(toolbar())
        .getByRole("button", { name: "Image properties" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  // A collection slot is emptied; a standalone block is deleted. Same button,
  // different consequence, so the caller names it.
  it("lets the surface name what removal means", () => {
    setup({ removeLabel: "Delete image" });
    expect(
      within(toolbar()).getByRole("button", { name: "Delete image" }),
    ).toBeDefined();
  });

  it("names the object it belongs to", () => {
    setup({ label: "Image 3" });
    expect(toolbar().getAttribute("aria-label")).toBe("Image 3 actions");
  });
});

// ---------------------------------------------------------------------------
// What it paints
// ---------------------------------------------------------------------------

describe("MediaObject media", () => {
  it("paints the shader ground behind the picture", () => {
    setup({ item: image({ backgroundEffect: DEFAULT_BACKGROUND_EFFECT }) });
    expect(document.querySelector("[data-background-effect]")).not.toBeNull();
  });

  it("paints no ground for an object that has none", () => {
    setup();
    expect(document.querySelector("[data-background-effect]")).toBeNull();
  });

  // The panel previews what the reader will see, so the object has to wear its
  // own fit, inset and corner wherever it is rendered.
  it("wears the layout the object states", () => {
    setup({ item: image({ padding: 16, borderRadius: 8 }) });
    const img = document.querySelector("img")!;
    expect(img.style.borderRadius).not.toBe("");
  });

  it("falls back to the caption for alt text", () => {
    setup({ item: image({ caption: "A wiring diagram" }) });
    expect(document.querySelector("img")!.getAttribute("alt")).toBe(
      "A wiring diagram",
    );
  });

  it("shows the placeholder instead of a broken picture when there is no source", () => {
    setup({
      item: image({ src: "" }),
      placeholder: <span data-placeholder="">nothing yet</span>,
    });
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[data-placeholder]")).not.toBeNull();
  });

  // The reveal rule keys on this, and it is the ONE hook both surfaces share.
  it("marks the frame as a media cell", () => {
    setup();
    expect(document.querySelector("[data-media-cell]")).not.toBeNull();
  });
});
