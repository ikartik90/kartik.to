import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Wireframe } from "@/components/ui/wireframe";
import { Avatar } from "../data-table";
import { LOGOS } from "../data";
import { Button, Chip, Pill, Spotscore, Typography, glyph } from "../ui";

afterEach(cleanup);

const bars = (root: Element) => [...root.querySelectorAll("[data-skeleton]")];
const loading = (children: React.ReactNode) => render(<Wireframe mode="loading">{children}</Wireframe>).container;

describe("SW Curie's parts loading", () => {
  it("bar each run of a Typography's words in gray, its other parts standing", () => {
    const root = loading(
      <Typography variant="metadata">
        {"4:30 PM"}–{"1:30 AM"}
        <svg data-icon="" />
        {3} notes
      </Typography>,
    );
    expect(bars(root).map((bar) => bar.textContent)).toEqual(["4:30 PM–1:30 AM", "3 notes"]);
    expect(bars(root).every((bar) => bar.classList.contains(glyph.disabled))).toBe(true);
    expect(root.querySelector("[data-icon]")).not.toBeNull();
  });

  it("bar a button's words in its own colour, its icon standing", () => {
    const root = loading(
      <Button size="small" emphasis="secondary">
        <svg data-icon="" />
        {`Check-in: ${3725}`}
      </Button>,
    );
    expect(bars(root).map((bar) => bar.textContent)).toEqual(["Check-in: 3725"]);
    expect(bars(root)[0].classList.contains(glyph.disabled)).toBe(false);
    expect(root.querySelector("button > svg[data-icon]")).not.toBeNull();
  });

  it("bar a pill's, a chip's and a Spotscore's words, gray however they're toned", () => {
    const root = loading(
      <>
        <Pill state="alert">
          <svg data-icon="" />
          Absent
        </Pill>
        <Chip size="small" state="alert">{`${2} Unread`}</Chip>
        <Spotscore tier="elite">96</Spotscore>
      </>,
    );
    expect(bars(root).map((bar) => bar.textContent)).toEqual(["Absent", "2 Unread", "Elite", "96"]);
    expect(root.querySelector("[data-shape=pill] > svg[data-icon]")).not.toBeNull();
  });

  it("draw a picture as a blank of its shape", () => {
    const root = loading(
      <>
        <Avatar src={LOGOS["Canada Cartage"]} type="company" />
        <Avatar>JP</Avatar>
      </>,
    );
    const avatars = [...root.querySelectorAll("[data-avatar]")];
    expect(avatars.map((avatar) => [avatar.getAttribute("data-type"), avatar.innerHTML])).toEqual([
      ["company", '<span data-blank=""></span>'],
      [null, '<span data-blank=""></span>'],
    ]);
  });

  it("stay as they are in a placeholder", () => {
    const root = render(
      <Wireframe>
        <Button>{`Check-in: ${3725}`}</Button>
        <Avatar src={LOGOS["Canada Cartage"]} type="company" />
      </Wireframe>,
    ).container;
    expect(bars(root)).toEqual([]);
    expect(root.querySelector("[data-blank]")).toBeNull();
  });
});
