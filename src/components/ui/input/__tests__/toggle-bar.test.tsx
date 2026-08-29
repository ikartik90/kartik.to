import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ToggleBar } from "../toggle-bar";

const DIRECTIONS = [
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

afterEach(cleanup);

describe("ToggleBar", () => {
  it("offers every option at once, as a toolbar of independent toggles", () => {
    render(<ToggleBar ariaLabel="Direction" options={DIRECTIONS} value={["up"]} />);

    expect(screen.getByRole("toolbar", { name: "Direction" })).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Up",
      "Down",
      "Left",
      "Right",
    ]);
  });

  it("presses exactly the options it was given, and no others", () => {
    render(
      <ToggleBar ariaLabel="Direction" options={DIRECTIONS} value={["down", "right"]} />,
    );

    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed.map((button) => button.textContent)).toEqual(["Down", "Right"]);
  });

  it("adds a pressed option to the value rather than replacing it", () => {
    // The whole difference from its single-select sibling: these choices are
    // independent, so pressing a second one does not release the first.
    const onValueChange = vi.fn();
    render(
      <ToggleBar
        ariaLabel="Direction"
        options={DIRECTIONS}
        value={["up"]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    expect(onValueChange).toHaveBeenCalledWith(["up", "left"]);
  });

  it("reports the added option in the options' order, not the order it was pressed", () => {
    // So that two bars in the same state hold equal arrays — which is what
    // lets a caller compare them, and what keeps a saved value from depending
    // on the sequence of clicks that produced it.
    const onValueChange = vi.fn();
    render(
      <ToggleBar
        ariaLabel="Direction"
        options={DIRECTIONS}
        value={["right"]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(onValueChange).toHaveBeenCalledWith(["up", "right"]);
  });

  it("releases a pressed option, leaving the rest alone", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleBar
        ariaLabel="Direction"
        options={DIRECTIONS}
        value={["up", "down", "left"]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Down" }));
    expect(onValueChange).toHaveBeenCalledWith(["up", "left"]);
  });

  it("holds the last pressed option down rather than emptying the bar", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleBar
        ariaLabel="Direction"
        options={DIRECTIONS}
        value={["up"]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("lets the last one go when the caller says an empty bar is a state", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleBar
        ariaLabel="Direction"
        options={DIRECTIONS}
        value={["up"]}
        allowEmpty
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(onValueChange).toHaveBeenCalledWith([]);
  });
});
