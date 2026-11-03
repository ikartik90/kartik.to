import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge, Button, Chip, Pill, STATUS_PILL, Spotscore, Tags } from "../ui";
import TickIcon from "../assets/icons/medium/tick.svg";

afterEach(cleanup);

/** The chip or pill holding `text`, its words in a span of their own. */
const chipOf = (text: string) => screen.getByText(text).closest<HTMLElement>("[data-tone]")!;

describe("Badge", () => {
  it("takes its tone's own colours on a plain surface, its badge pair when inverted for a coloured one", () => {
    render(
      <>
        <Badge>3</Badge>
        <Badge state="disabled" inverted>
          4
        </Badge>
      </>,
    );
    const [plain, inverted] = document.querySelectorAll("[data-badge]");
    expect([plain.hasAttribute("data-inverted"), plain.getAttribute("data-tone")]).toEqual([false, null]);
    expect([inverted.hasAttribute("data-inverted"), inverted.getAttribute("data-tone")]).toEqual([true, "disabled"]);
  });

  it("leaves its words to what it leads unless it's a count read on its own", () => {
    render(
      <>
        <Badge>P</Badge>
        <Badge aria-hidden={false}>12</Badge>
      </>,
    );
    const badge = (words: string) => screen.getByText(words).closest("[data-badge]")!;
    expect(badge("P").getAttribute("aria-hidden")).toBe("true");
    expect(badge("12").getAttribute("aria-hidden")).toBe("false");
  });
});

describe("Chip", () => {
  it("is square, Medium and in its Default state, outlined, by default", () => {
    render(<Chip>Clamp Truck</Chip>);
    const chip = chipOf("Clamp Truck");
    expect(chip.tagName).toBe("SPAN");
    expect(chip.hasAttribute("data-shape")).toBe(false);
    expect([chip.dataset.size, chip.dataset.tone]).toEqual(["medium", "default"]);
  });

  it("is a button as a whole only when actionable", async () => {
    const onClick = vi.fn();
    render(
      <>
        <Chip actionable state="success" aria-label="Confirmed 8h" onClick={onClick}>
          8h
        </Chip>
        <Chip state="success">10h</Chip>
      </>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirmed 8h" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(chipOf("10h").tagName).toBe("SPAN");
  });

  it("is picked with a press at size large, ticked, and in its state's tone only when that's not Affirmative", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip actionable size="large" pressed={false} onClick={onClick}>
        String value
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "String value" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    // Its tick is there to open out as it's picked.
    expect(chip.querySelector("[data-tick]")).toBeTruthy();
    await user.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(
      <Chip actionable size="large" state="affirmative" pressed>
        String value
      </Chip>,
    );
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.dataset.tone).toBeUndefined();
    rerender(
      <Chip actionable size="large" state="warning" pressed>
        String value
      </Chip>,
    );
    expect(chip.dataset.tone).toBe("warning");
  });

  it("holds its own pick at size large when not given one, from its default", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Chip actionable size="large" defaultPressed>
          Forklift
        </Chip>
        <Chip actionable size="large">
          Reach Truck
        </Chip>
        <Chip actionable size="large" pressed={false}>
          Order Picker
        </Chip>
      </>,
    );
    const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");
    expect(pressed("Forklift")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Forklift" }));
    expect(pressed("Forklift")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Reach Truck" }));
    expect(pressed("Reach Truck")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Order Picker" }));
    expect(pressed("Order Picker")).toBe("false");
  });

  it("can't be pressed while disabled", () => {
    render(
      <>
        <Chip actionable size="large" disabled>
          String value
        </Chip>
        <Chip actionable disabled>
          8h
        </Chip>
      </>,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "String value" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "8h" }).disabled).toBe(true);
  });

  it("is taken away with its Remove button", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <Chip>
        String value
        <Chip.Remove onClick={onRemove} />
      </Chip>,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByText("String value")).toBeTruthy();
  });

  it("takes itself away with its Remove button when nothing else does", async () => {
    const user = userEvent.setup();
    render(
      <Chip>
        String value
        <Chip.Remove />
      </Chip>,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("String value")).toBeNull();
  });

  it("disables its Remove button with itself", () => {
    render(
      <Chip disabled>
        String value
        <Chip.Remove />
      </Chip>,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove" }).disabled).toBe(true);
  });

  it("is small in the metadata style, its words alone, in its state's tone or the disabled one", () => {
    render(
      <>
        <Chip size="small" state="affirmative">
          Temp to Hire
        </Chip>
        <Chip size="small" state="alert">
          2 Unread
        </Chip>
        <Chip size="small" disabled>
          Seen
        </Chip>
      </>,
    );
    const small = screen.getByText("Temp to Hire");
    expect([small.dataset.size, small.dataset.typography, small.dataset.tone]).toEqual(["small", "metadata", "active"]);
    expect(screen.getByText("2 Unread").dataset.tone).toBe("alert");
    expect(screen.getByText("Seen").dataset.tone).toBe("disabled");
  });
});

describe("Pill", () => {
  it("is round and Affirmative by default", () => {
    render(<Pill>Selected</Pill>);
    const pill = chipOf("Selected");
    expect(pill.tagName).toBe("SPAN");
    expect(pill.dataset.shape).toBe("pill");
    expect(pill.dataset.tone).toBe("active");
  });

  it("is a button as a whole only when actionable, still round", async () => {
    const onClick = vi.fn();
    render(
      <>
        <Pill actionable onClick={onClick}>
          Check-In Message
        </Pill>
        <Pill>Licensed</Pill>
      </>,
    );
    const pill = screen.getByRole("button", { name: "Check-In Message" });
    expect(pill.dataset.shape).toBe("pill");
    await userEvent.setup().click(pill);
    expect(onClick).toHaveBeenCalledOnce();
    expect(chipOf("Licensed").tagName).toBe("SPAN");
  });

  it("is in its state's tone, or the disabled one", () => {
    render(
      <>
        <Pill state="warning">Late</Pill>
        <Pill disabled>Upcoming</Pill>
      </>,
    );
    expect(chipOf("Late").dataset.tone).toBe("warning");
    expect(chipOf("Upcoming").dataset.tone).toBe("disabled");
  });

  it("leads with its badge, a letter or an icon, and is bare without one", () => {
    render(
      <>
        <Pill>
          <Badge inverted>P</Badge>
          Posted
        </Pill>
        <Pill>
          <TickIcon aria-hidden data-testid="icon" />
          Confirmed
        </Pill>
        <Pill>Draft</Pill>
      </>,
    );
    const posted = chipOf("Posted");
    expect(posted.querySelector("[data-badge]")?.textContent).toBe("P");
    expect(posted.querySelector("[data-badge]")?.getAttribute("aria-hidden")).toBe("true");
    expect(posted.hasAttribute("data-bare")).toBe(false);
    expect(screen.getByTestId("icon").parentElement).toBe(chipOf("Confirmed"));
    expect(chipOf("Draft").hasAttribute("data-bare")).toBe(true);
  });

  it("holds a check-in status's tone", () => {
    render(
      <>
        <Pill {...STATUS_PILL.checkedOut}>Checked Out</Pill>
        <Pill {...STATUS_PILL.upcoming}>Upcoming</Pill>
      </>,
    );
    expect(chipOf("Checked Out").dataset.tone).toBe("success");
    expect(chipOf("Upcoming").dataset.tone).toBe("disabled");
  });
});

describe("Tags", () => {
  // Each chip's own words, apart from a tooltip it holds.
  const labels = () =>
    [...screen.getByRole("group", { name: "Tags" }).children].map((chip) => chip.firstChild!.textContent);

  it("shows the first two tags, then how many more, whose tooltip lists each on a line of its own", () => {
    render(<Tags tags={["Licensed", "Warehouse", "Loading", "Packing", "Assembly Line"]} />);
    expect(labels()).toEqual(["Licensed", "Warehouse", "+3"]);
    const more = screen.getByRole("group", { name: "Tags" }).lastElementChild!;
    const tooltip = more.querySelector("[aria-hidden][data-lines]")!;
    expect([...tooltip.querySelectorAll(":scope > span")].map((line) => line.textContent)).toEqual([
      "Loading",
      "Packing",
      "Assembly Line",
    ]);
    expect(more.hasAttribute("data-tip")).toBe(true);
  });

  it("hangs the tooltip beside its chip, not in it, so the chip multiplies over its row alone", () => {
    render(<Tags tags={["Licensed", "Warehouse", "Loading"]} />);
    const chip = screen.getByText("+1");
    expect(chip.querySelector("[data-tooltip]")).toBeNull();
    expect(chip.parentElement!.querySelector(":scope > [data-tooltip]")?.textContent).toBe("Loading");
  });

  it("shows two tags or fewer as they are, and nothing for none", () => {
    const { rerender } = render(<Tags tags={["Security", "Licensed"]} />);
    expect(labels()).toEqual(["Security", "Licensed"]);
    rerender(<Tags tags={["Manufacturing", "Warehouse", "Licensed"]} />);
    expect(labels()).toEqual(["Manufacturing", "Warehouse", "+1"]);
    rerender(<Tags tags={[]} />);
    expect(screen.queryByRole("group", { name: "Tags" })).toBeNull();
  });
});

describe("Spotscore", () => {
  it("shows its tier's stars and name, then its rating", () => {
    render(<Spotscore tier="pro">98</Spotscore>);
    const score = screen.getByText("Pro", { exact: false });
    expect(score.dataset.tier).toBe("Pro");
    expect(score.textContent).toBe("Pro98");
    expect(score.querySelector("svg")).toBeTruthy();
  });
});

describe("a pill or button led by an icon", () => {
  it("ends on its words, so its end keeps its own padding, not an end icon's", () => {
    render(
      <>
        <Pill state="alert">
          <svg data-testid="chip-icon" />
          Absent
        </Pill>
        <Button size="small" emphasis="secondary">
          <svg data-testid="button-icon" />
          Check-in...
        </Button>
      </>,
    );
    expect(chipOf("Absent").lastElementChild!.textContent).toBe("Absent");
    expect(screen.getByRole("button", { name: "Check-in..." }).lastElementChild!.textContent).toBe("Check-in...");
  });
});
