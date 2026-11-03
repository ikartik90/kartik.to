import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectAddress } from "../use-project-address";

// The overlay's close plays out until the test ends it, as its animation would.
let ending: (() => void) | null = null;
const overlay = { current: { close: () => {} } };

function setup(initial?: string, base?: string) {
  const hook = renderHook(() => useProjectAddress(initial, overlay, base));
  overlay.current.close = () => (ending = () => act(() => hook.result.current.closed()));
  return hook;
}
const finishClosing = () => {
  ending?.();
  ending = null;
};
const address = () => window.location.pathname + window.location.search + window.location.hash;

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => {
  cleanup();
  ending = null;
});

describe("useProjectAddress", () => {
  it("opens a project at its own address", () => {
    const { result } = setup();
    act(() => result.current.open("check-ins"));
    expect(result.current.openId).toBe("check-ins");
    expect(address()).toBe("/projects/check-ins");
  });

  it("closes the overlay when Back takes its address off, and opens it again on Forward", async () => {
    const { result } = setup();
    act(() => result.current.open("check-ins"));
    window.history.back();
    await waitFor(() => expect(ending).not.toBeNull());
    finishClosing();
    expect(result.current.openId).toBeNull();
    expect(address()).toBe("/");

    window.history.forward();
    await waitFor(() => expect(result.current.openId).toBe("check-ins"));
  });

  it("follows the project the overlay switches to in place, so Back still leaves the overlay at once", async () => {
    const { result } = setup();
    act(() => result.current.open("check-ins"));
    act(() => result.current.switchTo("design-system"));
    expect(address()).toBe("/projects/design-system");
    window.history.back();
    await waitFor(() => expect(ending).not.toBeNull());
    finishClosing();
    expect(address()).toBe("/");
  });

  it("returns to the address it opened from as it closes", async () => {
    window.history.replaceState(null, "", "/?from=here#work");
    const { result } = setup();
    act(() => result.current.open("activation-and-retention"));
    act(() => result.current.closed());
    expect(result.current.openId).toBeNull();
    await waitFor(() => expect(address()).toBe("/?from=here#work"));
  });

  it("opened at its own address, leaves the homepage's in its place as it closes", () => {
    window.history.replaceState(null, "", "/projects/design-system");
    const { result } = setup("design-system");
    expect(result.current.openId).toBe("design-system");
    act(() => result.current.closed());
    expect(result.current.openId).toBeNull();
    expect(address()).toBe("/");
  });

  it("opens again on Forward taken while Back closes it", async () => {
    const { result } = setup();
    act(() => result.current.open("check-ins"));
    window.history.back();
    await waitFor(() => expect(ending).not.toBeNull());
    window.history.forward();
    await waitFor(() => expect(window.location.pathname).toBe("/projects/check-ins"));
    finishClosing();
    expect(result.current.openId).toBe("check-ins");
  });

  it("keeps to the copy of the homepage it's served under", () => {
    window.history.replaceState(null, "", "/dive");
    const { result } = setup(undefined, "/dive");
    act(() => result.current.open("check-ins"));
    expect(address()).toBe("/dive/projects/check-ins");

    cleanup();
    window.history.replaceState(null, "", "/dive/projects/check-ins");
    const opened = setup("check-ins", "/dive");
    act(() => opened.result.current.closed());
    expect(address()).toBe("/dive");
  });
});
