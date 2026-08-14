import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Field } from "../field";
import { SegmentedControl } from "../segmented-control";

const FITS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

afterEach(cleanup);

describe("SegmentedControl", () => {
  it("offers every option at once, as a single-select listbox", () => {
    render(
      <SegmentedControl ariaLabel="Object fit" options={FITS} value="cover" />,
    );

    const list = screen.getByRole("listbox", { name: "Object fit" });
    expect(list).toBeTruthy();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Cover",
      "Contain",
    ]);
  });

  it("paints exactly one segment as selected — the one whose value it was given", () => {
    render(
      <SegmentedControl ariaLabel="Object fit" options={FITS} value="contain" />,
    );

    const selected = screen
      .getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Contain");
  });

  it("reports the value of the segment that was pressed", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Object fit"
        options={FITS}
        value="cover"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Contain" }));
    expect(onValueChange).toHaveBeenCalledWith("contain");
  });

  it("stays put when the segment already selected is pressed again", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Object fit"
        options={FITS}
        value="cover"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Cover" }));
    expect(onValueChange).not.toHaveBeenCalledWith(null);
    expect(screen.getByRole("option", { name: "Cover" }).getAttribute("aria-selected"))
      .toBe("true");
  });

  it("takes its accessible name from the Field it is composed into, with no ariaLabel", () => {
    render(
      <Field size="sm">
        <Field.Label>Object Fit</Field.Label>
        <SegmentedControl options={FITS} value="cover" />
      </Field>,
    );

    expect(screen.getByRole("listbox", { name: "Object Fit" })).toBeTruthy();
  });

  it("announces itself as a row, and is walked by the arrows that point along it", () => {
    render(
      <SegmentedControl ariaLabel="Object fit" options={FITS} value="cover" />,
    );

    const list = screen.getByRole("listbox");
    expect(list.getAttribute("aria-orientation")).toBe("horizontal");

    // Right roves real focus onto the next segment — which is a <button>, so
    // Enter/Space commit natively from there.
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("Contain");

    // And wraps, because both ends of a two-segment row are one key apart.
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("Cover");
  });

  it("leaves the vertical arrows alone — a row cannot move that way", () => {
    render(
      <SegmentedControl ariaLabel="Object fit" options={FITS} value="cover" />,
    );

    const list = screen.getByRole("listbox");
    const before = document.activeElement;
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(document.activeElement).toBe(before);
  });
});
