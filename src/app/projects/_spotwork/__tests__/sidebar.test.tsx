import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar, useSidebar } from "../sidebar";
import { Avatar } from "../data-table";
import { Button, Typography, glyph } from "../ui";

afterEach(cleanup);

describe("a sidebar", () => {
  it("is a labelled navigation, its groups' heads and items side by side in it", () => {
    render(
      <Sidebar label="Main">
        <Sidebar.Item><Typography variant="bodyLarge">Check-ins</Typography></Sidebar.Item>
        <Sidebar.Group>
          <Typography tag="div" variant="metadataStrong" className={glyph.subdued}>
            Admin
          </Typography>
          <Sidebar.Item><Typography variant="bodyLarge">Cancellations</Typography></Sidebar.Item>
          <Sidebar.Item><Typography variant="bodyLarge">Verifications</Typography></Sidebar.Item>
        </Sidebar.Group>
      </Sidebar>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    const items = nav.firstElementChild!.children;
    expect([...items].map((child) => child.textContent)).toEqual([
      "Check-ins",
      "Admin",
      "Cancellations",
      "Verifications",
    ]);
    expect(items[1].tagName).toBe("DIV");
    expect(items[1].className).toContain(glyph.subdued);
    expect(within(nav).queryAllByRole("option")).toEqual([]);
    expect(nav.hasAttribute("inert")).toBe(false);
    expect(nav.hasAttribute("data-state")).toBe(false);
  });

  it("draws a placeholder item in its place as a faded skeleton of itself, out of reach", () => {
    render(
      <Sidebar label="Main">
        <Sidebar.Item><Typography variant="body">Check-ins</Typography></Sidebar.Item>
        <Sidebar.Item placeholder><Typography variant="body">Shifts</Typography></Sidebar.Item>
      </Sidebar>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((item) => item.textContent)).toEqual(["Check-ins"]);
    const items = nav.firstElementChild!.children;
    expect([...items].map((child) => child.textContent)).toEqual(["Check-ins", "Shifts"]);
    expect(items[1].hasAttribute("inert")).toBe(true);
    expect(items[1].querySelector("[data-typography] [data-skeleton]")?.textContent).toBe("Shifts");
  });

  it("holds its current item when not given one, from its default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Sidebar label="Main" defaultValue="Timesheets" onChange={onChange}>
        <Sidebar.Item value="Shifts"><Typography variant="bodyLarge">Shifts</Typography></Sidebar.Item>
        <Sidebar.Group>
          <Typography tag="div" variant="metadataStrong">
            Admin
          </Typography>
          <Sidebar.Item value="Timesheets"><Typography variant="bodyLarge">Timesheets</Typography></Sidebar.Item>
        </Sidebar.Group>
      </Sidebar>,
    );
    const current = () =>
      screen.getAllByRole("button").filter((item) => item.getAttribute("aria-current") === "page").map((item) => item.textContent);
    expect(current()).toEqual(["Timesheets"]);
    await user.click(screen.getByRole("button", { name: "Shifts" }));
    expect(current()).toEqual(["Shifts"]);
    expect(onChange).toHaveBeenCalledWith("Shifts");
  });

  it("opens and shuts as its provider holds it, from its default", () => {
    function Toggle() {
      const { open, setOpen } = useSidebar()!;
      return <button onClick={() => setOpen(!open)}>Toggle</button>;
    }
    render(
      <Sidebar.Provider defaultOpen={false}>
        <Toggle />
        <Sidebar label="Main" />
      </Sidebar.Provider>,
    );
    const nav = () => screen.getByRole("navigation", { hidden: true });
    expect(nav().getAttribute("data-state")).toBe("closed");
    expect(nav().id).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(nav().getAttribute("data-state")).toBe("open");
  });

  it("slides shut and out of reach when closed, and floats over the page", () => {
    const { rerender } = render(<Sidebar label="Main" open floating id="nav" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.getAttribute("data-state")).toBe("open");
    expect(nav.hasAttribute("inert")).toBe(false);
    expect(nav.hasAttribute("data-floating")).toBe(true);
    expect(nav.id).toBe("nav");
    rerender(<Sidebar label="Main" open={false} />);
    expect(screen.getByRole("navigation", { hidden: true }).getAttribute("data-state")).toBe("closed");
    expect(screen.getByRole("navigation", { hidden: true }).hasAttribute("inert")).toBe(true);
  });

  it("shuts to a rail of its items, still in reach, when it keeps one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Sidebar label="Main" open={false} rail onChange={onChange}>
        <Sidebar.Item value="Shifts"><Typography variant="body">Shifts</Typography></Sidebar.Item>
      </Sidebar>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.getAttribute("data-state")).toBe("closed");
    expect(nav.hasAttribute("data-rail")).toBe(true);
    expect(nav.hasAttribute("inert")).toBe(false);
    await user.click(within(nav).getByRole("button", { name: "Shifts" }));
    expect(onChange).toHaveBeenCalledWith("Shifts");
  });
});

describe("a sidebar's footer", () => {
  it("sits under its items, its own items actions that never become the current page, then the account", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBell = vi.fn();
    render(
      <Sidebar label="Main" onChange={onChange}>
        <Sidebar.Item value="Shifts"><Typography variant="body">Shifts</Typography></Sidebar.Item>
        <Sidebar.Footer>
          <Sidebar.Item onClick={onBell}>
            <svg data-icon="" />
            <Typography variant="body">Notifications</Typography>
          </Sidebar.Item>
          <Sidebar.Account>
            <Avatar>JP</Avatar>
            <Typography variant="body">Jesse Pereira</Typography>
            <Button size="icon" aria-label="Profile settings"><svg data-icon="" /></Button>
          </Sidebar.Account>
        </Sidebar.Footer>
      </Sidebar>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect([...nav.children].map((child) => child.textContent)).toEqual(["Shifts", "NotificationsJPJesse Pereira"]);
    const bell = within(nav).getByRole("button", { name: "Notifications" });
    await user.click(bell);
    expect(onBell).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(bell.hasAttribute("aria-current")).toBe(false);
    expect(within(nav).getByRole("button", { name: "Profile settings" })).toBeDefined();
  });

  it("holds its account only in a footer, and its footer only in a sidebar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Sidebar label="Main"><Sidebar.Account><Avatar>JP</Avatar></Sidebar.Account></Sidebar>)).toThrow(
      "Sidebar.Account must be used inside Sidebar.Footer",
    );
    expect(() => render(<Sidebar.Footer />)).toThrow("Sidebar.Footer must be used inside Sidebar");
    vi.restoreAllMocks();
  });
});

describe("a sidebar's switcher", () => {
  function setup(props: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
    const user = userEvent.setup();
    render(
      <Sidebar label="Main">
        <Sidebar.Item value="Shifts"><Typography variant="body">Shifts</Typography></Sidebar.Item>
        <Sidebar.Switcher label="Switch team" {...props}>
          <Avatar type="company" />
          <Typography variant="body">CCLS First Gulf</Typography>
          <button type="button">CCLS Derwent</button>
        </Sidebar.Switcher>
      </Sidebar>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    return { user, nav, switcher: within(nav).getByRole("button", { name: "CCLS First Gulf" }) };
  }

  it("heads the sidebar over its items, its avatar and words with a chevron after them", () => {
    const { nav, switcher } = setup();
    expect([...nav.children].map((child) => child.textContent)).toEqual(["CCLS First Gulf", "Shifts"]);
    const [avatar, words, chevron, ...rest] = switcher.children;
    expect(avatar.querySelector("[data-avatar]")).not.toBeNull();
    expect(words.textContent).toBe("CCLS First Gulf");
    expect(chevron.hasAttribute("data-chevron")).toBe(true);
    expect(rest).toEqual([]);
    expect(switcher.getAttribute("aria-haspopup")).toBe("dialog");
    expect(switcher.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens what it holds in a popover beside the sidebar, which Escape, a press outside or the switcher closes", async () => {
    const { user, nav, switcher } = setup();
    await user.click(switcher);
    expect(switcher.getAttribute("aria-expanded")).toBe("true");
    const popover = screen.getByRole("dialog", { name: "Switch team" });
    expect(nav.contains(popover)).toBe(false);
    expect(document.activeElement).toBe(within(popover).getByRole("button", { name: "CCLS Derwent" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(switcher);
    await user.click(within(nav).getByRole("button", { name: "Shifts" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(switcher);
    await user.click(switcher);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays as its caller holds it, telling it when it would open or close", async () => {
    const onOpenChange = vi.fn();
    const { user, switcher } = setup({ open: true, onOpenChange });
    expect(screen.getByRole("dialog", { name: "Switch team" })).toBeDefined();
    await user.click(switcher);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog", { name: "Switch team" })).toBeDefined();
  });

  it("sits only in a sidebar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Sidebar.Switcher label="Switch team"><Avatar type="company" /></Sidebar.Switcher>)).toThrow(
      "Sidebar.Switcher must be used inside Sidebar",
    );
    vi.restoreAllMocks();
  });
});

describe("a sidebar's list item", () => {
  it("is a button marked as the current page while selected, with no chevron", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Sidebar label="Main">
        <Sidebar.Item selected onClick={onClick}>
          <svg data-icon="" />
          <Typography variant="body">Timesheets</Typography>
        </Sidebar.Item>
      </Sidebar>,
    );
    const item = within(screen.getByRole("navigation")).getByRole("button", { name: "Timesheets" });
    expect(item.getAttribute("aria-current")).toBe("page");
    expect(item.hasAttribute("aria-selected")).toBe(false);
    expect(item.textContent).toBe("Timesheets");
    expect(item.querySelector("[data-chevron]")).toBeNull();
    await user.click(item);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("leads with its icon, its words in a line of their own, and a chevron for the pointer while not current", () => {
    render(
      <Sidebar label="Main">
        <Sidebar.Item>
          <svg data-icon="" />
          <Typography variant="body">Shifts</Typography>
        </Sidebar.Item>
      </Sidebar>,
    );
    const item = screen.getByRole("button", { name: "Shifts" });
    expect(item.hasAttribute("aria-current")).toBe(false);
    expect([...item.children].map((child) => child.tagName.toLowerCase())).toEqual(["svg", "span", "svg"]);
    expect(item.firstElementChild?.hasAttribute("data-icon")).toBe(true);
    expect(item.children[1].textContent).toBe("Shifts");
    expect(item.querySelector("[data-chevron]")).not.toBeNull();
  });

  it("puts words alone in their line, with no icon", () => {
    render(
      <Sidebar label="Main">
        <Sidebar.Item><Typography variant="bodyLarge">Shifts</Typography></Sidebar.Item>
      </Sidebar>,
    );
    const item = screen.getByRole("button", { name: "Shifts" });
    expect(item.firstElementChild?.tagName.toLowerCase()).toBe("span");
    expect(item.firstElementChild?.textContent).toBe("Shifts");
  });
});
