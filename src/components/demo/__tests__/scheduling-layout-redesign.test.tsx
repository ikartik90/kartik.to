// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import {
  LABELLED_WIDTH,
  NUMBERED_WIDTH,
  resolveDiagramFit,
  SchedulingLayoutRedesign,
} from "../scheduling-layout-redesign";

afterEach(cleanup);

/**
 * Which of the two arrangements is being SHOWN. Both stay mounted so the toggle
 * can morph between them, so "presented" is a state the pane carries rather
 * than a question of whether it exists.
 */
function presented(pane: HTMLElement): boolean {
  return pane.getAttribute("aria-hidden") !== "true";
}

const pickSegment = (name: string) =>
  fireEvent.click(screen.getByRole("option", { name }));

const selectedSegments = () =>
  screen
    .getAllByRole("option")
    .filter((option) => option.getAttribute("aria-selected") === "true")
    .map((option) => option.textContent);

describe("SchedulingLayoutRedesign — the toggle", () => {
  it("opens on the arrangement being argued against", () => {
    render(<SchedulingLayoutRedesign />);

    expect(selectedSegments()).toEqual(["Before"]);
    expect(presented(screen.getByTestId("before-pane"))).toBe(true);
    expect(presented(screen.getByTestId("after-pane"))).toBe(false);
  });

  it("swaps which arrangement is presented when the other segment is picked", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");

    expect(selectedSegments()).toEqual(["After"]);
    expect(presented(screen.getByTestId("after-pane"))).toBe(true);
    expect(presented(screen.getByTestId("before-pane"))).toBe(false);
  });

  it("goes back, so the comparison can be read in either direction", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");
    pickSegment("Before");

    expect(selectedSegments()).toEqual(["Before"]);
    expect(presented(screen.getByTestId("before-pane"))).toBe(true);
  });

  // The two arrangements cross-fade into each other, and a pane that unmounted
  // the moment it went off would have nothing left to fade OUT — the morph
  // would read as a hard cut with a delay in front of it.
  it("keeps both arrangements mounted across the toggle", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");
    expect(screen.getByTestId("before-pane")).toBeTruthy();

    pickSegment("Before");
    expect(screen.getByTestId("after-pane")).toBeTruthy();
  });
});

describe("SchedulingLayoutRedesign — what each arrangement says", () => {
  // The redlines ARE the argument about the old layout: two separate concerns
  // bracketed on either side of one screen.
  it("redlines the two concerns the old screen crams together", () => {
    render(<SchedulingLayoutRedesign />);

    const redlines = screen.getByTestId("redlines");
    expect(within(redlines).getByText("Shift Information")).toBeTruthy();
    expect(within(redlines).getByText("Shift Planning")).toBeTruthy();
  });

  it("withdraws the redlines with the arrangement they annotate", () => {
    render(<SchedulingLayoutRedesign />);
    expect(presented(screen.getByTestId("redlines"))).toBe(true);

    pickSegment("After");
    expect(presented(screen.getByTestId("redlines"))).toBe(false);
  });

  it("names the three steps the redesign splits that screen into", () => {
    render(<SchedulingLayoutRedesign />);

    const after = screen.getByTestId("after-pane");
    expect(
      within(after)
        .getAllByTestId("step-name")
        .map((name) => name.textContent),
    ).toEqual(["Shift Information", "Shift Planning", "Review Shift Summary"]);
  });

  // The first two steps are the two concerns the redline brackets called out,
  // in that order — which is the whole point the pair of frames is making.
  it("carries the redlined concerns over as the first two steps", () => {
    render(<SchedulingLayoutRedesign />);

    const redlined = within(screen.getByTestId("redlines"))
      .getAllByTestId("redline-label")
      .map((label) => label.textContent);
    const steps = within(screen.getByTestId("after-pane"))
      .getAllByTestId("step-name")
      .map((name) => name.textContent);

    expect(steps.slice(0, 2)).toEqual(redlined);
  });
});

describe("SchedulingLayoutRedesign — a diagram, not a wizard", () => {
  it("offers nothing in the new arrangement to press", () => {
    render(<SchedulingLayoutRedesign />);
    pickSegment("After");

    const after = screen.getByTestId("after-pane");
    expect(within(after).queryAllByRole("button")).toHaveLength(0);
    expect(within(after).queryAllByRole("tab")).toHaveLength(0);
  });

  it("offers nothing in the old arrangement to press either", () => {
    render(<SchedulingLayoutRedesign />);

    const before = screen.getByTestId("before-pane");
    expect(within(before).queryAllByRole("button")).toHaveLength(0);
    expect(within(before).queryAllByRole("combobox")).toHaveLength(0);
  });

  // The segmented control is the ONE live thing on the stage, so it is the one
  // thing a keyboard can reach. The wireframed fields are REAL controls — a
  // Combobox button, a Checkbox button — so they are still in the DOM; what
  // keeps them out of the tab order is the `inert` their scope carries, and
  // that is the thing worth pinning.
  it("leaves the segmented control as the only reachable control", () => {
    const { container } = render(<SchedulingLayoutRedesign />);

    const reachable = Array.from(
      container.querySelectorAll(
        "a[href], button, input, select, textarea, [tabindex]",
      ),
    ).filter((node) => !node.closest("[inert]"));

    expect(
      reachable.every((node) => node.closest('[role="listbox"]') !== null),
    ).toBe(true);
    expect(reachable.length).toBeGreaterThan(0);
  });
});

describe("SchedulingLayoutRedesign — fitting the diagram to the frame", () => {
  // The frame gives the diagram its width less a 20px gutter on each side, and
  // the diagram spends that room in the order the redesign's own annotations
  // can afford to lose it: the labels go first, the drawing itself last.
  it("draws the labelled diagram at full size while it clears the gutter", () => {
    expect(resolveDiagramFit(LABELLED_WIDTH)).toMatchObject({
      annotation: "labels",
      width: LABELLED_WIDTH,
      fit: 1,
    });
  });

  it("never draws it LARGER than the Figma does, however wide the frame", () => {
    expect(resolveDiagramFit(LABELLED_WIDTH + 400)).toMatchObject({
      annotation: "labels",
      fit: 1,
    });
  });

  // The first boundary: the labels are what the gutter takes, not the drawing.
  it("numbers the redlines rather than scaling once the labels reach it", () => {
    expect(resolveDiagramFit(LABELLED_WIDTH - 1)).toMatchObject({
      annotation: "numbers",
      width: NUMBERED_WIDTH,
      fit: 1,
    });
  });

  it("holds the numbered diagram at full size down to its own gutter", () => {
    expect(resolveDiagramFit(NUMBERED_WIDTH)).toMatchObject({
      annotation: "numbers",
      fit: 1,
    });
  });

  // The second boundary, and only here: nothing is left to give up but size.
  it("scales the numbered diagram once even that reaches the gutter", () => {
    const available = NUMBERED_WIDTH - 100;

    expect(resolveDiagramFit(available)).toMatchObject({
      annotation: "numbers",
      fit: available / NUMBERED_WIDTH,
    });
  });

  // A frame measured mid-collapse reports nothing to fit into. A negative
  // scale would MIRROR the diagram rather than hide it.
  it("never resolves a scale below zero", () => {
    expect(resolveDiagramFit(-200).fit).toBe(0);
  });

  // The legend the numbers need is drawn UNDER the diagram, so the box the
  // frame measures has to reserve room for it.
  it("reserves height for the legend only when the numbers need one", () => {
    expect(resolveDiagramFit(NUMBERED_WIDTH).height).toBeGreaterThan(
      resolveDiagramFit(LABELLED_WIDTH).height,
    );
  });
});

/**
 * Mount the diagram inside a stand-in demo frame of a given inner width — what
 * the component measures itself against. Outside one it has nothing to fit to.
 */
function renderInFrame(clientWidth: number) {
  const frame = document.createElement("div");
  frame.setAttribute("data-demo-frame", "");
  Object.defineProperty(frame, "clientWidth", {
    value: clientWidth,
    configurable: true,
  });
  document.body.appendChild(frame);
  return render(<SchedulingLayoutRedesign />, { container: frame });
}

/** The gutter the demo area keeps on each side, both of them. */
const GUTTERS = 40;

describe("SchedulingLayoutRedesign — what a narrowing frame takes", () => {
  it("labels the redlines, and needs no legend, while there is room", () => {
    renderInFrame(LABELLED_WIDTH + GUTTERS);

    expect(screen.getAllByTestId("redline-label")).toHaveLength(2);
    expect(screen.queryByTestId("redline-legend")).toBeNull();
  });

  it("swaps the labels for numbers, and says what they mean, below that", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS);

    expect(screen.queryAllByTestId("redline-label")).toHaveLength(0);
    expect(
      screen.getAllByTestId("redline-badge").map((b) => b.textContent),
    ).toEqual(["1", "2"]);

    const legend = screen.getByTestId("redline-legend");
    expect(within(legend).getByText("Shift Information")).toBeTruthy();
    expect(within(legend).getByText("Shift Planning")).toBeTruthy();
  });

  // The legend belongs to the redlines, so it goes when they do — a key to
  // marks that are no longer on screen is a key to nothing.
  it("withdraws the legend with the arrangement the redlines annotate", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS);
    expect(presented(screen.getByTestId("redline-legend"))).toBe(true);

    pickSegment("After");
    expect(presented(screen.getByTestId("redline-legend"))).toBe(false);
  });

  it("keeps the numbered diagram unscaled until it too reaches the gutter", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS);

    expect(
      screen.getByTestId("scheduling-diagram").style.getPropertyValue("--demo-fit"),
    ).toBe("1");
  });

  it("only then scales the contents as they are", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS - 100);

    const fit = Number(
      screen.getByTestId("scheduling-diagram").style.getPropertyValue("--demo-fit"),
    );
    expect(fit).toBeLessThan(1);
    expect(fit).toBeCloseTo((NUMBERED_WIDTH - 100) / NUMBERED_WIDTH, 5);
    // Scaled, not re-annotated: the numbers are still what is drawn.
    expect(screen.getAllByTestId("redline-badge")).toHaveLength(2);
  });
});
