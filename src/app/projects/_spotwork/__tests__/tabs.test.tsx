import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabCard, TabGroup } from "../tabs";
import { Typography } from "../ui";

afterEach(cleanup);

describe("a tab card", () => {
  it("is a toggle on its own, pressed while current, its change in the value's line", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <TabCard current onClick={onClick}>
        <svg data-icon="" />
        <Typography variant="body">Tab title</Typography>
        <Typography variant="heading">30</Typography>
        <TabCard.Change tone="alert">
          <Typography variant="badge">1</Typography>
          New
        </TabCard.Change>
      </TabCard>,
    );
    const button = screen.getByRole("button", { name: /^Tab title/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("Tab title301New");
    expect(within(button).getByText("New").getAttribute("data-tone")).toBe("alert");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("leads with its icon, then its title over its count, in whatever order they're written", () => {
    render(
      <TabCard>
        <Typography variant="heading">30</Typography>
        <Typography variant="body">Tab title</Typography>
        <svg data-icon="" />
      </TabCard>,
    );
    const [icon, body] = screen.getByRole("button").children;
    expect(icon.firstElementChild?.hasAttribute("data-icon")).toBe(true);
    expect([...body.children].map((part) => part.textContent)).toEqual(["Tab title", "30"]);
  });

  it("is unpressed when not current, and has no change unless given one", () => {
    render(
      <TabCard>
        <Typography variant="body">Tab title</Typography>
        <Typography variant="heading">30</Typography>
      </TabCard>,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("Tab title30");
  });

  it("leaves no room for an icon it hasn't got", () => {
    render(
      <TabCard>
        <Typography variant="body">Tab title</Typography>
        <Typography variant="heading">30</Typography>
      </TabCard>,
    );
    expect([...screen.getByRole("button").children].map((part) => part.textContent)).toEqual(["Tab title30"]);
  });

  it("holds its own pressed state when not given one, from its default", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TabCard defaultCurrent>
          <Typography variant="body">One</Typography>
          <Typography variant="heading">1</Typography>
        </TabCard>
        <TabCard>
          <Typography variant="body">Two</Typography>
          <Typography variant="heading">2</Typography>
        </TabCard>
      </>,
    );
    const [one, two] = screen.getAllByRole("button");
    expect([one, two].map((card) => card.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    await user.click(one);
    await user.click(two);
    expect([one, two].map((card) => card.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  });

  it("sits in a labelled group of cards, each its own toggle", () => {
    render(
      <TabCard.Group label="Canada">
        <TabCard current>
          <Typography variant="body">Missing</Typography>
          <Typography variant="heading">3</Typography>
        </TabCard>
        <TabCard>
          <Typography variant="body">All</Typography>
          <Typography variant="heading">8</Typography>
        </TabCard>
      </TabCard.Group>,
    );
    const group = screen.getByRole("group", { name: "Canada" });
    expect(within(group).getAllByRole("button").map((card) => card.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
  });
});

function Group({ size, onChange }: { size?: "large" | "small"; onChange?: (value: string) => void }) {
  const [value, setValue] = useState("Tab 2");
  const change = (next: string) => {
    setValue(next);
    onChange?.(next);
  };
  return size === "small" ? (
    <TabGroup size="small" label="Tab Group" value={value} onChange={change}>
      <TabGroup.Tab value="Tab 1" id="first" aria-controls="panel">
        One
      </TabGroup.Tab>
      <TabGroup.Tab value="Tab 2">Two</TabGroup.Tab>
    </TabGroup>
  ) : (
    <TabGroup size={size} label="Tab Group" value={value} onChange={change}>
      <TabCard value="Tab 1">
        <Typography variant="body">One</Typography>
        <Typography variant="heading">1</Typography>
      </TabCard>
      <TabCard value="Tab 2">
        <Typography variant="body">Two</Typography>
        <Typography variant="heading">2</Typography>
      </TabCard>
    </TabGroup>
  );
}

const selected = () => screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-selected"));

describe("a tab group", () => {
  it("is a labelled list of tab cards, the one whose value it holds selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Group onChange={onChange} />);
    expect(screen.getByRole("tablist", { name: "Tab Group" })).toBeTruthy();
    expect(selected()).toEqual(["false", "true"]);
    expect(screen.getAllByRole("tab")[0].hasAttribute("aria-pressed")).toBe(false);
    await user.click(screen.getAllByRole("tab")[0]);
    expect(onChange).toHaveBeenCalledWith("Tab 1");
    expect(selected()).toEqual(["true", "false"]);
  });

  it("holds its own value when not given one, from its default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TabGroup size="small" label="Tab Group" defaultValue="Tab 2" onChange={onChange}>
        <TabGroup.Tab value="Tab 1">One</TabGroup.Tab>
        <TabGroup.Tab value="Tab 2">Two</TabGroup.Tab>
      </TabGroup>,
    );
    expect(selected()).toEqual(["false", "true"]);
    await user.click(screen.getAllByRole("tab")[0]);
    expect(selected()).toEqual(["true", "false"]);
    expect(onChange).toHaveBeenCalledWith("Tab 1");
  });

  it("holds Atoms/Tabs when small, each passing on its own attributes", async () => {
    const user = userEvent.setup();
    render(<Group size="small" />);
    const [one, two] = screen.getAllByRole("tab");
    expect(one.textContent).toBe("One");
    expect(one.id).toBe("first");
    expect(one.getAttribute("aria-controls")).toBe("panel");
    expect(two.getAttribute("aria-selected")).toBe("true");
    await user.click(one);
    expect(selected()).toEqual(["true", "false"]);
  });
});
