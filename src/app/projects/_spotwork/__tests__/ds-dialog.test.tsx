import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SNACKBAR } from "../ds-dialog";
import { renderStories } from "./story-harness";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Lets `Presence` drop what has closed. */
const settle = () => act(async () => {});

describe("the Snackbar's examples", () => {
  it("shows the snackbar as the app does, its message and Dismiss, and no example for a part left out", () => {
    const { titles, preview } = renderStories([SNACKBAR]);
    expect(titles("Snackbar")).toEqual(["Stacked"]);
    const [snackbar] = within(preview("Snackbar")).getAllByRole("status");
    expect(snackbar.textContent).toBe("Invitation sent");
    expect(within(snackbar).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Dismiss"]);
  });

  it("closes by itself from its Dismiss or after five seconds, and shows again a moment later", async () => {
    vi.useFakeTimers();
    const { preview } = renderStories([SNACKBAR]);
    const shown = () => within(preview("Snackbar")).queryAllByRole("status");
    fireEvent.click(within(shown()[0]).getByRole("button", { name: "Dismiss" }));
    await settle();
    expect(shown()).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => vi.advanceTimersByTime(4999));
    expect(shown()).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(1));
    await settle();
    expect(shown()).toHaveLength(0);
  });

  it("stacks snackbars newest in front, the rest behind, spreads them while pointed at, and holds their timers", async () => {
    vi.useFakeTimers();
    const { preview } = renderStories([SNACKBAR]);
    // Those still in it, not those leaving.
    const stacked = () =>
      within(preview("Snackbar", "Stacked"))
        .queryAllByRole("status")
        .filter((snackbar) => !snackbar.hasAttribute("data-leaving"));
    const places = () => stacked().map((snackbar) => [snackbar.textContent, snackbar.style.getPropertyValue("--index")]);
    expect(places()).toEqual([
      ["4 shifts posted", "2"],
      ["Invitation sent", "1"],
      ["Invitation link copied", "0"],
    ]);
    const behind = () => stacked().map((snackbar) => snackbar.hasAttribute("data-behind"));
    expect(behind()).toEqual([true, true, false]);
    const stack = stacked()[0].parentElement!;
    fireEvent.pointerEnter(stack);
    expect(stack.hasAttribute("data-expanded")).toBe(true);
    expect(behind()).toEqual([false, false, false]);
    await act(async () => vi.advanceTimersByTime(6000));
    expect(stacked()).toHaveLength(3);
    fireEvent.pointerLeave(stack);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(stacked()).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(stacked()).toHaveLength(1);
  });

  it("writes each example as the code that draws it", () => {
    const { code } = renderStories([SNACKBAR]);
    expect(code("Snackbar")).toBe(
      [
        'import { Snackbar } from "@/components/ui/snackbar"',
        "",
        "export function SnackbarDemo() {",
        "  return (",
        '    <div className="relative h-[5.75rem] w-full">',
        "      <Snackbar>",
        "        Invitation sent",
        "        <Snackbar.Close />",
        "      </Snackbar>",
        "    </div>",
        "  )",
        "}",
      ].join("\n"),
    );
  });
});
