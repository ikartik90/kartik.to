import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type BackgroundEffect,
  type MediaFit,
} from "@/domain/nodes";
import { MediaPropertiesPanel } from "../media-properties-panel";

afterEach(() => cleanup());

function setup(
  props: Partial<{
    caption: string | undefined;
    effect: BackgroundEffect | undefined;
    objectFit: MediaFit | undefined;
    padding: number | undefined;
    borderRadius: number | undefined;
  }> = {},
) {
  const onCaptionChange = vi.fn();
  const onEffectChange = vi.fn();
  const onObjectFitChange = vi.fn();
  const onPaddingChange = vi.fn();
  const onBorderRadiusChange = vi.fn();
  const onDismiss = vi.fn();
  render(
    <MediaPropertiesPanel
      caption={props.caption}
      effect={props.effect}
      objectFit={props.objectFit}
      padding={props.padding}
      borderRadius={props.borderRadius}
      onCaptionChange={onCaptionChange}
      onEffectChange={onEffectChange}
      onObjectFitChange={onObjectFitChange}
      onPaddingChange={onPaddingChange}
      onBorderRadiusChange={onBorderRadiusChange}
      onDismiss={onDismiss}
    />,
  );
  return {
    onCaptionChange,
    onEffectChange,
    onObjectFitChange,
    onPaddingChange,
    onBorderRadiusChange,
    onDismiss,
    user: userEvent.setup(),
  };
}

const layoutPanel = () => screen.getByRole("group", { name: "Media layout" });

const captionField = () =>
  screen.queryByRole("textbox", { name: "Image caption" });

const backgroundPanel = () => screen.getByRole("group", { name: "Background" });

const slider = (name: string) =>
  within(backgroundPanel()).getByRole("slider", { name });

describe("MediaPropertiesPanel", () => {
  it("gathers both properties under one dialog", () => {
    setup();
    expect(
      screen.getByRole("dialog", { name: "Media properties" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Add caption" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Add background" }),
    ).toBeDefined();
  });

  it("opens the sections whose property the picture already carries", () => {
    setup({ caption: "A note" });
    expect(captionField()).not.toBeNull();
    expect(screen.queryByRole("group", { name: "Background" })).toBeNull();
  });

  it("opens neither for a bare picture", () => {
    setup();
    expect(captionField()).toBeNull();
    expect(screen.queryByRole("group", { name: "Background" })).toBeNull();
  });
});

describe("MediaPropertiesPanel caption section", () => {
  it("adds the section without writing a caption", async () => {
    const { user, onCaptionChange } = setup();
    await user.click(screen.getByRole("button", { name: "Add caption" }));

    expect(captionField()).not.toBeNull();
    expect(onCaptionChange).not.toHaveBeenCalled();
  });

  it("seeds the field with the caption already written", () => {
    setup({ caption: "Existing" });
    expect((captionField() as HTMLTextAreaElement).value).toBe("Existing");
  });

  it("commits as you type, trimmed", async () => {
    const { user, onCaptionChange } = setup({ caption: "" });
    await user.type(captionField()!, "  Hi  ");
    expect(onCaptionChange.mock.calls.at(-1)).toEqual(["Hi"]);
  });

  it("stores an emptied caption as nothing at all, keeping the field", async () => {
    const { user, onCaptionChange } = setup({ caption: "Existing" });
    await user.clear(captionField()!);

    expect(onCaptionChange).toHaveBeenLastCalledWith(undefined);
    expect(captionField()).not.toBeNull();
  });

  it("clears the caption when the section is removed", async () => {
    const { user, onCaptionChange } = setup({ caption: "Existing" });
    await user.click(screen.getByRole("button", { name: "Remove caption" }));

    expect(onCaptionChange).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(captionField()).toBeNull();
  });

  it("comes back empty after being removed and re-added", async () => {
    const { user } = setup({ caption: "Existing" });
    await user.click(screen.getByRole("button", { name: "Remove caption" }));
    await user.click(screen.getByRole("button", { name: "Add caption" }));

    expect((captionField() as HTMLTextAreaElement).value).toBe("");
  });
});

describe("MediaPropertiesPanel background section", () => {
  it("applies the defaults when the section is added", async () => {
    const { user, onEffectChange } = setup();
    await user.click(screen.getByRole("button", { name: "Add background" }));

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith(
      DEFAULT_BACKGROUND_EFFECT,
    );
  });

  it("clears the effect when the section is removed", async () => {
    const { user, onEffectChange } = setup({
      effect: DEFAULT_BACKGROUND_EFFECT,
    });
    await user.click(screen.getByRole("button", { name: "Remove background" }));

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(screen.queryByRole("group", { name: "Background" })).toBeNull();
  });

  it("draws the controls without waiting for the applied effect", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Add background" }));

    expect(slider("Color Count")).toBeDefined();
    expect(slider("Rotation")).toBeDefined();
  });

  it("gives one colour row per colour", () => {
    setup({
      effect: {
        ...DEFAULT_BACKGROUND_EFFECT,
        colors: ["#FFAB6FFF", "#FF4D97FF"],
      },
    });
    expect(
      within(backgroundPanel()).getByRole("textbox", { name: "Color 1" }),
    ).toBeDefined();
    expect(
      within(backgroundPanel()).getByRole("textbox", { name: "Color 2" }),
    ).toBeDefined();
    expect(
      within(backgroundPanel()).queryByRole("textbox", { name: "Color 3" }),
    ).toBeNull();
  });

  it("grows the colour list by repeating the last colour", async () => {
    const { user, onEffectChange } = setup({
      effect: { ...DEFAULT_BACKGROUND_EFFECT, colors: ["#FFAB6FFF"] },
    });
    slider("Color Count").focus();
    await user.keyboard("{ArrowRight}");

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_BACKGROUND_EFFECT,
      colors: ["#FFAB6FFF", "#FFAB6FFF"],
    });
  });

  it("truncates the colour list as the count comes down", async () => {
    const { user, onEffectChange } = setup({
      effect: {
        ...DEFAULT_BACKGROUND_EFFECT,
        colors: ["#FFAB6FFF", "#FF4D97FF"],
      },
    });
    slider("Color Count").focus();
    await user.keyboard("{ArrowLeft}");

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_BACKGROUND_EFFECT,
      colors: ["#FFAB6FFF"],
    });
  });

  it("commits a slider on the change, not on a submit", async () => {
    const { user, onEffectChange } = setup({
      effect: { ...DEFAULT_BACKGROUND_EFFECT, rotation: 90 },
    });
    slider("Rotation").focus();
    await user.keyboard("{ArrowRight}");

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_BACKGROUND_EFFECT,
      rotation: 105,
    });
  });

  it("commits a colour edit on the keystroke", async () => {
    const { user, onEffectChange } = setup({
      effect: { ...DEFAULT_BACKGROUND_EFFECT, colors: ["#FFAB6FFF"] },
    });
    const hex = within(backgroundPanel()).getByRole("textbox", {
      name: "Color 1",
    });
    await user.clear(hex);
    await user.type(hex, "00FF00");

    expect(onEffectChange.mock.calls.at(-1)?.[0].colors).toEqual(["#00FF00FF"]);
  });
});

describe("MediaPropertiesPanel layout section", () => {
  it("stands open with no add/remove control — it is not a property you attach", () => {
    setup();
    expect(layoutPanel()).toBeDefined();
    expect(screen.queryByRole("button", { name: /media layout/i })).toBeNull();
  });

  it("comes before the caption, since it is about the picture itself", () => {
    setup({ caption: "A shot" });
    const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(groups[0]).toBe("Media layout");
  });

  it("starts on Cover for a picture that has never been told otherwise", () => {
    setup();
    const selected = within(layoutPanel())
      .getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected.map((o) => o.textContent)).toEqual(["Cover"]);
  });

  it("shows the fit the picture actually carries", () => {
    setup({ objectFit: "contain" });
    expect(
      within(layoutPanel())
        .getByRole("option", { name: "Contain" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("reports the fit that was picked", async () => {
    const { user, onObjectFitChange } = setup();
    await user.click(within(layoutPanel()).getByRole("option", { name: "Contain" }));
    expect(onObjectFitChange).toHaveBeenCalledExactlyOnceWith("contain");
  });

  it("steps padding by 8, which is the grid the schema stores", async () => {
    const { user, onPaddingChange } = setup({ padding: 16 });
    const track = within(layoutPanel()).getByRole("slider", { name: "Padding" });
    track.focus();
    await user.keyboard("{ArrowRight}");
    expect(onPaddingChange).toHaveBeenCalledExactlyOnceWith(24);
  });

  it("reads a padding-less picture as zero rather than as blank", () => {
    setup();
    const track = within(layoutPanel()).getByRole("slider", { name: "Padding" });
    expect(track.getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("MediaPropertiesPanel radius control", () => {
  it("sits in the layout section alongside the other two", () => {
    setup();
    const rows = within(layoutPanel())
      .getAllByRole("slider")
      .map((s) => s.getAttribute("aria-label") ?? "");
    expect(rows).toHaveLength(2);
  });

  it("steps by 2, which is the grid the schema stores", async () => {
    const { user, onBorderRadiusChange } = setup({ borderRadius: 8 });
    const track = within(layoutPanel()).getAllByRole("slider")[1];
    track.focus();
    await user.keyboard("{ArrowRight}");
    expect(onBorderRadiusChange).toHaveBeenCalledExactlyOnceWith(10);
  });

  it("stops at the roundest corner the system draws", () => {
    setup();
    const track = within(layoutPanel()).getAllByRole("slider")[1];
    expect(track.getAttribute("aria-valuemax")).toBe("20");
  });

  it("reads zero for a picture that has never set a corner", () => {
    setup();
    expect(
      within(layoutPanel()).getAllByRole("slider")[1].getAttribute("aria-valuenow"),
    ).toBe("0");
  });

  it("shows the corner the picture actually carries", () => {
    setup({ borderRadius: 12 });
    expect(
      within(layoutPanel()).getAllByRole("slider")[1].getAttribute("aria-valuenow"),
    ).toBe("12");
  });
});
