import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Div, TAILWIND } from "../ds-tailwind";

describe("an example's layout, written in Tailwind's classes and drawn by Panda", () => {
  it("draws each class it knows", () => {
    for (const name of Object.keys(TAILWIND)) {
      const { container, unmount } = render(<Div tw={name}>x</Div>);
      expect(container.firstElementChild!.className, name).not.toBe("");
      unmount();
    }
  });

  it("refuses a class it has no Panda style for", () => {
    expect(() => render(<Div tw="flex mt-7">x</Div>)).toThrow(/mt-7/);
  });
});
