// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaProperties } from "../use-media-properties";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type MediaNode,
} from "@/domain/nodes";

const item = (src: string, over: Partial<MediaNode> = {}): MediaNode =>
  ({ type: "media", kind: "image", src, ...over }) as MediaNode;

function setup(items: MediaNode[]) {
  const onItemsChange = vi.fn<(next: MediaNode[]) => void>();
  const view = renderHook(
    ({ list }: { list: MediaNode[] }) =>
      useMediaProperties(list, onItemsChange),
    { initialProps: { list: items } },
  );
  return { ...view, onItemsChange };
}

describe("useMediaProperties", () => {
  it("starts with nothing open", () => {
    const { result } = setup([item("a"), item("b")]);
    expect(result.current.openIndex).toBe(-1);
    expect(result.current.panel).toBeNull();
  });

  it("opens the panel for one object", () => {
    const { result } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    expect(result.current.openIndex).toBe(1);
    expect(result.current.panel).not.toBeNull();
  });

  it("follows its object when the order changes", () => {
    const { result, rerender } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    rerender({ list: [item("b"), item("a")] });
    expect(result.current.openIndex).toBe(0);
  });

  it("closes itself when its object is gone", () => {
    const { result, rerender } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    rerender({ list: [item("a")] });
    expect(result.current.openIndex).toBe(-1);
    expect(result.current.panel).toBeNull();
  });

  it("writes nothing on the way in", () => {
    const { result, onItemsChange } = setup([item("a")]);
    act(() => result.current.toggle(0));
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("reports which object is being edited", () => {
    const { result } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    expect(result.current.isOpen(1)).toBe(true);
    expect(result.current.isOpen(0)).toBe(false);
  });

  it("writes a caption onto the open object alone", () => {
    const { result, onItemsChange } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    act(() => result.current.panel!.props.onCaptionChange("Second"));
    expect(onItemsChange).toHaveBeenCalledWith([
      item("a"),
      item("b", { caption: "Second" }),
    ]);
  });

  it("writes a background effect onto the open object", () => {
    const { result, onItemsChange } = setup([item("a")]);
    act(() => result.current.toggle(0));
    act(() =>
      result.current.panel!.props.onEffectChange(DEFAULT_BACKGROUND_EFFECT),
    );
    expect(onItemsChange).toHaveBeenCalledWith([
      item("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
    ]);
  });

  it("patches layout without dropping what the other controls set", () => {
    const { result, onItemsChange } = setup([item("a", { padding: 16 })]);
    act(() => result.current.toggle(0));
    act(() => result.current.panel!.props.onBorderRadiusChange(8));
    expect(onItemsChange).toHaveBeenCalledWith([
      item("a", { padding: 16, borderRadius: 8 }),
    ]);
  });

  it("hands the panel the open object's own values", () => {
    const { result } = setup([
      item("a"),
      item("b", { caption: "Second", padding: 24 }),
    ]);
    act(() => result.current.toggle(1));
    expect(result.current.panel!.props.caption).toBe("Second");
    expect(result.current.panel!.props.padding).toBe(24);
  });

  it("keys the panel on the object it is editing", () => {
    const { result } = setup([item("a"), item("b")]);
    act(() => result.current.toggle(1));
    expect(result.current.panel!.key).toBe("b");
  });
});
