import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU } from "../ds-navigation";
import { Header, Notifications, PopoverMenu } from "../navigation";
import { Avatar } from "../data-table";
import { Sidebar } from "../sidebar";
import { SegmentedControl, Typography } from "../ui";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the header", () => {
  it("has the Menu that opens the sidebar", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Header>
        <Header.Menu aria-expanded aria-controls="nav" onClick={onClick} />
      </Header>,
    );
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("img", { name: "Spotwork" })).toBeTruthy();
    const menu = within(banner).getByRole("button", { name: "Menu" });
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("aria-controls")).toBe("nav");
    await user.click(menu);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("leaves the bell to the sidebar's footer, the account's avatar alone at its end", () => {
    render(
      <Header>
        <Avatar>JP</Avatar>
      </Header>,
    );
    const banner = screen.getByRole("banner");
    expect(within(banner).queryByRole("button", { name: "Notifications" })).toBeNull();
    expect(within(banner).getByText("JP")).toBeTruthy();
  });

  it("holds no avatar without an account", () => {
    render(
      <Header>
        <Header.Menu />
      </Header>,
    );
    const banner = screen.getByRole("banner");
    expect(within(banner).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Menu"]);
    expect(banner.children).toHaveLength(1);
  });

  it("puts the menu before the logo and the account's avatar at its end, wherever they're written", () => {
    render(
      <Header>
        <Avatar>JP</Avatar>
        <Header.Menu />
      </Header>,
    );
    const banner = screen.getByRole("banner");
    const [brand, account] = [...banner.children];
    expect(brand.firstElementChild).toBe(within(banner).getByRole("button", { name: "Menu" }));
    expect(account.lastElementChild!.querySelector("[data-avatar]")!.textContent).toBe("JP");
  });

  it("opens and shuts the sidebar of the provider it's in, by itself", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider defaultOpen>
        <Header>
          <Header.Menu />
        </Header>
        <Sidebar label="Main" />
      </Sidebar.Provider>,
    );
    const menu = screen.getByRole("button", { name: "Menu" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("aria-controls")).toBe(nav.id);
    await user.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(nav.getAttribute("data-state")).toBe("closed");
    await user.click(menu);
    expect(nav.getAttribute("data-state")).toBe("open");
  });
});


describe("a context menu's items", () => {
  it("close the menu before acting", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <PopoverMenu label="More actions" onClose={() => calls.push("close")} autoFocus={false}>
        <PopoverMenu.Item onClick={() => calls.push("select")}>
          <svg data-icon="" />
          <Typography variant="body">Add note</Typography>
        </PopoverMenu.Item>
      </PopoverMenu>,
    );
    const item = within(screen.getByRole("menu", { name: "More actions" })).getByRole("menuitem", { name: "Add note" });
    expect(item.firstElementChild?.hasAttribute("data-icon")).toBe(true);
    await user.click(item);
    expect(calls).toEqual(["close", "select"]);
  });
});

describe("a context menu's focus", () => {
  it("moves through its items with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <PopoverMenu label="More actions">
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">Add note</Typography>
        </PopoverMenu.Item>
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">View location</Typography>
        </PopoverMenu.Item>
      </PopoverMenu>,
    );
    const focused = () => document.activeElement?.textContent;
    expect(focused()).toBe("Add note");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("View location");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("View location");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("Add note");
  });
});

describe("a context menu with its trigger", () => {
  it("holds whether it's open, from its default, without taking the focus until its trigger opens it", async () => {
    const user = userEvent.setup();
    render(
      <PopoverMenu.Root defaultOpen>
        <PopoverMenu.Trigger aria-label="More actions">
          <svg />
        </PopoverMenu.Trigger>
        <PopoverMenu label="More actions">
          <PopoverMenu.Item>
            <svg />
            <Typography variant="body">Add note</Typography>
          </PopoverMenu.Item>
          <PopoverMenu.Item>
            <svg />
            <Typography variant="body">View location</Typography>
          </PopoverMenu.Item>
        </PopoverMenu>
      </PopoverMenu.Root>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    const menu = () => screen.queryByRole("menu", { name: "More actions" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu()!.contains(document.activeElement)).toBe(false);

    await user.click(trigger);
    await waitFor(() => expect(menu()).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(document.activeElement).toBe(within(menu()!).getAllByRole("menuitem")[0]);
    await user.click(within(menu()!).getByRole("menuitem", { name: "View location" }));
    await waitFor(() => expect(menu()).toBeNull());
  });
});

// The panel's header and toolbar, as the Navigation page draws them.
const chrome = (
  <>
    <Notifications.Header>
      <Typography variant="heading">Notifications</Typography>
      <Notifications.Close />
    </Notifications.Header>
    <Notifications.Toolbar>
      <Notifications.Filter>
        <SegmentedControl.Segment value="all">
          All
          <Notifications.UnreadCount />
        </SegmentedControl.Segment>
        <SegmentedControl.Segment value="missingCheckIn">
          Missing check-ins
          <Notifications.UnreadCount type="missingCheckIn" />
        </SegmentedControl.Segment>
        <SegmentedControl.Segment value="cancellation">
          Cancellations
          <Notifications.UnreadCount type="cancellation" />
        </SegmentedControl.Segment>
      </Notifications.Filter>
      <Notifications.MarkAllAsRead>Mark all as read</Notifications.MarkAllAsRead>
    </Notifications.Toolbar>
  </>
);

describe("notifications with their trigger", () => {
  it("hold whether they're open, and mark their own notifications read, kept while they're shut", async () => {
    const user = userEvent.setup();
    render(
      <Notifications.Root defaultOpen>
        <Notifications.Trigger aria-label="Notifications">
          <svg />
        </Notifications.Trigger>
        <Notifications>
          {chrome}
          <Notifications.List>
            <Notifications.Item type="missingCheckIn" unread>
              <Typography tag="p" variant="body">One</Typography>
              <Typography variant="metadata">Just now</Typography>
            </Notifications.Item>
            <Notifications.Item type="cancellation" unread>
              <Typography tag="p" variant="body">Two</Typography>
              <Typography variant="metadata">Yesterday</Typography>
            </Notifications.Item>
          </Notifications.List>
        </Notifications>
      </Notifications.Root>,
    );
    const trigger = screen.getByRole("button", { name: "Notifications" });
    const pane = () => screen.queryByRole("dialog", { name: "Notifications" });
    const button = (name: RegExp | string) => within(pane()!).getByRole("button", { name });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.click(button("Mark all as read"));
    expect(within(pane()!).queryAllByRole("img", { name: "Unread" })).toHaveLength(0);
    expect(button("All")).toBeTruthy();
    expect(button("Missing check-ins")).toBeTruthy();
    expect(button("Cancellations")).toBeTruthy();

    await user.click(button("Close"));
    await waitFor(() => expect(pane()).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    expect(within(pane()!).queryAllByRole("img", { name: "Unread" })).toHaveLength(0);
  });
});

describe("notifications", () => {
  function setup() {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMarkAllAsRead = vi.fn();
    render(
      <Notifications onClose={onClose} onMarkAllAsRead={onMarkAllAsRead}>
        {chrome}
        <Notifications.List>
          <Notifications.Item type="cancellation" unread>
            <Typography tag="p" variant="body">One</Typography>
            <Typography variant="metadata">Just now</Typography>
          </Notifications.Item>
          <Notifications.Item type="missingCheckIn" unread>
            <Typography tag="p" variant="body">Two</Typography>
            <Typography variant="metadata">5 minutes ago</Typography>
          </Notifications.Item>
          <Notifications.Item type="missingCheckIn">
            <Typography tag="p" variant="body">Three</Typography>
            <Typography variant="metadata">Yesterday</Typography>
          </Notifications.Item>
        </Notifications.List>
      </Notifications>,
    );
    const pane = screen.getByRole("dialog", { name: "Notifications" });
    const button = (name: RegExp | string) => within(pane).getByRole("button", { name });
    const items = () => within(pane).queryAllByRole("listitem").map((item) => item.textContent);
    return { user, pane, button, items, onClose, onMarkAllAsRead };
  }

  it("open on All, listing both kinds in their order, each segment counting its own unread", () => {
    const { pane, button, items } = setup();
    expect(button(/^All/).getAttribute("aria-pressed")).toBe("true");
    expect(items()).toEqual(["OneJust now", "Two5 minutes ago", "ThreeYesterday"]);
    expect(within(pane).getAllByRole("img", { name: "Unread" })).toHaveLength(2);
    expect(button("All2")).toBeTruthy();
    expect(button("Missing check-ins1")).toBeTruthy();
    expect(button("Cancellations1")).toBeTruthy();
  });

  it("list only the missing check-ins or the cancellations under theirs, and both again under All", async () => {
    const { user, button, items } = setup();
    await user.click(button(/^Missing check-ins/));
    expect(items()).toEqual(["Two5 minutes ago", "ThreeYesterday"]);
    await user.click(button(/^Cancellations/));
    expect(items()).toEqual(["OneJust now"]);
    await user.click(button(/^All/));
    expect(items()).toHaveLength(3);
  });

  it("show each as its words over its time, with no icon", () => {
    const { pane } = setup();
    const [one] = within(pane).getAllByRole("listitem");
    expect(one.querySelector("svg")).toBeNull();
    expect(one.querySelector("p")?.textContent).toBe("One");
    expect(one.querySelector("p")?.parentElement?.nextElementSibling?.textContent).toBe("Just now");
  });

  it("asks to mark them all as read, and to close", async () => {
    const { user, button, onClose, onMarkAllAsRead } = setup();
    await user.click(button("Mark all as read"));
    expect(onMarkAllAsRead).toHaveBeenCalledOnce();
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("the notifications", () => {
  function setup() {
    const { user, story } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const section = story("Notifications");
    const bell = within(section).getByRole("button", { name: "Notifications" });
    const pane = () => within(section).queryByRole("dialog", { name: "Notifications" });
    const items = () => within(pane()!).queryAllByRole("listitem");
    const words = () => items().map((item) => item.querySelector("p")?.textContent);
    const unread = () => items().filter((item) => within(item).queryByRole("img", { name: "Unread" }));
    const button = (name: RegExp | string) => within(pane()!).getByRole("button", { name });
    return { user, bell, pane, items, words, unread, button };
  }

  it("show open on All, each segment counting its unread", () => {
    const { bell, unread, button } = setup();
    expect(bell.getAttribute("aria-expanded")).toBe("true");
    expect(button(/^All/).getAttribute("aria-pressed")).toBe("true");
    expect(button(`All${unread().length}`)).toBeTruthy();
    expect(button(/^Missing check-ins\d$/)).toBeTruthy();
    expect(button(/^Cancellations\d$/)).toBeTruthy();
  });

  it("list every notification under All, newest first, the two kinds together", async () => {
    const { user, words, button } = setup();
    const all = words();
    await user.click(button(/^Missing check-ins/));
    const missing = words();
    await user.click(button(/^Cancellations/));
    const cancellations = words();
    expect(all).toHaveLength(missing.length + cancellations.length);
    expect(all.slice(0, 2)).toEqual([cancellations[0], missing[0]]);
    expect(all.filter((text) => missing.includes(text))).toEqual(missing);
    expect(all.filter((text) => cancellations.includes(text))).toEqual(cancellations);
  });

  it("list the workers who haven't checked in or have left the job site under Missing check-ins", async () => {
    const { user, words, button } = setup();
    await user.click(button(/^Missing check-ins/));
    expect(button(/^Missing check-ins/).getAttribute("aria-pressed")).toBe("true");
    expect(words()).toEqual([
      "Jeff Gwartzmann hasn't checked in for tonight's 10:30 PM–6:00 AM shift with Bristol Circle Oakville.",
      "Sikander Mazumdar left the job site after checking in for tonight's 9:00 PM–5:00 AM shift with Sweets from the Earth.",
      "Brittany Pilz left the job site after checking in for tonight's 6:15 PM–1:45 AM shift with CCLS First Gulf.",
      "Disha Patil hasn't checked in for tonight's 9:00 PM–5:00 AM shift with Four Seasons Produce.",
    ]);
  });

  it("list the workers who cancelled their shift under Cancellations", async () => {
    const { user, words, button } = setup();
    await user.click(button(/^Cancellations/));
    expect(button(/^Cancellations/).getAttribute("aria-pressed")).toBe("true");
    expect(words()).toEqual([
      "Tashonda Williams cancelled November 2 of their 12:00 PM–9:00 PM shift with Sweets from the Earth.",
      "Cristofer Dorwart cancelled November 2 and two other days of their 10:30 PM–6:30 AM shift with Harbourfront Catering.",
      "Marilyn Calzoni cancelled November 4 and one other day of their 10:00 PM–6:00 AM shift with Bristol Circle Oakville.",
    ]);
  });

  it("show no icon and no bold words on any notification", async () => {
    const { user, pane, button } = setup();
    for (const segment of [/^All/, /^Missing check-ins/, /^Cancellations/]) {
      await user.click(button(segment));
      expect(pane()!.querySelectorAll("li :is(svg, strong, b)")).toHaveLength(0);
      for (const words of pane()!.querySelectorAll("li p")) expect(words.getAttribute("data-typography")).toBe("body");
    }
  });

  it("mark them all as read: the dots and the counts go, every notification still listed", async () => {
    const { user, items, unread, button } = setup();
    const listed = items().length;
    await user.click(button("Mark all as read"));
    expect(unread()).toHaveLength(0);
    expect(items()).toHaveLength(listed);
    expect(button("All")).toBeTruthy();
    expect(button("Missing check-ins")).toBeTruthy();
    expect(button("Cancellations")).toBeTruthy();
  });

  it("closes from its close button, and opens again from the bell as it was left", async () => {
    const { user, bell, pane, unread, button } = setup();
    await user.click(button("Mark all as read"));
    await user.click(button("Close"));
    await waitFor(() => expect(pane()).toBeNull());
    expect(bell.getAttribute("aria-expanded")).toBe("false");

    await user.click(bell);
    expect(pane()).not.toBeNull();
    expect(unread()).toHaveLength(0);
  });
});

describe("the context menu", () => {
  function setup() {
    const { user, story } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const section = story("Popover Menu");
    const button = within(section).getByRole("button", { name: "More actions" });
    const menu = () => within(section).queryByRole("menu", { name: "More actions" });
    return { user, section, button, menu };
  }

  it("shows open, as Figma draws it, without taking the focus", () => {
    const { button, menu } = setup();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(within(menu()!).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Add note", "View location"]);
    expect(menu()!.contains(document.activeElement)).toBe(false);
  });

  it("closes on Escape, and opens again from its button with its first item focused", async () => {
    const { user, button, menu } = setup();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(menu()).toBeNull());
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await user.click(button);
    expect(document.activeElement).toBe(within(menu()!).getAllByRole("menuitem")[0]);
  });

  it("stays open through a press outside it until its button is used, then closes on one", async () => {
    const { user, section, button, menu } = setup();
    const heading = within(section).getByRole("heading", { level: 1 });
    await user.click(heading);
    expect(menu()).not.toBeNull();
    await user.click(button);
    await waitFor(() => expect(menu()).toBeNull());
    await user.click(button);
    await user.click(heading);
    await waitFor(() => expect(menu()).toBeNull());
  });

  it("closes when its button is pressed again, or when an item is picked", async () => {
    const { user, button, menu } = setup();
    await user.click(button);
    await waitFor(() => expect(menu()).toBeNull());

    await user.click(button);
    await user.click(within(menu()!).getByRole("menuitem", { name: "View location" }));
    await waitFor(() => expect(menu()).toBeNull());
  });

  it("lists items that share their words, as Figma's String Values do", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PopoverMenu label="More actions" autoFocus={false}>
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">Add note</Typography>
        </PopoverMenu.Item>
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">View location</Typography>
        </PopoverMenu.Item>
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">String Value</Typography>
        </PopoverMenu.Item>
        <PopoverMenu.Item>
          <svg />
          <Typography variant="body">String Value</Typography>
        </PopoverMenu.Item>
      </PopoverMenu>,
    );
    const menu = screen.getByRole("menu", { name: "More actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Add note",
      "View location",
      "String Value",
      "String Value",
    ]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
