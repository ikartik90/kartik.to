// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  createEvent,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "../menu";

afterEach(cleanup);

describe("Menu.Listbox + Menu.Option", () => {
  function setup(query?: string) {
    const onA = vi.fn();
    const onB = vi.fn();
    const onC = vi.fn();
    render(
      <Menu.Listbox query={query} loop>
        <Menu.Option id="a" value="Alpha" onSelect={onA}>
          Alpha
        </Menu.Option>
        <Menu.Option id="b" value="Bravo" onSelect={onB}>
          Bravo
        </Menu.Option>
        <Menu.Option id="c" value="Charlie" onSelect={onC}>
          Charlie
        </Menu.Option>
      </Menu.Listbox>,
    );
    return { onA, onB, onC };
  }

  const options = () => screen.getAllByRole("option");
  const selected = () =>
    options().find((o) => o.getAttribute("aria-selected") === "true")
      ?.textContent;

  it("homes the cursor to the first option and moves with arrows", async () => {
    setup();
    await waitFor(() => expect(selected()).toBe("Alpha"));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(selected()).toBe("Bravo");
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(selected()).toBe("Alpha");
  });

  it("wraps with loop", async () => {
    setup();
    await waitFor(() => expect(selected()).toBe("Alpha"));
    fireEvent.keyDown(document, { key: "ArrowUp" }); // wrap to last
    expect(selected()).toBe("Charlie");
  });

  it("Enter selects the cursor's option", async () => {
    const { onA } = setup();
    await waitFor(() => expect(selected()).toBe("Alpha"));
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onA).toHaveBeenCalledTimes(1);
  });

  it("hover preselects and click selects", () => {
    const { onB } = setup();
    const bravo = screen.getByText("Bravo");
    fireEvent.pointerEnter(bravo);
    expect(bravo.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(bravo);
    expect(onB).toHaveBeenCalledTimes(1);
  });

  it("hides options that do not match the query", () => {
    setup("al"); // only Alpha
    const visible = options();
    expect(visible).toHaveLength(1);
    expect(visible[0].textContent).toBe("Alpha");
  });
});

describe("Menu.Toolbar + Menu.Button + Menu.Group", () => {
  it("renders a pressed toggle and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <Menu.Toolbar>
        <Menu.Button ariaLabel="Bold" pressed onClick={onClick}>
          B
        </Menu.Button>
      </Menu.Toolbar>,
    );
    const btn = screen.getByRole("button", { name: "Bold" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("data-active")).toBe("true");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits aria-pressed for plain action buttons", () => {
    render(
      <Menu.Toolbar>
        <Menu.Button ariaLabel="Reset" onClick={vi.fn()}>
          R
        </Menu.Button>
      </Menu.Toolbar>,
    );
    expect(
      screen.getByRole("button", { name: "Reset" }).getAttribute("aria-pressed"),
    ).toBeNull();
  });

  it("preserves the editor selection on mousedown (preventDefault)", () => {
    render(
      <Menu.Toolbar>
        <Menu.Button ariaLabel="Bold" onClick={vi.fn()}>
          B
        </Menu.Button>
      </Menu.Toolbar>,
    );
    const btn = screen.getByRole("button", { name: "Bold" });
    const ev = createEvent.mouseDown(btn);
    fireEvent(btn, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("renders a group as a divider plus its buttons", () => {
    render(
      <Menu.Toolbar>
        <Menu.Button ariaLabel="Link" onClick={vi.fn()}>
          L
        </Menu.Button>
        <Menu.Group>
          <Menu.Button ariaLabel="Bold" onClick={vi.fn()}>
            B
          </Menu.Button>
        </Menu.Group>
      </Menu.Toolbar>,
    );
    // The divider is aria-hidden; both buttons remain reachable.
    expect(screen.getByRole("button", { name: "Link" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Bold" })).toBeDefined();
  });
});
