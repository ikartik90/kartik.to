// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardPropertiesPanel } from "../card-properties-panel";
import type { LinkCardConfig } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";

afterEach(cleanup);

const logPanel = () => screen.queryByRole("group", { name: "Log output" });

describe("CardPropertiesPanel", () => {
  it("gathers the card's properties under one dialog", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Card properties" }),
    ).toBeDefined();
  });

  // A post, or a demo the registry does not log: there is nothing to show or
  // hide, and a control that only ever says "Hide" over a card with no log
  // output would be describing something that is not there.
  it("offers no log control to a card that cannot log", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(logPanel()).toBeNull();
  });

  // The panel opens on every card, including the ones whose properties are
  // still to be specified — so the near-empty state has to SAY it is empty
  // rather than looking like a panel that failed to load.
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

  // The control reports the card's CURRENT state, so a demo whose panel is
  // already hidden opens on "Hide" rather than on the registry's default.
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

  // Live, like every control in the media panel: there is no apply step, so
  // what is on the card is always what the panel says.
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

// ---------------------------------------------------------------------------
// The link card's three sections.
//
// A link card is the one published component that has no code of its own to
// speak for it: it is a picture, some words and a destination, and all three
// are authored here. So this is the only card whose panel is the card.
//
// Live like every other control in the app's inspectors — there is no apply
// step, and the tile behind the rail always shows what the rail says. What the
// panel hands back is the WHOLE configuration each time, because a section that
// has been removed has to arrive as an absent key; a partial patch could never
// clear anything.
// ---------------------------------------------------------------------------

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
    // It has properties now, so the stand-in note has nothing to stand in for.
    expect(screen.queryByText(/no properties/i)).toBeNull();
  });

  // A SECTION IS THE PROPERTY, the rule the media panel's header states: a
  // section that is closed is a property the card does not have, so opening one
  // on a card whose configuration is empty must not already be open.
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

    // The rail emits the intent and the GRID owns the dialog: the panel is
    // portalled and fixed, and a modal opened from inside it would be a second
    // surface fighting the first for the dismiss.
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

    it("clears one theme's picture without touching the other", async () => {
      const user = userEvent.setup();
      const props = linkCardProps({
        media: { light: image("/light.png"), dark: image("/dark.png") },
      });
      render(<CardPropertiesPanel linkCard={props} onDismiss={vi.fn()} />);
      await user.click(
        screen.getByRole("button", { name: "Remove dark media" }),
      );
      expect(props.onChange).toHaveBeenCalledWith({
        media: { light: image("/light.png") },
      });
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

    // Auto is the default and a real choice, not the absence of one: a post's
    // tile follows the reader's theme, and a link card should be able to as
    // well. Light and Dark pin the band to the picture under it.
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
      ).toEqual(["Internal", "External", "Document", "Shader Playground", "Calchemy Playground"]);
    });

    // Changing the sort of link drops the destination with it: a URL is not a
    // path, and carrying one across would leave the card pointing somewhere the
    // new control cannot even display.
    it("drops the destination when the sort of link changes", async () => {
      const user = userEvent.setup();
      const props = open({
        link: { kind: "external", href: "https://example.com", newTab: true },
      });
      await user.click(screen.getByRole("option", { name: "Internal" }));
      expect(props.onChange).toHaveBeenCalledWith({
        // The switch is about the card, not about the destination, so it stays.
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
      // The words stay — removing a section removes THAT property and no other.
      expect(props.onChange).toHaveBeenCalledWith({
        content: { title: "Shader" },
      });
    });
  });
});
