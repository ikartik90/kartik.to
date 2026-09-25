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
  RedesignDiagram,
  resolveDiagramFit,
  type Arrangement,
  type DiagramRedline,
} from "../redesign-diagram";

afterEach(cleanup);

const REDLINES: DiagramRedline[] = [
  { label: "Cropped region", side: "start", top: 68, spine: 118, tail: 44, attach: 59 },
  { label: "Whole region", side: "end", top: 68, spine: 218, attach: 109 },
];

function Diagram({
  overflows = [],
  ...props
}: {
  cropped?: boolean;
  toggleGap?: number;
  overflows?: Arrangement[];
}) {
  return (
    <RedesignDiagram
      ariaLabel="Fixture layout"
      bodyHeight={190}
      redlines={REDLINES}
      before={{
        children: <p>the old arrangement</p>,
        overflows: overflows.includes("before"),
      }}
      after={{
        children: <p>the new arrangement</p>,
        overflows: overflows.includes("after"),
      }}
      {...props}
    />
  );
}

const pickSegment = (name: string) =>
  fireEvent.click(screen.getByRole("option", { name }));

function presented(pane: HTMLElement): boolean {
  return pane.getAttribute("aria-hidden") !== "true";
}

describe("RedesignDiagram — the toggle", () => {
  it("opens on the arrangement being argued against", () => {
    render(<Diagram />);

    expect(presented(screen.getByTestId("before-pane"))).toBe(true);
    expect(presented(screen.getByTestId("after-pane"))).toBe(false);
    expect(presented(screen.getByTestId("redlines"))).toBe(true);
  });

  it("swaps which arrangement is presented, and takes the redlines with it", () => {
    render(<Diagram />);

    pickSegment("After");

    expect(presented(screen.getByTestId("after-pane"))).toBe(true);
    expect(presented(screen.getByTestId("before-pane"))).toBe(false);
    expect(presented(screen.getByTestId("redlines"))).toBe(false);
  });

  it("keeps both arrangements mounted across the toggle", () => {
    render(<Diagram />);

    pickSegment("After");
    expect(screen.getByTestId("before-pane")).toBeTruthy();

    pickSegment("Before");
    expect(screen.getByTestId("after-pane")).toBeTruthy();
  });

  it("makes the arrangement that is off inert as well as invisible", () => {
    render(<Diagram />);

    expect(screen.getByTestId("after-pane").hasAttribute("inert")).toBe(true);

    pickSegment("After");
    expect(screen.getByTestId("before-pane").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("after-pane").hasAttribute("inert")).toBe(false);
  });
});

describe("RedesignDiagram — how a redline ends", () => {
  const markFor = (label: string) =>
    screen.getByText(label).parentElement?.querySelector("svg");

  it("runs a cropped region on into dots below its spine", () => {
    render(<Diagram />);

    const paths = markFor("Cropped region")?.querySelectorAll("path") ?? [];
    expect(paths).toHaveLength(2);
    expect(paths[1].getAttribute("stroke-dasharray")).toBe("1.5 1.5");
    expect(paths[0].getAttribute("d")).toBe(
      "M8.375 0.375H4.375V59.375M4.375 118.375V59.375M4.375 59.375H0.375",
    );
  });

  it("closes a whole region with a foot tick, and draws no run-on", () => {
    render(<Diagram />);

    const paths = markFor("Whole region")?.querySelectorAll("path") ?? [];
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute("d")).toBe(
      "M8.375 0.375H4.375V109.375M8.375 218.375H4.375V109.375M4.375 109.375H0.375",
    );
  });

  it("sizes the mark to everything it draws, run-on included", () => {
    render(<Diagram />);

    expect(markFor("Cropped region")?.getAttribute("height")).toBe("164.75");
    expect(markFor("Whole region")?.getAttribute("height")).toBe("218.75");
  });
});

describe("RedesignDiagram — the cut at the foot of the block", () => {
  const Cut = () => <Diagram overflows={["before"]} />;

  const cutShown = () =>
    screen.getByTestId("crop-fade").getAttribute("data-presented") !== "false";

  it("draws it for the arrangement that runs past the block, and no other", () => {
    render(<Cut />);
    expect(cutShown()).toBe(true);

    pickSegment("After");
    expect(cutShown()).toBe(false);
  });

  it("keeps it mounted while it withdraws, rather than pulling it", () => {
    render(<Cut />);

    pickSegment("After");
    expect(screen.getByTestId("crop-fade")).toBeTruthy();
  });

  it("draws it for the new arrangement too, when that one is cut as well", () => {
    render(<Diagram overflows={["before", "after"]} />);
    expect(cutShown()).toBe(true);

    pickSegment("After");
    expect(cutShown()).toBe(true);
  });

  it("leaves it undrawn when neither arrangement overflows", () => {
    render(<Diagram />);
    expect(screen.queryByTestId("crop-fade")).toBeNull();
  });

  it("keeps it outside both panes, so it cannot travel with either", () => {
    render(<Cut />);

    const cut = screen.getByTestId("crop-fade");
    expect(screen.getByTestId("before-pane").contains(cut)).toBe(false);
    expect(screen.getByTestId("after-pane").contains(cut)).toBe(false);
    expect(screen.getByTestId("redesign-drawing").contains(cut)).toBe(true);
  });
});

describe("RedesignDiagram — fitting the drawing to the frame", () => {
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

  it("scales the numbered diagram once even that reaches the gutter", () => {
    const available = NUMBERED_WIDTH - 100;

    expect(resolveDiagramFit(available)).toMatchObject({
      annotation: "numbers",
      fit: available / NUMBERED_WIDTH,
    });
  });

  it("never resolves a scale below zero", () => {
    expect(resolveDiagramFit(-200).fit).toBe(0);
  });
});

function renderInFrame(clientWidth: number) {
  const frame = document.createElement("div");
  frame.setAttribute("data-demo-frame", "");
  Object.defineProperty(frame, "clientWidth", {
    value: clientWidth,
    configurable: true,
  });
  document.body.appendChild(frame);
  return render(<Diagram />, { container: frame });
}

/** Both 20px side gutters. */
const GUTTERS = 40;

describe("RedesignDiagram — what a narrowing frame takes", () => {
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
    expect(within(legend).getByText("Cropped region")).toBeTruthy();
    expect(within(legend).getByText("Whole region")).toBeTruthy();
  });

  it("withdraws the legend with the arrangement the redlines annotate", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS);
    expect(presented(screen.getByTestId("redline-legend"))).toBe(true);

    pickSegment("After");
    expect(presented(screen.getByTestId("redline-legend"))).toBe(false);
  });

  it("keeps the numbered diagram unscaled until it too reaches the gutter", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS);

    expect(
      screen.getByTestId("redesign-diagram").style.getPropertyValue("--demo-fit"),
    ).toBe("1");
  });

  it("scales the drawing, and only the drawing", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS - 200);

    const drawing = screen.getByTestId("redesign-drawing");
    expect(drawing.contains(screen.getByTestId("redlines"))).toBe(true);
    expect(drawing.contains(screen.getByTestId("before-pane"))).toBe(true);
    expect(drawing.contains(screen.getByTestId("redline-legend"))).toBe(false);
    expect(drawing.contains(screen.getByRole("listbox"))).toBe(false);
  });

  it("only then scales the contents as they are", () => {
    renderInFrame(NUMBERED_WIDTH + GUTTERS - 100);

    const fit = Number(
      screen.getByTestId("redesign-diagram").style.getPropertyValue("--demo-fit"),
    );
    expect(fit).toBeLessThan(1);
    expect(fit).toBeCloseTo((NUMBERED_WIDTH - 100) / NUMBERED_WIDTH, 5);
    expect(screen.getAllByTestId("redline-badge")).toHaveLength(2);
  });
});

describe("RedesignDiagram — the card holds still", () => {
  it("reserves one card height for both arrangements", () => {
    render(<Diagram />);

    const diagram = screen.getByTestId("redesign-diagram");
    expect(diagram.style.getPropertyValue("--demo-body-height")).toBe("190px");
  });

  it("measures the card from the rows the shell actually draws", () => {
    const cardHeight = () =>
      screen
        .getByTestId("redesign-diagram")
        .style.getPropertyValue("--demo-card-height");

    const { rerender } = render(<Diagram cropped />);
    expect(cardHeight()).toBe("262px");

    rerender(<Diagram />);
    expect(cardHeight()).toBe("418px");
  });

  it("takes the most the drawing hangs below the toggle from the caller", () => {
    const { rerender } = render(<Diagram />);
    expect(
      screen
        .getByTestId("redesign-diagram")
        .style.getPropertyValue("--demo-toggle-gap"),
    ).toBe("76px");

    rerender(<Diagram toggleGap={12} />);
    expect(
      screen
        .getByTestId("redesign-diagram")
        .style.getPropertyValue("--demo-toggle-gap"),
    ).toBe("12px");
  });

  it("fills the height of whatever shape it is being shown at", () => {
    const { rerender } = render(<Diagram />);
    expect(
      screen
        .getByTestId("redesign-diagram")
        .style.getPropertyValue("--demo-frame-height"),
    ).toBe("50cqw");

    rerender(
      <RedesignDiagram
        ariaLabel="Fixture layout"
        bodyHeight={190}
        aspect="1/1"
        redlines={REDLINES}
        before={{ children: <p>the old arrangement</p> }}
        after={{ children: <p>the new arrangement</p> }}
      />,
    );
    expect(
      screen
        .getByTestId("redesign-diagram")
        .style.getPropertyValue("--demo-frame-height"),
    ).toBe("100cqw");
  });
});
