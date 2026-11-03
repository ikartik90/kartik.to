import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CHIP, FORM_MORE_STORIES, PILL, SPOTSCORE } from "../ds-form-more";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the Form page's chips, pills, Spotscore, password, verification code and file upload", () => {
  it("are stories in the page's order, each showing Figma's properties", () => {
    const { titles } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Chip",
      "Password Input",
      "Verification Code Input",
      "File Upload",
      "Pill",
      "Spotscore",
    ]);
    expect(titles("Chip")).toEqual(["Size", "Actionable", "State", "Timesheet Status/Actionable"]);
    expect(titles("Pill")).toEqual([
      "Actionable",
      "State",
      "Check-in status",
      "Timesheet Status/Read-only",
      "Verification Status",
    ]);
    expect(titles("Spotscore")).toEqual(["Tier"]);
    expect(titles("Password Input")).toEqual(["State", "Is masked"]);
    expect(titles("Verification Code Input")).toEqual(["State"]);
    expect(titles("File Upload")).toEqual([]);
  });
});

describe("a chip's or pill's badge", () => {
  it("is inverted, the chip's or pill's surface being coloured already", () => {
    const { story, code } = renderStories([CHIP, PILL]);
    for (const id of ["Chip", "Pill"]) {
      const badges = [...story(id).querySelectorAll("[data-badge]")];
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.filter((badge) => !badge.hasAttribute("data-inverted"))).toEqual([]);
      expect(code(id)).not.toMatch(/<Badge>/);
    }
  });
});

describe("the actionable chip", () => {
  it("is picked and unpicked with a press, each in the State example starting as Figma draws it", async () => {
    const { preview, user } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const chip = within(preview("Chip", "Size")).getByRole("button", { name: "Clamp Truck" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    const large = within(preview("Chip", "State")).getAllByRole<HTMLButtonElement>("button");
    expect(large.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true", "true", "true", "true", "true"]);
    expect(large.map((button) => button.disabled)).toEqual([false, false, false, false, false, true]);
  });

  it("is a button as a whole only when actionable, as a pill is", () => {
    const { preview } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    for (const id of ["Chip", "Pill"]) {
      expect(within(preview(id, "Actionable")).getAllByRole("button")).toHaveLength(1);
      expect(preview(id, "Actionable").querySelectorAll("span[data-tone]")).toHaveLength(1);
    }
  });

  it("writes its examples as the code that draws them", () => {
    const { code } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    expect(code("Chip")).toContain("<Chip>Clamp Truck</Chip>");
    expect(code("Chip", "Size")).toContain('<Chip size="small" state="affirmative">');
    expect(code("Chip", "Size")).toContain("<Chip actionable size=\"large\">");
    expect(code("Pill", "Actionable")).toContain("<Pill actionable>");
    expect(code("Spotscore", "Tier")).toContain('<Spotscore tier="pro">98</Spotscore>');
    expect(code("Password Input")).toContain('<div className="w-[27.75rem]">');
    expect(code("Password Input", "State").match(/^ {6}<div className="w-\[27.75rem\]">$/gm)).toHaveLength(2);
  });

  it("puts each variant in a cell of its own, the State chips all in one set", () => {
    const { preview } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const cells = (id: string, title: string) => preview(id, title).querySelectorAll("[data-variants] > [data-cell]").length;
    expect(cells("Chip", "State")).toBe(17);
    expect(cells("Pill", "Check-in status")).toBe(8);
    expect(cells("Pill", "Timesheet Status/Read-only")).toBe(10);
    expect(cells("Password Input", "Is masked")).toBe(2);
    expect(cells("Verification Code Input", "State")).toBe(2);
  });

  it("calls a worker not checked in past the shift's start Missing Check-in among the check-in statuses", () => {
    const { preview } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const words = [...preview("Pill", "Check-in status").querySelectorAll("[data-variants] > [data-cell]")].map((cell) => cell.textContent);
    expect(words).toEqual(["Upcoming", "Waiting", "Checked In", "Missing Check-in", "Late Check-in", "Absent", "Cancelled", "Checked Out"]);
  });
});

describe("Molecules/Form/Password Input", () => {
  it("shows its password with Show where Figma draws it unmasked, and hides it again", async () => {
    const { preview, user } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const [masked, shown] = within(preview("Password Input", "Is masked")).getAllByLabelText<HTMLInputElement>("Password");
    expect([masked.type, shown.type]).toEqual(["password", "text"]);
    await user.click(within(preview("Password Input", "Is masked")).getByRole("button", { name: "Show" }));
    expect(masked.type).toBe("text");
  });

  it("shows its conditions in Alert, as a field left blank does", () => {
    const { preview } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const [, alert] = within(preview("Password Input", "State")).getAllByLabelText<HTMLInputElement>("Password").map((input) =>
      input.closest("[data-ds-story] [data-cell]")!,
    );
    expect(within(alert as HTMLElement).getAllByRole("list")).toHaveLength(1);
  });

  it("shows a password that misses a condition as an Alert, and Default empty", () => {
    const { preview } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const state = (input: HTMLElement) => input.closest("[data-field]")!.getAttribute("data-state");
    expect(state(within(preview("Password Input")).getByLabelText("Password"))).toBe("alert");
    const [plain] = within(preview("Password Input", "State")).getAllByLabelText<HTMLInputElement>("Password");
    expect([plain.value, state(plain)]).toEqual(["", null]);
  });
});

describe("the verification code", () => {
  it("moves on to the next digit as one is typed, and says the code has expired in Alert", async () => {
    const { preview, user } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    const digits = within(preview("Verification Code Input")).getAllByRole<HTMLInputElement>("textbox", { name: "Verification Code" });
    await user.click(digits[0]);
    await user.keyboard("4");
    expect(digits[0].value).toBe("4");
    expect(document.activeElement).toBe(digits[1]);
    expect(preview("Verification Code Input", "State").textContent).toContain("This verification code has expired");
  });
});

describe("Molecules/Form/File Upload", () => {
  it("shows a chosen spreadsheet's name", async () => {
    const { preview, user } = renderStories([CHIP, ...FORM_MORE_STORIES, PILL, SPOTSCORE]);
    await user.upload(within(preview("File Upload")).getByLabelText("Browse files..."), new File(["name,phone"], "roster.csv", { type: "text/csv" }));
    expect(within(preview("File Upload")).getByText("roster.csv")).toBeTruthy();
  });
});
