// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BACKGROUND_EFFECT } from "@/domain/nodes";

const shaderProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: (props: Record<string, unknown>) => {
    shaderProps.push(props);
    return <div data-background-effect="" />;
  },
}));

import { BackgroundEffectLayer } from "../background-effect";

afterEach(() => {
  cleanup();
  shaderProps.length = 0;
});

describe("BackgroundEffectLayer", () => {
  // The shader skips a redraw only when every prop is the same as before.
  it("hands the shader the same props when it re-renders with the same effect", () => {
    const view = render(
      <BackgroundEffectLayer effect={DEFAULT_BACKGROUND_EFFECT} className="ground" />,
    );
    view.rerender(
      <BackgroundEffectLayer effect={DEFAULT_BACKGROUND_EFFECT} className="ground" />,
    );
    const [first, second] = shaderProps;
    for (const key of Object.keys(first)) {
      expect(second[key], key).toBe(first[key]);
    }
  });
});
