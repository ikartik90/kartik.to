import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { css } from "../../../../../styled-system/css";
import { Button, Link, iconButtonStyle, smallButtonStyle } from "../ui";

afterEach(cleanup);

const button = () => screen.getByRole<HTMLButtonElement>("button");

describe("Button", () => {
  it("is Figma's Large Primary, Affirmative, by default", () => {
    render(<Button>Save</Button>);
    expect(button().className).toContain(css({ height: "2.75rem" }));
    expect(button().className).not.toBe(smallButtonStyle);
    expect(button().getAttribute("data-emphasis")).toBe("primary");
    expect(button().hasAttribute("data-tone")).toBe(false);
  });

  it("takes the small button's style at size small", () => {
    render(<Button size="small">Save</Button>);
    expect(button().className.endsWith(` ${smallButtonStyle}`)).toBe(true);
  });

  it("names its emphasis and tone in data attributes, not classes", () => {
    render(<Button size="small">Save</Button>);
    const plain = button().className;
    cleanup();
    render(
      <Button size="small" emphasis="tertiary" tone="destructive">
        Save
      </Button>,
    );
    expect(button().className).toBe(plain);
    expect(button().getAttribute("data-emphasis")).toBe("tertiary");
    expect(button().getAttribute("data-tone")).toBe("destructive");
  });

  it("adds a caller's class after its own", () => {
    render(
      <Button size="small" className="extra">
        Save
      </Button>,
    );
    expect(button().className.endsWith(` ${smallButtonStyle} extra`)).toBe(true);
  });

  it("is a plain button unless told otherwise", () => {
    render(<Button>Save</Button>);
    expect(button().getAttribute("type")).toBe("button");
    cleanup();
    render(<Button type="submit">Save</Button>);
    expect(button().getAttribute("type")).toBe("submit");
  });

  it("passes native props and its ref through", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} aria-expanded="true" data-tour="open" title="Open" onClick={onClick}>
        Save
      </Button>,
    );
    expect(ref.current).toBe(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(button().getAttribute("data-tour")).toBe("open");
    expect(button().title).toBe("Open");
    await userEvent.click(button());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can be disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    expect(button().disabled).toBe(true);
    await userEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Button at size icon", () => {
  it("takes the icon button's style, Affirmative by default", () => {
    render(<Button size="icon" aria-label="Edit" />);
    expect(button().className.endsWith(` ${iconButtonStyle}`)).toBe(true);
    expect(button().hasAttribute("data-tone")).toBe(false);
    expect(button().hasAttribute("data-emphasis")).toBe(false);
  });

  it("names its tone in a data attribute", () => {
    render(<Button size="icon" aria-label="Delete" tone="destructive" />);
    expect(button().className.endsWith(` ${iconButtonStyle}`)).toBe(true);
    expect(button().getAttribute("data-tone")).toBe("destructive");
  });

  it("adds a caller's class after its own", () => {
    render(<Button size="icon" aria-label="Edit" className="extra" />);
    expect(button().className.endsWith(` ${iconButtonStyle} extra`)).toBe(true);
  });

  it("is a plain button unless told otherwise", () => {
    render(<Button size="icon" aria-label="Edit" />);
    expect(button().getAttribute("type")).toBe("button");
    cleanup();
    render(<Button size="icon" aria-label="Edit" type="submit" />);
    expect(button().getAttribute("type")).toBe("submit");
  });

  it("passes native props and its ref through", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(<Button size="icon" ref={ref} aria-label="Edit" data-bare="" disabled={false} onClick={onClick} />);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Edit" }));
    expect(button().getAttribute("data-bare")).toBe("");
    await userEvent.click(button());
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Link", () => {
  it("takes the link's style, with no data attributes of its own", () => {
    render(<Link>Show more</Link>);
    expect(button().className).toContain(css({ color: "var(--sw-glyph-link-primary-default)" }));
    expect(button().className).not.toBe(smallButtonStyle);
    const own = button().getAttributeNames().filter((name) => name.startsWith("data-") && name !== "data-typography");
    expect(own).toEqual([]);
  });

  it("adds a caller's class after its own", () => {
    render(<Link>Show more</Link>);
    const plain = button().className;
    cleanup();
    render(<Link className="extra">Show more</Link>);
    expect(button().className).toBe(`${plain} extra`);
  });

  it("is a plain button unless told otherwise", () => {
    render(<Link>Show more</Link>);
    expect(button().getAttribute("type")).toBe("button");
    cleanup();
    render(<Link type="submit">Show more</Link>);
    expect(button().getAttribute("type")).toBe("submit");
  });

  it("passes native props and its ref through", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Link ref={ref} aria-expanded="false" disabled onClick={onClick}>
        View location
      </Link>,
    );
    expect(ref.current).toBe(button());
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(button().disabled).toBe(true);
    await userEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });
});
