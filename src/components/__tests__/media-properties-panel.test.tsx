import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type BackgroundEffect,
} from "@/domain/nodes";
import { MediaPropertiesPanel } from "../media-properties-panel";

afterEach(() => cleanup());

function setup(
  props: Partial<{
    caption: string | undefined;
    effect: BackgroundEffect | undefined;
  }> = {},
) {
  const onCaptionChange = vi.fn();
  const onEffectChange = vi.fn();
  const onDismiss = vi.fn();
  render(
    <MediaPropertiesPanel
      caption={props.caption}
      effect={props.effect}
      onCaptionChange={onCaptionChange}
      onEffectChange={onEffectChange}
      onDismiss={onDismiss}
    />,
  );
  return {
    onCaptionChange,
    onEffectChange,
    onDismiss,
    user: userEvent.setup(),
  };
}

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

  // Which sections stand open is read off the picture: a panel that opened
  // everything would bury the one property that is actually set.
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
  // Opening the section is not itself a caption — there is nothing yet to
  // store, and emitting an empty one would mark the picture as captioned.
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

  // Emptying the field is not the same as removing the section: the field has
  // to stay to be typed in again, so what goes is only the stored value.
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

  // The draft goes with it, or re-adding the section would hand back the text
  // that removing it had just thrown away.
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

  // The controls draw on the defaults rather than waiting for the effect to
  // come back from the parent — a round trip that a purely observing consumer
  // would never complete.
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

  // A new stop the same as its neighbour is invisible until you edit it; a
  // black one would drop a hole into the gradient mid-tune.
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

  // Live, not a form: the gradient behind the picture is always exactly what
  // the panel says, so there is no apply step to forget.
  it("commits a slider on the change, not on a submit", async () => {
    const { user, onEffectChange } = setup({
      effect: { ...DEFAULT_BACKGROUND_EFFECT, rotation: 90 },
    });
    slider("Rotation").focus();
    await user.keyboard("{ArrowRight}");

    expect(onEffectChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_BACKGROUND_EFFECT,
      rotation: 91,
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
