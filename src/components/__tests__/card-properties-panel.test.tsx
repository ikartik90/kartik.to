// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardPropertiesPanel } from "../card-properties-panel";
import type { LinkCardConfig } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";
import type { PostCardConfig } from "@/domain/post";

afterEach(cleanup);

const logPanel = () => screen.queryByRole("group", { name: "Log output" });

describe("CardPropertiesPanel", () => {
  it("gathers the card's properties under one dialog", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Card properties" }),
    ).toBeDefined();
  });

  it("offers no log control to a card that cannot log", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(logPanel()).toBeNull();
  });

  it("says so when the card has no properties yet", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(screen.getByText(/no properties/i)).toBeDefined();
  });

  it("offers show and hide to a card that logs", () => {
    render(
      <CardPropertiesPanel
        logger={{ shown: true, onShownChange: vi.fn() }}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      within(logPanel()!)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Show", "Hide"]);
    expect(screen.queryByText(/no properties/i)).toBeNull();
  });

  it("reads the state the card is in", () => {
    render(
      <CardPropertiesPanel
        logger={{ shown: false, onShownChange: vi.fn() }}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      within(logPanel()!)
        .getByRole("option", { name: "Hide" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("hides the log output on the press", async () => {
    const user = userEvent.setup();
    const onShownChange = vi.fn();
    render(
      <CardPropertiesPanel
        logger={{ shown: true, onShownChange }}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(within(logPanel()!).getByRole("option", { name: "Hide" }));
    expect(onShownChange).toHaveBeenCalledWith(false);
  });

  it("shows the log output again on the press back", async () => {
    const user = userEvent.setup();
    const onShownChange = vi.fn();
    render(
      <CardPropertiesPanel
        logger={{ shown: false, onShownChange }}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(within(logPanel()!).getByRole("option", { name: "Show" }));
    expect(onShownChange).toHaveBeenCalledWith(true);
  });
});

const linkCardProps = (config: LinkCardConfig = {}) => ({
  config,
  onChange: vi.fn(),
  onPickMedia: vi.fn(),
  onPickDocument: vi.fn(),
});

const section = (name: string) => screen.queryByRole("group", { name });

const image = (src: string): MediaNode => ({ type: "media", kind: "image", src });

describe("CardPropertiesPanel — link card", () => {
  it("offers none of it to a card that is not a link card", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(screen.queryByText("Media")).toBeNull();
    expect(screen.queryByText("Link")).toBeNull();
  });

  it("gathers the card's three sections under the one panel", () => {
    render(
      <CardPropertiesPanel linkCard={linkCardProps()} onDismiss={vi.fn()} />,
    );
    for (const name of ["Media", "Content", "Link"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.queryByText(/no properties/i)).toBeNull();
  });

  it("opens the sections the card actually carries", () => {
    render(
      <CardPropertiesPanel
        linkCard={linkCardProps({ media: { light: image("/a.png") } })}
        onDismiss={vi.fn()}
      />,
    );
    expect(section("Media")).toBeTruthy();
    expect(section("Content")).toBeNull();
    expect(section("Link")).toBeNull();
  });

  describe("media", () => {
    it("offers a picture per theme", async () => {
      const user = userEvent.setup();
      const props = linkCardProps();
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Add media" }));

      expect(
        within(section("Media")!)
          .getAllByRole("button")
          .map((b) => b.getAttribute("aria-label")),
      ).toEqual(["Add light media", "Add dark media"]);
    });

    it("asks for the library rather than opening it", async () => {
      const user = userEvent.setup();
      const props = linkCardProps({ media: {} });
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Add dark media" }));
      expect(props.onPickMedia).toHaveBeenCalledWith("dark");
    });

    it("names the file each slot is holding", () => {
      render(
        <CardPropertiesPanel
          linkCard={linkCardProps({
            media: { light: image("https://cdn.test/media/uuid-shader.png") },
          })}
          onDismiss={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Change light media" }).textContent,
      ).toContain("shader.png");
    });

    it("offers to replace a filled slot, never to clear it", async () => {
      const user = userEvent.setup();
      const props = linkCardProps({
        media: { light: image("/light.png"), dark: image("/dark.png") },
      });
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);

      expect(
        within(section("Media")!)
          .getAllByRole("button")
          .map((b) => b.getAttribute("aria-label")),
      ).toEqual([
        "Change light media",
        "Replace light media",
        "Change dark media",
        "Replace dark media",
      ]);

      await user.click(
        screen.getByRole("button", { name: "Replace dark media" }),
      );
      expect(props.onPickMedia).toHaveBeenCalledWith("dark");
    });


    it("takes the whole section away, and both pictures with it", async () => {
      const user = userEvent.setup();
      const props = linkCardProps({ media: { light: image("/light.png") } });
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Remove media" }));
      expect(props.onChange).toHaveBeenCalledWith({});
    });
  });

  describe("content", () => {
    const open = (config: LinkCardConfig = { content: {} }) => {
      const props = linkCardProps(config);
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      return props;
    };

    it("writes the title as it is typed", async () => {
      const user = userEvent.setup();
      const props = open();
      await user.type(screen.getByLabelText("Title"), "S");
      expect(props.onChange).toHaveBeenCalledWith({
        content: { title: "S" },
      });
    });

    it("writes the meta line above it", async () => {
      const user = userEvent.setup();
      const props = open();
      await user.type(screen.getByLabelText("Meta"), "P");
      expect(props.onChange).toHaveBeenCalledWith({ content: { meta: "P" } });
    });

    it("grounds the words on a scrim", async () => {
      const user = userEvent.setup();
      const props = open();
      await user.click(screen.getByRole("switch", { name: "Scrim" }));
      expect(props.onChange).toHaveBeenCalledWith({
        content: { scrim: true },
      });
    });

    it("offers the reader's theme as well as the two pinned ones", () => {
      open();
      expect(
        within(screen.getByRole("group", { name: "Content" }))
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual(["Auto", "Light", "Dark"]);
    });

    it("pins the tone to the picture under it", async () => {
      const user = userEvent.setup();
      const props = open();
      await user.click(screen.getByRole("option", { name: "Dark" }));
      expect(props.onChange).toHaveBeenCalledWith({ content: { tone: "dark" } });
    });

    it("hands the words back to the reader's theme", async () => {
      const user = userEvent.setup();
      const props = open({ content: { tone: "dark" } });
      await user.click(screen.getByRole("option", { name: "Auto" }));
      expect(props.onChange).toHaveBeenCalledWith({ content: {} });
    });
  });

  describe("link", () => {
    const open = (config: LinkCardConfig) => {
      const props = linkCardProps(config);
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      return props;
    };

    it("offers the three sorts of destination", () => {
      open({ link: { kind: "internal" } });
      expect(
        within(screen.getByRole("group", { name: "Link" }))
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual([
        "Internal",
        "External",
        "Document",
        "Shader Playground",
        "Calchemy Playground",
        "Icons Playground",
      ]);
    });

    it("drops the destination when the sort of link changes", async () => {
      const user = userEvent.setup();
      const props = open({
        link: { kind: "external", href: "https://example.com", newTab: true },
      });
      await user.click(screen.getByRole("option", { name: "Internal" }));
      expect(props.onChange).toHaveBeenCalledWith({
        link: { kind: "internal", newTab: true },
      });
    });

    it("points an internal card at a page of this site", async () => {
      const user = userEvent.setup();
      const props = open({ link: { kind: "internal" } });
      await user.click(screen.getByRole("option", { name: "Shader Playground" }));
      expect(props.onChange).toHaveBeenCalledWith({
        link: { kind: "internal", href: "/playground/shader" },
      });
    });

    it("takes a typed URL for an external card", async () => {
      const user = userEvent.setup();
      const props = open({ link: { kind: "external" } });
      await user.type(screen.getByLabelText("URL"), "h");
      expect(props.onChange).toHaveBeenCalledWith({
        link: { kind: "external", href: "h" },
      });
    });

    it("asks for the document library rather than opening it", async () => {
      const user = userEvent.setup();
      const props = open({ link: { kind: "document" } });
      await user.click(screen.getByRole("button", { name: "Add document" }));
      expect(props.onPickDocument).toHaveBeenCalled();
    });

    it("names the document it is pointing at", () => {
      open({
        link: { kind: "document", href: "https://cdn.test/media/uuid-cv.pdf" },
      });
      expect(
        screen.getByRole("button", { name: "Change document" }).textContent,
      ).toContain("cv.pdf");
    });

    it("opens the card away from here", async () => {
      const user = userEvent.setup();
      const props = open({ link: { kind: "internal", href: "/playground/shader" } });
      await user.click(screen.getByRole("switch", { name: "New Tab" }));
      expect(props.onChange).toHaveBeenCalledWith({
        link: { kind: "internal", href: "/playground/shader", newTab: true },
      });
    });

    it("takes the whole destination away with the section", async () => {
      const user = userEvent.setup();
      const props = open({
        content: { title: "Shader" },
        link: { kind: "internal", href: "/playground/shader" },
      });
      await user.click(screen.getByRole("button", { name: "Remove link" }));
      expect(props.onChange).toHaveBeenCalledWith({
        content: { title: "Shader" },
      });
    });
  });
});

describe("CardPropertiesPanel — the scrim's default", () => {
  const scrimSwitch = () => screen.getByRole("switch", { name: "Scrim" });
  const pictured = { media: { light: image("/a.png") } };

  it("opens on for a card with a picture and no stored value", () => {
    render(
      <CardPropertiesPanel
        linkCard={linkCardProps({ ...pictured, content: {} })}
        onDismiss={vi.fn()}
      />,
    );
    expect(scrimSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("opens off for a card with no picture", () => {
    render(
      <CardPropertiesPanel
        linkCard={linkCardProps({ content: {} })}
        onDismiss={vi.fn()}
      />,
    );
    expect(scrimSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("reads a stored value over the default", () => {
    render(
      <CardPropertiesPanel
        linkCard={linkCardProps({ ...pictured, content: { scrim: false } })}
        onDismiss={vi.fn()}
      />,
    );
    expect(scrimSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("writes a definite off when turned off over a picture", async () => {
    const user = userEvent.setup();
    const props = linkCardProps({ ...pictured, content: {} });
    render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
    await user.click(scrimSwitch());
    expect(props.onChange).toHaveBeenCalledWith({
      ...pictured,
      content: { scrim: false },
    });
  });
});

const postCardProps = (
  config: PostCardConfig = {},
  cover: MediaNode | null = null,
  meta: string | null = null,
) => ({
  config,
  cover,
  meta,
  onChange: vi.fn(),
  onPickMedia: vi.fn(),
});

describe("CardPropertiesPanel — post card", () => {
  const scrimSwitch = () => screen.getByRole("switch", { name: "Scrim" });
  const first = image("https://cdn.test/media/uuid-first.png");

  it("offers the picture, the ground and the one line the post leaves open", () => {
    render(<CardPropertiesPanel postCard={postCardProps()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Media")).toBeTruthy();
    expect(scrimSwitch()).toBeTruthy();
    expect(screen.getByLabelText("Meta")).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.queryByText("Link")).toBeNull();
    expect(screen.queryByText(/no properties/i)).toBeNull();
  });

  it("leaves the meta line alone on a card the post already files", () => {
    render(
      <CardPropertiesPanel
        postCard={postCardProps({}, null, "Jan 1, 2026")}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Meta")).toBeNull();
    expect(scrimSwitch()).toBeTruthy();
  });

  it("writes the meta line beside the scrim, not under a content key", async () => {
    const user = userEvent.setup();
    const props = postCardProps();
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.type(screen.getByLabelText("Meta"), "C");
    expect(props.onChange).toHaveBeenCalledWith({ meta: "C" });
  });

  it("drops the line rather than storing an empty one", async () => {
    const user = userEvent.setup();
    const props = postCardProps({ meta: "Case Study" });
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.clear(screen.getByLabelText("Meta"));
    expect(props.onChange).toHaveBeenCalledWith({});
  });

  it("starts the media from the document's picture when opened", async () => {
    const user = userEvent.setup();
    const props = postCardProps({}, first);
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add media" }));
    expect(props.onChange).toHaveBeenCalledWith({ media: { light: first } });
  });

  it("starts the media empty for a post with no picture in it", async () => {
    const user = userEvent.setup();
    const props = postCardProps({}, null);
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add media" }));
    expect(props.onChange).toHaveBeenCalledWith({ media: {} });
  });

  it("names the file each slot is holding", () => {
    render(
      <CardPropertiesPanel
        postCard={postCardProps({ media: { light: first } })}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Change light media" }).textContent,
    ).toContain("first.png");
  });

  it("asks for the library for the slot pressed", async () => {
    const user = userEvent.setup();
    const props = postCardProps({ media: {} });
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add dark media" }));
    expect(props.onPickMedia).toHaveBeenCalledWith("dark");
  });

  it("offers to replace a filled slot, never to clear it", async () => {
    const user = userEvent.setup();
    const props = postCardProps({
      media: { light: first, dark: image("/dark.png") },
    });
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Remove light media" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Replace light media" }),
    );
    expect(props.onPickMedia).toHaveBeenCalledWith("light");
  });


  it("hands the picture back to the document when the section goes", async () => {
    const user = userEvent.setup();
    const props = postCardProps({ media: { light: first }, scrim: false });
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Remove media" }));
    expect(props.onChange).toHaveBeenCalledWith({ scrim: false });
  });

  it("reads the scrim's default off the derived picture", () => {
    render(
      <CardPropertiesPanel postCard={postCardProps({}, first)} onDismiss={vi.fn()} />,
    );
    expect(scrimSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("opens the scrim off for a post with no picture anywhere", () => {
    render(<CardPropertiesPanel postCard={postCardProps()} onDismiss={vi.fn()} />);
    expect(scrimSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("writes the scrim beside the media, not under a content key", async () => {
    const user = userEvent.setup();
    const props = postCardProps({}, first);
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(scrimSwitch());
    expect(props.onChange).toHaveBeenCalledWith({ scrim: false });
  });

  it("offers the reader's theme as well as the two pinned ones", () => {
    render(<CardPropertiesPanel postCard={postCardProps()} onDismiss={vi.fn()} />);
    expect(
      screen.getAllByRole("option").map((o) => o.textContent),
    ).toEqual(["Auto", "Light", "Dark"]);
  });

  it("pins the tone to the picture under it", async () => {
    const user = userEvent.setup();
    const props = postCardProps();
    render(<CardPropertiesPanel postCard={props} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("option", { name: "Dark" }));
    expect(props.onChange).toHaveBeenCalledWith({ tone: "dark" });
  });
});
