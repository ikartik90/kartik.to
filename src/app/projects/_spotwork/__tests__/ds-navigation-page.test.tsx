import { cleanup, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU } from "../ds-navigation";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the Navigation page's examples", () => {
  it("lists Figma's navigation components in the page's order, Nav Item and Notification Content now parts", () => {
    renderStories([...NAVIGATION_STORIES, POPOVER_MENU]);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Header",
      "Sidebar",
      "Global Navigation",
      "Popover Menu",
    ]);
  });

  it("shows each as Figma draws it, the header always with its Menu", () => {
    const { titles, preview } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    for (const id of ["Header", "Popover Menu", "Notifications", "Global Navigation"]) expect(titles(id)).toEqual([]);
    expect(titles("Sidebar")).toEqual(["Rail"]);
    expect(within(preview("Header")).getByRole("button", { name: "Menu" })).toBeTruthy();
  });

  it("opens the sidebar on Timesheets, as Figma draws it, and marks the item pressed as the current page", async () => {
    const { user, preview } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const nav = within(preview("Sidebar"));
    const current = () => nav.getAllByRole("button").filter((item) => item.getAttribute("aria-current") === "page");
    expect(nav.getAllByRole("button").map((item) => item.textContent)).toEqual([
      "Check-ins",
      "Shifts",
      "Timesheets",
      "Cancellations",
      "Verifications",
      "Advanced search",
    ]);
    expect(current().map((item) => item.textContent)).toEqual(["Timesheets"]);
    await user.click(nav.getByRole("button", { name: "Verifications" }));
    expect(current().map((item) => item.textContent)).toEqual(["Verifications"]);
  });

  it("shuts the sidebar to a rail, its items still in reach", async () => {
    const { user, preview } = renderStories(NAVIGATION_STORIES);
    const rail = within(preview("Sidebar", "Rail")).getByRole("navigation", { name: "Main" });
    expect(rail.getAttribute("data-state")).toBe("closed");
    expect(rail.hasAttribute("data-rail")).toBe(true);
    await user.click(within(rail).getByRole("button", { name: "Shifts" }));
    expect(within(rail).getByRole("button", { name: "Shifts" }).getAttribute("aria-current")).toBe("page");
  });

  it("heads the rail with its team, which opens the company's teams beside it, its own selected", async () => {
    const { user, preview } = renderStories(NAVIGATION_STORIES);
    const rail = within(preview("Sidebar", "Rail")).getByRole("navigation", { name: "Main" });
    const team = within(rail).getByRole("button", { name: "CCLS First Gulf" });
    expect(rail.firstElementChild!.contains(team)).toBe(true);
    await user.click(team);
    const popover = within(preview("Sidebar", "Rail")).getByRole("dialog", { name: "Switch team" });
    expect([...popover.children].map((record) => record.textContent)).toEqual([
      "CCLS First GulfSelected250 First Gulf Boulevard, Brampton, ON",
      "CCLS White Hart6090 White Hart Lane, Mississauga, ON",
      "CCLS Derwent101-1005 Derwent Way, Delta, BC",
      "CCLS Thornton1180 Thornton Road, Oshawa, ON",
    ]);
  });

  it("opens the context menu from its trigger, and shuts it again", async () => {
    const { user, preview } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const trigger = within(preview("Popover Menu")).getByRole("button", { name: "More actions" });
    const menu = () => within(preview("Popover Menu")).queryByRole("menu", { name: "More actions" });
    expect(within(menu()!).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Add note", "View location"]);
    await user.click(trigger);
    await waitFor(() => expect(menu()).toBeNull());
    await user.click(trigger);
    expect(menu()).not.toBeNull();
  });

  it("closes and opens the global navigation's sidebar from the header's Menu", async () => {
    const { user, preview } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const menu = within(preview("Global Navigation")).getByRole("button", { name: "Menu" });
    const nav = within(preview("Global Navigation")).getByRole("navigation", { name: "Main" });
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("aria-controls")).toBe(nav.id);
    await user.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(nav.getAttribute("data-state")).toBe("closed");
    await user.click(menu);
    expect(nav.getAttribute("data-state")).toBe("open");
  });

  it("writes the context menu as the code that draws it", () => {
    const { code } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    expect(code("Popover Menu")).toBe(
      [
        'import { KebabMenuIcon, MenuNotesIcon, MenuPinIcon } from "@/components/icons"',
        'import { PopoverMenu } from "@/components/ui/popover-menu"',
        'import { Typography } from "@/components/ui/typography"',
        "",
        "export function PopoverMenuDemo() {",
        "  return (",
        "    <PopoverMenu.Root defaultOpen>",
        '      <PopoverMenu.Trigger aria-label="More actions">',
        "        <KebabMenuIcon aria-hidden />",
        "      </PopoverMenu.Trigger>",
        '      <PopoverMenu label="More actions">',
        "        <PopoverMenu.Item>",
        "          <MenuNotesIcon aria-hidden />",
        '          <Typography variant="body">Add note</Typography>',
        "        </PopoverMenu.Item>",
        "        <PopoverMenu.Item>",
        "          <MenuPinIcon aria-hidden />",
        '          <Typography variant="body">View location</Typography>',
        "        </PopoverMenu.Item>",
        "      </PopoverMenu>",
        "    </PopoverMenu.Root>",
        "  )",
        "}",
      ].join("\n"),
    );
  });

  it("writes the global navigation as a provider around its header and sidebar", () => {
    const { code } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    const text = code("Global Navigation");
    expect(text).toContain('import { Sidebar } from "@/components/ui/sidebar"');
    expect(text).toContain('    <Sidebar.Provider>\n      <div\n        className="flex flex-col overflow-hidden');
    expect(text.split("\n").slice(-4)).toEqual(["      </div>", "    </Sidebar.Provider>", "  )", "}"]);
    expect(text).toContain('<Sidebar label="Main" defaultValue="Timesheets">');
    expect(text).toContain(
      '<Sidebar.Item value="Check-ins">\n            <CheckInIcon aria-hidden />\n            <Typography variant="body">Check-ins</Typography>\n',
    );
    expect(text).not.toContain("ListItem");
    expect(text).toContain(
      [
        "          <Sidebar.Group>",
        "            <Sidebar.GroupLabel>",
        '              <Typography tag="div" variant="metadataStrong" color="subdued">',
        "                Admin",
        "              </Typography>",
        "            </Sidebar.GroupLabel>",
      ].join("\n"),
    );
    expect(text).toContain("<Header.Menu />");
    expect(text).toContain("<Avatar src={user.face} />");
  });

  it("opens Notifications from the sidebar's Notifications action, as the app does, with no bell of its own", async () => {
    const { user, preview, code } = renderStories([NOTIFICATIONS]);
    const story = within(preview("Notifications"));
    const action = within(story.getByRole("navigation")).getByRole("button", { name: "Notifications" });
    const pane = () => story.queryByRole("dialog", { name: "Notifications" });
    expect(story.getAllByRole("button", { name: "Notifications" })).toEqual([action]);
    expect(action.getAttribute("aria-haspopup")).toBe("dialog");
    expect(action.getAttribute("aria-expanded")).toBe("true");
    expect(pane()).toBeTruthy();
    await user.click(action);
    await waitFor(() => expect(pane()).toBeNull());
    expect(action.getAttribute("aria-expanded")).toBe("false");
    await user.click(action);
    expect(pane()).toBeTruthy();
    // Its code is the pane's alone.
    expect(code("Notifications")).not.toMatch(/Notifications\.(Root|Trigger)|Sidebar/);
  });

  it("writes each notification as its kind, its words in the default colour, then its time subdued", () => {
    const { code } = renderStories([...NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU]);
    expect(code("Notifications")).toMatch(
      /<Notifications\.Item type="missingCheckIn" unread>\n\s+<Typography tag="p" variant="body">\n\s+Jeff Gwartzmann hasn't checked in/,
    );
    expect(code("Notifications")).toMatch(/<Typography variant="metadata" color="subdued">Just now<\/Typography>/);
    const list = code("Notifications").split("<Notifications.List>")[1];
    expect(list).not.toMatch(/Icon|<strong|time=/);
  });
});
