// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MenuProvider,
  useMenuContext,
  useRegisterItem,
  type MenuItemData,
} from "../menu-context";

afterEach(cleanup);

// --- Test harness ----------------------------------------------------------
// Minimal stand-ins for the eventual Menu.Option / Menu.Button + a probe that
// surfaces the registry's state and controls so specs can drive it. Exercises
// the real hooks — no mocking of the engine under test.

function Item({ id, value, keywords, disabled }: MenuItemData) {
  const { ref, isActive } = useRegisterItem({ id, value, keywords, disabled });
  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isActive}
      data-testid={`item-${id}`}
      data-active={isActive ? "true" : undefined}
      aria-disabled={disabled || undefined}
    >
      {value}
    </div>
  );
}

function Probe() {
  const { activeId, move, setActiveId, getActiveItem, getVisibleItems } =
    useMenuContext();
  return (
    <div>
      <div data-testid="active">{activeId ?? "none"}</div>
      <div data-testid="active-value">{getActiveItem()?.value ?? "none"}</div>
      <div data-testid="visible">
        {getVisibleItems()
          .map((item) => item.id)
          .join(",")}
      </div>
      <button data-testid="down" onClick={() => move(1)}>
        down
      </button>
      <button data-testid="up" onClick={() => move(-1)}>
        up
      </button>
      <button data-testid="hover-b" onClick={() => setActiveId("b")}>
        hover b
      </button>
    </div>
  );
}

interface MenuProps {
  query?: string;
  loop?: boolean;
  autoActivateFirst?: boolean;
  items: MenuItemData[];
}

function renderMenu(props: MenuProps) {
  const ui = (p: MenuProps) => (
    <MenuProvider
      query={p.query}
      loop={p.loop}
      autoActivateFirst={p.autoActivateFirst}
    >
      <Probe />
      {p.items.map((item) => (
        <Item key={item.id} {...item} />
      ))}
    </MenuProvider>
  );
  const utils = render(ui(props));
  return { ...utils, rerender: (next: MenuProps) => utils.rerender(ui(next)) };
}

const abc: MenuItemData[] = [
  { id: "a", value: "Alpha" },
  { id: "b", value: "Bravo" },
  { id: "c", value: "Charlie" },
];

// "Heading" / "Media" contain an 'e'; "Paragraph" does not — used to filter a
// non-adjacent subset so nav must skip a hidden middle item.
const blocks: MenuItemData[] = [
  { id: "heading", value: "Heading" },
  { id: "para", value: "Paragraph" },
  { id: "media", value: "Media", keywords: ["image", "video"] },
];

const active = () => screen.getByTestId("active").textContent;
const visible = () => screen.getByTestId("visible").textContent;

describe("Menu registry — navigation", () => {
  it("moves the cursor through items in DOM order", () => {
    renderMenu({ items: abc });
    expect(active()).toBe("none");
    fireEvent.click(screen.getByTestId("down"));
    expect(active()).toBe("a");
    fireEvent.click(screen.getByTestId("down"));
    expect(active()).toBe("b");
    fireEvent.click(screen.getByTestId("up"));
    expect(active()).toBe("a");
  });

  it("clamps at the ends by default and wraps when loop is set", () => {
    const { rerender } = renderMenu({ items: abc });
    fireEvent.click(screen.getByTestId("down")); // a
    fireEvent.click(screen.getByTestId("down")); // b
    fireEvent.click(screen.getByTestId("down")); // c
    fireEvent.click(screen.getByTestId("down")); // stays c
    expect(active()).toBe("c");

    rerender({ items: abc, loop: true });
    fireEvent.click(screen.getByTestId("down")); // wraps to a
    expect(active()).toBe("a");
  });

  it("skips disabled items during navigation", () => {
    renderMenu({
      items: [
        { id: "a", value: "Alpha" },
        { id: "b", value: "Bravo", disabled: true },
        { id: "c", value: "Charlie" },
      ],
    });
    fireEvent.click(screen.getByTestId("down")); // a
    fireEvent.click(screen.getByTestId("down")); // skips b -> c
    expect(active()).toBe("c");
  });

  it("reflects the cursor on the registered item", () => {
    renderMenu({ items: abc });
    fireEvent.click(screen.getByTestId("down"));
    expect(screen.getByTestId("item-a").getAttribute("data-active")).toBe("true");
    fireEvent.click(screen.getByTestId("down"));
    expect(screen.getByTestId("item-a").getAttribute("data-active")).toBeNull();
    expect(screen.getByTestId("item-b").getAttribute("data-active")).toBe("true");
  });

  it("sets the active item directly (hover-preselect)", () => {
    renderMenu({ items: abc });
    fireEvent.click(screen.getByTestId("hover-b"));
    expect(active()).toBe("b");
  });
});

describe("Menu registry — filtering", () => {
  it("exposes only query-matched items as visible", () => {
    renderMenu({ query: "med", items: blocks });
    expect(visible()).toBe("media");
  });

  it("matches on keywords too", () => {
    renderMenu({ query: "vid", items: blocks });
    expect(visible()).toBe("media");
  });

  it("navigates only visible items, skipping filtered-out ones", () => {
    renderMenu({ query: "e", items: blocks }); // Heading, Media match; Paragraph does not
    expect(visible()).toBe("heading,media");
    fireEvent.click(screen.getByTestId("down")); // heading
    expect(active()).toBe("heading");
    fireEvent.click(screen.getByTestId("down")); // media (para skipped)
    expect(active()).toBe("media");
  });
});

describe("Menu registry — cursor homing", () => {
  it("listbox parks the cursor on the first visible item on mount", async () => {
    renderMenu({ autoActivateFirst: true, items: abc });
    await waitFor(() => expect(active()).toBe("a"));
  });

  it("toolbar starts with no active item", () => {
    renderMenu({ autoActivateFirst: false, items: abc });
    expect(active()).toBe("none");
  });

  it("listbox re-homes to the first visible item when the query changes", async () => {
    const { rerender } = renderMenu({ autoActivateFirst: true, items: blocks });
    await waitFor(() => expect(active()).toBe("heading"));
    fireEvent.click(screen.getByTestId("down")); // para
    expect(active()).toBe("para");
    rerender({ autoActivateFirst: true, items: blocks, query: "med" });
    await waitFor(() => expect(active()).toBe("media"));
  });

  it("drops an orphaned cursor when the active item is filtered away (toolbar)", async () => {
    const { rerender } = renderMenu({ items: abc });
    fireEvent.click(screen.getByTestId("hover-b"));
    expect(active()).toBe("b");
    rerender({ items: abc, query: "alph" }); // only Alpha remains
    await waitFor(() => expect(active()).toBe("none"));
  });
});

describe("Menu registry — active item resolution", () => {
  it("resolves the active item for selection (the Enter target)", () => {
    renderMenu({ items: abc });
    fireEvent.click(screen.getByTestId("down")); // a
    expect(screen.getByTestId("active-value").textContent).toBe("Alpha");
  });

  it("resolves to none when nothing is active", () => {
    renderMenu({ items: abc });
    expect(screen.getByTestId("active-value").textContent).toBe("none");
  });
});

describe("Menu registry — dynamic items", () => {
  it("stops navigating to items that unmount", () => {
    const { rerender } = renderMenu({ items: abc });
    rerender({
      items: [
        { id: "a", value: "Alpha" },
        { id: "c", value: "Charlie" },
      ],
    });
    expect(visible()).toBe("a,c");
    fireEvent.click(screen.getByTestId("down")); // a
    fireEvent.click(screen.getByTestId("down")); // c (b gone)
    expect(active()).toBe("c");
  });

  it("visits a newly-inserted item in DOM order", () => {
    const { rerender } = renderMenu({
      items: [
        { id: "a", value: "Alpha" },
        { id: "c", value: "Charlie" },
      ],
    });
    rerender({ items: abc }); // inserts b between a and c
    expect(visible()).toBe("a,b,c");
    fireEvent.click(screen.getByTestId("down")); // a
    fireEvent.click(screen.getByTestId("down")); // b
    expect(active()).toBe("b");
  });
});
