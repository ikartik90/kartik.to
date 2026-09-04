// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Button } from "../button";
import { Tooltip } from "../tooltip";

describe("Button", () => {
  afterEach(() => cleanup());

  it("renders a text label", () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  // WebKit's default tab order reaches form fields and anything carrying an
  // explicit tabindex — NOT a bare <button>. Safari users would tab straight
  // past every button on the page, so each one states its own place.
  it("states its own place in the tab order", () => {
    render(<Button aria-label="Save" />);
    // The ATTRIBUTE, not the property: `el.tabIndex` reports a button's
    // default of 0 whether or not it is written down, and what WebKit reads is
    // the attribute.
    expect(
      screen.getByRole("button", { name: "Save" }).getAttribute("tabindex"),
    ).toBe("0");
  });

  it("still yields it to a caller who takes it", () => {
    render(<Button aria-label="Skip" tabIndex={-1} />);
    expect(
      screen.getByRole("button", { name: "Skip" }).getAttribute("tabindex"),
    ).toBe("-1");
  });

  it("renders link variant", () => {
    render(<Button variant="link">browse to upload</Button>);
    expect(
      screen.getByRole("button", { name: "browse to upload" }),
    ).toBeDefined();
  });

  it("renders icon variant with aria-label", () => {
    render(
      <Button variant="icon" aria-label="Close dialog">
        ×
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDefined();
  });

  it("renders a Button.Text label", () => {
    render(
      <Button>
        <svg />
        <Button.Text>Save changes</Button.Text>
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDefined();
  });

  it("blocks click when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Insert Image
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Insert Image" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current?.tagName).toBe("BUTTON");
  });

  describe("emphasis", () => {
    it("defaults a text button to secondary (filled at rest)", () => {
      render(<Button>Save</Button>);
      const cls = screen.getByRole("button", { name: "Save" }).className;
      expect(cls).toContain("emphasis_secondary");
      expect(cls).not.toContain("emphasis_tertiary");
    });

    it("drops the resting fill for a tertiary text button", () => {
      render(<Button emphasis="tertiary">Save</Button>);
      const cls = screen.getByRole("button", { name: "Save" }).className;
      expect(cls).toContain("emphasis_tertiary");
    });

    it("classifies an icon button as tertiary by default", () => {
      render(
        <Button variant="icon" aria-label="Close">
          <svg />
        </Button>,
      );
      const cls = screen.getByRole("button", { name: "Close" }).className;
      expect(cls).toContain("emphasis_tertiary");
    });

    it("lets an explicit emphasis override the inferred default", () => {
      render(
        <Button variant="icon" emphasis="secondary" aria-label="Close">
          <svg />
        </Button>,
      );
      const cls = screen.getByRole("button", { name: "Close" }).className;
      expect(cls).toContain("emphasis_secondary");
      expect(cls).not.toContain("emphasis_tertiary");
    });
  });

  describe("size", () => {
    it("defaults a text button to md (the 40px chip)", () => {
      render(<Button>Save</Button>);
      const cls = screen.getByRole("button", { name: "Save" }).className;
      expect(cls).toContain("size_md");
      expect(cls).not.toContain("size_sm");
    });

    it("takes the 32px chip at size=sm", () => {
      render(<Button size="sm">Save</Button>);
      const cls = screen.getByRole("button", { name: "Save" }).className;
      expect(cls).toContain("size_sm");
      expect(cls).not.toContain("size_md");
    });

    it("keeps the size independent of emphasis", () => {
      render(
        <Button size="sm" emphasis="tertiary">
          Save
        </Button>,
      );
      const cls = screen.getByRole("button", { name: "Save" }).className;
      expect(cls).toContain("size_sm");
      expect(cls).toContain("emphasis_tertiary");
    });
  });

  describe("Button.Tooltip", () => {
    function iconButton() {
      return (
        <Button aria-label="Delete">
          <svg />
          <Button.Tooltip>
            <Tooltip.Text>Delete</Tooltip.Text>
            <svg />
          </Button.Tooltip>
        </Button>
      );
    }

    it("renders the tooltip decoratively, hidden until hover", () => {
      render(iconButton());
      // Accessible name comes from the button, not the aria-hidden tooltip.
      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
      const tip = screen.getByText("Delete").parentElement as HTMLElement;
      expect(tip.getAttribute("aria-hidden")).toBe("true");
      expect(tip.hasAttribute("data-visible")).toBe(false);
    });

    it("reveals the tooltip while the cursor is over the button", () => {
      render(iconButton());
      const btn = screen.getByRole("button", { name: "Delete" });
      const tip = screen.getByText("Delete").parentElement as HTMLElement;

      fireEvent.pointerEnter(btn, {
        pointerType: "mouse",
        clientX: 10,
        clientY: 10,
      });
      expect(tip.hasAttribute("data-visible")).toBe(true);

      fireEvent.pointerLeave(btn, { pointerType: "mouse" });
      expect(tip.hasAttribute("data-visible")).toBe(false);
    });

    // A tap fires `pointerenter` before `pointerdown`, and the mouse events the
    // engine synthesises afterwards fire another — so a hover-triggered label
    // opens ON the tap and stays up until something else is touched.
    it("stays down for a finger, which has no cursor to label", () => {
      render(iconButton());
      const btn = screen.getByRole("button", { name: "Delete" });
      const tip = screen.getByText("Delete").parentElement as HTMLElement;

      fireEvent.pointerEnter(btn, {
        pointerType: "touch",
        clientX: 10,
        clientY: 10,
      });
      // The mouse compatibility events the engine fires after the tap.
      fireEvent.mouseEnter(btn, { clientX: 10, clientY: 10 });
      fireEvent.click(btn);
      expect(tip.hasAttribute("data-visible")).toBe(false);
    });
  });
});
