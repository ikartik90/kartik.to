import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { HISTORY_DEBOUNCE_MS, useDraftHistory } from "../use-draft-history";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  useShaderPresetDraftStore.getState().reset();
});

const press = (init: Partial<KeyboardEventInit> & { target?: Element } = {}) => {
  const { target, ...rest } = init;
  const event = new KeyboardEvent("keydown", {
    key: "z",
    metaKey: true,
    bubbles: true,
    cancelable: true,
    ...rest,
  });
  (target ?? document.body).dispatchEvent(event);
  return event;
};

describe("useDraftHistory", () => {
  const KEY = "u_colorEdgeStrength";
  const paramNow = () =>
    useShaderPresetDraftStore.getState().settings.params[KEY];

  /** An edit with a step recorded behind it, so there is something to undo. */
  const editWithStep = (value: number) => {
    const before = paramNow();
    act(() => {
      useShaderPresetDraftStore.getState().setParam(KEY, value);
      useShaderPresetDraftStore.getState().pushHistory();
    });
    return before;
  };

  it("steps back on the shortcut", () => {
    renderHook(() => useDraftHistory());
    const before = editWithStep(0.25);

    act(() => void press());
    expect(paramNow()).toBe(before);
  });

  it("steps forward when the shortcut carries shift", () => {
    renderHook(() => useDraftHistory());
    editWithStep(0.25);

    act(() => void press());
    act(() => void press({ shiftKey: true }));
    expect(paramNow()).toBe(0.25);
  });

  it("takes the press, so the browser does not also act on it", () => {
    renderHook(() => useDraftHistory());
    let event!: KeyboardEvent;
    act(() => {
      event = press();
    });
    expect(event.defaultPrevented).toBe(true);
  });

  // A field has its OWN undo, and it is the one the author means while the
  // caret is in it. Hijacking it would make ⌘Z in the hex box rewrite the ramp
  // instead of the four characters just typed.
  it("leaves a text field's own undo alone", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    renderHook(() => useDraftHistory());
    editWithStep(0.25);

    let event!: KeyboardEvent;
    act(() => {
      event = press({ target: input });
    });

    expect(paramNow()).toBe(0.25);
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it("ignores the key without its modifier", () => {
    renderHook(() => useDraftHistory());
    editWithStep(0.25);

    act(() => void press({ metaKey: false }));
    expect(paramNow()).toBe(0.25);
  });

  // A slider drag emits a value per frame. One step per frame would bury every
  // other edit in the stack, so the push waits for the hand to stop.
  it("records one step for a burst of edits", () => {
    vi.useFakeTimers();
    renderHook(() => useDraftHistory());
    const depth = () => useShaderPresetDraftStore.getState().history.length;
    const before = depth();

    act(() => {
      for (const value of [0.1, 0.2, 0.3, 0.4]) {
        useShaderPresetDraftStore.getState().setParam("u_colorEdgeStrength", value);
      }
    });
    expect(depth()).toBe(before);

    act(() => void vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS));
    expect(depth()).toBe(before + 1);
  });

  // The restore itself must not be recorded, or the redo stack it just made
  // available would be trimmed off by the debounce that follows it.
  it("does not record the state an undo restored", () => {
    vi.useFakeTimers();
    renderHook(() => useDraftHistory());

    act(() => {
      useShaderPresetDraftStore.getState().setParam("u_colorEdgeStrength", 0.5);
    });
    act(() => void vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS));
    const depth = useShaderPresetDraftStore.getState().history.length;

    act(() => void useShaderPresetDraftStore.getState().undo());
    act(() => void vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS));

    const state = useShaderPresetDraftStore.getState();
    expect(state.history).toHaveLength(depth);
    expect(state.historyIndex).toBe(depth - 2);
  });
});
