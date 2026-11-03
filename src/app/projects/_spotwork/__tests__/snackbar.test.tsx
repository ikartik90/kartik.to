import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Snackbar } from "../shifts-page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the snackbar", () => {
  it("names its parts as the code view prints them", () => {
    expect(Snackbar.displayName).toBe("Snackbar");
    expect(Snackbar.Action.displayName).toBe("Snackbar.Action");
    expect(Snackbar.Close.displayName).toBe("Snackbar.Close");
  });

  it("says its words first, then its action and its Dismiss, whatever order they come in", () => {
    render(
      <Snackbar onClose={() => {}}>
        <Snackbar.Close />
        <Snackbar.Action onClick={() => {}}>Action</Snackbar.Action>
        Status message
      </Snackbar>,
    );
    const [words, end] = [...screen.getByRole("status").children];
    expect(words.textContent).toBe("Status message");
    expect(within(end as HTMLElement).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Action",
      "Dismiss",
    ]);
  });

  it("has no end without an action or a Dismiss", () => {
    render(<Snackbar onClose={() => {}}>Shift posted</Snackbar>);
    expect(screen.getByRole("status").children).toHaveLength(1);
  });

  it("closes from its Dismiss, and from its action once taken", () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    render(
      <Snackbar onClose={onClose}>
        Status message
        <Snackbar.Action onClick={onAction}>Action</Snackbar.Action>
        <Snackbar.Close />
      </Snackbar>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes itself without an owner to close it", async () => {
    vi.useFakeTimers();
    const shown = () => screen.queryAllByRole("status");
    const settle = () => act(async () => {});
    render(
      <>
        <Snackbar>
          Dismissed
          <Snackbar.Close />
        </Snackbar>
        <Snackbar>
          Acted on
          <Snackbar.Action>Action</Snackbar.Action>
        </Snackbar>
        <Snackbar>Timed out</Snackbar>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    await settle();
    expect(shown().map((snackbar) => snackbar.textContent)).toEqual(["Timed out"]);
    await act(async () => vi.advanceTimersByTime(5000));
    await settle();
    expect(shown()).toHaveLength(0);
  });

  it("closes itself after five seconds, its words changing or not", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<Snackbar onClose={onClose}>Status message</Snackbar>);
    await act(async () => vi.advanceTimersByTime(4000));
    rerender(<Snackbar onClose={onClose}>Shift posted</Snackbar>);
    await act(async () => vi.advanceTimersByTime(999));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("a stack of snackbars", () => {
  it("lets a snackbar taken from it leave before dropping it", async () => {
    vi.useFakeTimers();
    const stack = (keys: string[]) => (
      <Snackbar.Stack>
        {keys.map((key) => (
          <Snackbar key={key} onClose={() => {}}>
            {key}
          </Snackbar>
        ))}
      </Snackbar.Stack>
    );
    const { rerender } = render(stack(["posted", "sent"]));
    rerender(stack(["posted"]));
    const shown = () => screen.queryAllByRole("status").map((snackbar) => [snackbar.textContent, snackbar.hasAttribute("data-leaving")]);
    expect(shown()).toEqual([
      ["posted", false],
      ["sent", true],
    ]);
    await act(async () => vi.advanceTimersByTime(400));
    expect(shown()).toEqual([["posted", false]]);
  });

  it("leaves a snackbar where it is in the page, front or behind, so it doesn't come in again", () => {
    const stack = (keys: string[]) => (
      <Snackbar.Stack>
        {keys.map((key) => (
          <Snackbar key={key} onClose={() => {}}>
            {key}
          </Snackbar>
        ))}
      </Snackbar.Stack>
    );
    const { container, rerender } = render(stack(["approved", "sent", "updated"]));
    const moves = new MutationObserver(() => {});
    moves.observe(container.firstElementChild!, { childList: true });
    rerender(stack(["sent", "updated"]));
    rerender(stack(["sent"]));
    rerender(stack(["sent", "added"]));
    expect(moves.takeRecords().flatMap((record) => [...record.removedNodes])).toEqual([]);
    expect(screen.getAllByRole("status").map((snackbar) => snackbar.textContent)).toEqual(["approved", "sent", "updated", "added"]);
  });
});
