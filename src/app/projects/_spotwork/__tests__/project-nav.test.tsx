import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardFocusProvider } from "@/components/keyboard-focus-provider";
import { DEMO, NAV, PROJECTS } from "../copy";
import { ProjectDock, ProjectMenu, VersionBar, type Choice } from "../project-nav";

afterEach(cleanup);

function setupDock(start: Choice = { project: "design-system" }) {
  const user = userEvent.setup();
  const changes: Choice[] = [];
  function Harness() {
    const [value, setValue] = useState(start);
    return (
      <ProjectDock
        projects={PROJECTS}
        value={value}
        onChange={(next) => {
          changes.push(next);
          setValue(next);
        }}
      />
    );
  }
  render(
    <>
      <KeyboardFocusProvider />
      <button>Before</button>
      <Harness />
      <button>After</button>
    </>,
  );
  const nav = screen.getByRole("navigation", { name: NAV.label });
  const buttons = () => within(nav).getAllByRole("button");
  // The projects' row spans 100–700 across and 500–540 down.
  vi.spyOn(buttons()[0].parentElement!, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 100, y: 500, width: 600, height: 40 }),
  );
  const labels = () => buttons().map((button) => button.textContent);
  const current = () => buttons().filter((button) => button.getAttribute("aria-current") === "true").map((b) => b.textContent);
  const expanded = () => nav.hasAttribute("data-expanded");
  return { user, nav, changes, labels, current, expanded };
}

describe("the project menu below the window", () => {
  it("lists the projects in Figma's order, the current one marked", () => {
    const { labels, current } = setupDock();
    expect(labels()).toEqual(["Design system", "Check-ins and time tracking", "Activation and retention"]);
    expect(current()).toEqual(["Design system"]);
  });

  it("rests as three dots, one per project, the current one marked", () => {
    const { nav } = setupDock();
    const dots = [...nav.querySelectorAll("[data-dot]")];
    expect(dots.every((dot) => dot.closest("[aria-hidden=true]"))).toBe(true);
    expect(dots.map((dot) => dot.hasAttribute("data-current"))).toEqual([true, false, false]);
  });

  it("rests collapsed, opening while the pointer is over it", async () => {
    const { user, nav, expanded } = setupDock();
    expect(expanded()).toBe(false);
    await user.hover(nav);
    expect(expanded()).toBe(true);
    await user.unhover(nav);
    expect(expanded()).toBe(false);
  });

  it("stays open while the pointer is within 20px above or below the projects or 40px beside them, closing past that", async () => {
    const { user, nav, expanded } = setupDock();
    const move = (clientX: number, clientY: number) => fireEvent.pointerMove(document, { clientX, clientY });
    await user.hover(nav);
    fireEvent.pointerLeave(nav, { clientX: 400, clientY: 485 });
    expect(expanded()).toBe(true);
    for (const [x, y] of [[65, 520], [735, 555], [400, 481], [699, 559]]) {
      move(x, y);
      expect(expanded(), `${x}, ${y}`).toBe(true);
    }
    move(400, 475);
    expect(expanded()).toBe(false);

    await user.hover(nav);
    fireEvent.pointerLeave(nav, { clientX: 70, clientY: 520 });
    move(55, 520);
    expect(expanded()).toBe(false);

    await user.hover(nav);
    fireEvent.pointerLeave(nav, { clientX: 400, clientY: 570 });
    expect(expanded()).toBe(false);
  });

  it("opens when reached by keyboard, and closes when focus moves past it", async () => {
    const { user, expanded } = setupDock();
    await user.tab();
    await user.tab();
    expect(document.activeElement?.textContent).toBe("Design system");
    expect(expanded()).toBe(true);
    for (let i = 0; i < 3; i++) await user.tab();
    expect(document.activeElement?.textContent).toBe("After");
    expect(expanded()).toBe(false);
  });

  it("closes once the pointer leaves, though the press left focus on a project", async () => {
    const { user, nav, expanded } = setupDock();
    await user.click(within(nav).getByRole("button", { name: "Design system" }));
    await user.unhover(nav);
    expect(expanded()).toBe(false);
  });

  it("switches to a project with versions on its first, staying a list", async () => {
    const { user, nav, changes, labels, current } = setupDock();
    await user.click(within(nav).getByRole("button", { name: "Activation and retention" }));
    expect(changes).toEqual([{ project: "activation-and-retention", version: "activation" }]);
    expect(labels()).toEqual(["Design system", "Check-ins and time tracking", "Activation and retention"]);
    expect(current()).toEqual(["Activation and retention"]);
    expect(within(nav).queryByRole("group")).toBeNull();
  });

  it("stays open while held, whatever the pointer does, until it's let go", () => {
    const dock = (held: boolean) => (
      <ProjectDock projects={PROJECTS} value={{ project: "design-system" }} onChange={() => {}} held={held} />
    );
    const { rerender } = render(dock(true));
    const nav = screen.getByRole("navigation", { name: NAV.label });
    expect(nav.hasAttribute("data-expanded")).toBe(true);
    fireEvent.pointerEnter(nav);
    fireEvent.pointerLeave(nav, { clientX: 2000, clientY: 2000 });
    expect(nav.hasAttribute("data-expanded")).toBe(true);
    rerender(dock(false));
    expect(nav.hasAttribute("data-expanded")).toBe(false);
  });

  // A finger's tap: it comes over the target and lifts away from it, the press between.
  function tap(target: Element, nav: Element) {
    fireEvent.pointerEnter(nav, { pointerType: "touch" });
    fireEvent.pointerDown(target, { pointerType: "touch" });
    fireEvent.pointerUp(target, { pointerType: "touch" });
    fireEvent.pointerLeave(nav, { pointerType: "touch", clientX: 2000, clientY: 2000 });
    fireEvent.click(target);
  }

  it("opens on a finger's tap, which hovers nothing, and stays open once it lifts", () => {
    const { nav, expanded } = setupDock();
    tap(nav.querySelector("[data-dot]")!, nav);
    expect(expanded()).toBe(true);
  });

  it("stays shut when focus lands on it after a tap elsewhere, as the overlay's opening hands it", () => {
    const { nav, expanded } = setupDock();
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    act(() => within(nav).getByRole("button", { name: "Design system" }).focus());
    expect(expanded()).toBe(false);
  });

  it("closes once a tap picks a project, or lands elsewhere", () => {
    const { nav, changes, expanded } = setupDock();
    tap(nav.querySelector("[data-dot]")!, nav);
    expect(expanded()).toBe(true);
    tap(within(nav).getByRole("button", { name: "Activation and retention" }), nav);
    expect(changes).toEqual([{ project: "activation-and-retention", version: "activation" }]);
    expect(expanded()).toBe(false);
    tap(nav.querySelector("[data-dot]")!, nav);
    expect(expanded()).toBe(true);
    fireEvent.pointerDown(screen.getByRole("button", { name: "After" }), { pointerType: "touch" });
    expect(expanded()).toBe(false);
  });

  it("keeps the current project's version when it's chosen again", async () => {
    const { user, nav, changes } = setupDock({ project: "activation-and-retention", version: "old" });
    await user.click(within(nav).getByRole("button", { name: "Activation and retention" }));
    expect(changes).toEqual([{ project: "activation-and-retention", version: "old" }]);
  });
});

describe("the project menu on a phone", () => {
  function setupMenu(start: Choice = { project: "check-ins", version: "company" }) {
    const user = userEvent.setup();
    const changes: Choice[] = [];
    function Harness() {
      const [value, setValue] = useState(start);
      return (
        <ProjectMenu
          projects={PROJECTS}
          value={value}
          onChange={(next) => {
            changes.push(next);
            setValue(next);
          }}
        />
      );
    }
    render(
      <>
        <Harness />
        <button>Elsewhere</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: NAV.label });
    const menu = () => screen.queryByRole("menu", { name: NAV.label });
    const items = () => within(menu()!).getAllByRole("menuitem");
    return { user, changes, trigger, menu, items };
  }

  it("rests as the dots, the current project's marked, on a button that opens the projects' menu", async () => {
    const { user, trigger, menu } = setupMenu();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect([...trigger.querySelectorAll("[data-dot]")].map((dot) => dot.hasAttribute("data-current"))).toEqual([false, true, false]);
    expect(menu()).toBeNull();
    await user.hover(trigger);
    expect(menu()).toBeNull();
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu()).not.toBeNull();
  });

  it("lists the projects in Figma's order, the current one marked", async () => {
    const { user, trigger, items } = setupMenu();
    await user.click(trigger);
    expect(items().map((item) => item.textContent)).toEqual(["Design system", "Check-ins and time tracking", "Activation and retention"]);
    expect(items().map((item) => item.getAttribute("aria-current"))).toEqual([null, "true", null]);
  });

  it("switches to the project picked, on its first version, and closes", async () => {
    const { user, changes, trigger, menu } = setupMenu();
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Activation and retention" }));
    expect(changes).toEqual([{ project: "activation-and-retention", version: "activation" }]);
    expect(menu()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on a second press of its button, a press elsewhere, or Escape", async () => {
    const { user, changes, trigger, menu } = setupMenu();
    await user.click(trigger);
    await user.click(trigger);
    expect(menu()).toBeNull();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(menu()).toBeNull();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(menu()).toBeNull();
    expect(changes).toEqual([]);
  });
});

describe("the versions above the window", () => {
  function setupBar(value: Choice, onPlay?: () => void) {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VersionBar projects={PROJECTS} value={value} onChange={onChange} onPlay={onPlay} />);
    return { user, onChange };
  }

  it("shows the current project's versions joined, the current one marked", () => {
    setupBar({ project: "check-ins", version: "company" });
    const versions = screen.getByRole("group", { name: NAV.versions });
    const buttons = within(versions).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Company", "Spotwork admin"]);
    expect(buttons.map((button) => button.getAttribute("aria-current"))).toEqual(["true", null]);
  });

  it("switches versions", async () => {
    const { user, onChange } = setupBar({ project: "activation-and-retention", version: "final" });
    await user.click(screen.getByRole("button", { name: "Old design" }));
    expect(onChange).toHaveBeenCalledWith({ project: "activation-and-retention", version: "old" });
  });

  it("shows nothing for a project without versions", () => {
    setupBar({ project: "design-system" });
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("plays the demo from a round Play button, named by a tooltip that carries the label alone", async () => {
    const onPlay = vi.fn();
    const { user } = setupBar({ project: "activation-and-retention", version: "recurrence" }, onPlay);
    const play = screen.getByRole("button", { name: DEMO.play });
    expect(play.textContent).toBe("");
    fireEvent.pointerEnter(play, { pointerType: "mouse", clientX: 5, clientY: 5 });
    const tip = screen.getByText(DEMO.play).closest("[data-visible]");
    expect(tip?.textContent).toBe(DEMO.play);
    expect(tip?.querySelector("svg")).toBeNull();
    await user.click(play);
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("has no Play without a demo", () => {
    setupBar({ project: "check-ins", version: "company" });
    expect(screen.queryByRole("button", { name: DEMO.play })).toBeNull();
  });
});
