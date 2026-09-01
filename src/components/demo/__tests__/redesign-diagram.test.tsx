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

// Two marks that between them cover both endings the stage can draw: one that
// runs on into dots because the card crops it, and one that closes with a foot
// tick because the region it brackets actually ends.
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
  /** Which arrangements run past the foot of the block. */
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

/**
 * Which of the two arrangements is being SHOWN. Both stay mounted so the toggle
 * can morph between them, so "presented" is a state the pane carries rather
 * than a question of whether it exists.
 */
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
    // The marks annotate the OLD arrangement, so they withdraw with it.
    expect(presented(screen.getByTestId("redlines"))).toBe(false);
  });

  // A pane that unmounted the moment it went off would have nothing left to
  // fade OUT — the morph would read as a hard cut with a delay in front of it.
  it("keeps both arrangements mounted across the toggle", () => {
    render(<Diagram />);

    pickSegment("After");
    expect(screen.getByTestId("before-pane")).toBeTruthy();

    pickSegment("Before");
    expect(screen.getByTestId("after-pane")).toBeTruthy();
  });

  // Only one arrangement is on show, so only one may be reached — by a pointer,
  // by a screen reader, or by the tab key.
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

  // The mark's foot carries the whole meaning of the mark. A bracket that
  // closes with a tick has said everything it had to say; one that trails off
  // into dots is pointing at something the card cut in half.
  it("runs a cropped region on into dots below its spine", () => {
    render(<Diagram />);

    const paths = markFor("Cropped region")?.querySelectorAll("path") ?? [];
    expect(paths).toHaveLength(2);
    expect(paths[1].getAttribute("stroke-dasharray")).toBe("1.5 1.5");
    // Opened at the top, and NOT closed at the bottom — 118 is where the solid
    // run stops, and the only move at that point is back up to the leader.
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

  // The mark stands as tall as its spine plus the 2px break and the run-on, and
  // the caption hangs off the leader tick wherever the caller put it.
  it("sizes the mark to everything it draws, run-on included", () => {
    render(<Diagram />);

    expect(markFor("Cropped region")?.getAttribute("height")).toBe("164.75");
    expect(markFor("Whole region")?.getAttribute("height")).toBe("218.75");
  });
});

describe("RedesignDiagram — the cut at the foot of the block", () => {
  const Cut = () => <Diagram overflows={["before"]} />;

  // The cut is decorative and permanently `aria-hidden`, so unlike a pane its
  // state is carried by `data-presented` alone.
  const cutShown = () =>
    screen.getByTestId("crop-fade").getAttribute("data-presented") !== "false";

  it("draws it for the arrangement that runs past the block, and no other", () => {
    render(<Cut />);
    expect(cutShown()).toBe(true);

    pickSegment("After");
    expect(cutShown()).toBe(false);
  });

  // It stays MOUNTED across the toggle, because on the way out it has to outlive
  // the arrangement it belongs to — dropping it the instant the toggle moves
  // takes the gradient off content that is still fully there.
  it("keeps it mounted while it withdraws, rather than pulling it", () => {
    render(<Cut />);

    pickSegment("After");
    expect(screen.getByTestId("crop-fade")).toBeTruthy();
  });

  // Which arrangement is cut is a fact about the LAYOUT, not about the card:
  // one comparison crops both of its arrangements, another only the old one.
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

  // The mechanism, not the look: a child cannot opt out of its parent's opacity
  // or transform, so a cut INSIDE the pane would fade and slide in with the old
  // arrangement instead of being the edge that arrangement is cut against.
  // Sitting outside both panes is what lets it appear the instant the toggle
  // moves.
  it("keeps it outside both panes, so it cannot travel with either", () => {
    render(<Cut />);

    const cut = screen.getByTestId("crop-fade");
    expect(screen.getByTestId("before-pane").contains(cut)).toBe(false);
    expect(screen.getByTestId("after-pane").contains(cut)).toBe(false);
    // Still inside the card, though — it is the block's own bottom edge.
    expect(screen.getByTestId("redesign-drawing").contains(cut)).toBe(true);
  });
});

describe("RedesignDiagram — fitting the drawing to the frame", () => {
  // The frame gives the drawing its width less a 20px gutter on each side, and
  // the drawing spends that room in the order its annotations can afford to
  // lose it: the labels go first, the drawing itself last.
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
  return render(<Diagram />, { container: frame });
}

/** The gutter the demo area keeps on each side, both of them. */
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
      screen.getByTestId("redesign-diagram").style.getPropertyValue("--demo-fit"),
    ).toBe("1");
  });

  // The toggle is a control and the legend is a key: both are chrome around the
  // picture, both have room to spare at every width the picture runs out at, and
  // neither gets smaller just because the drawing had to. Only the drawing is
  // inside the box the scale is applied to.
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
    // Scaled, not re-annotated: the numbers are still what is drawn.
    expect(screen.getAllByTestId("redline-badge")).toHaveLength(2);
  });
});

describe("RedesignDiagram — the card holds still", () => {
  // A box that resized mid-morph would make the change look like it was about
  // the box. Both panes are laid over one BODY of the caller's stated height,
  // and the card the frame reserves room for is that plus the shell's own rows.
  it("reserves one card height for both arrangements", () => {
    render(<Diagram />);

    const diagram = screen.getByTestId("redesign-diagram");
    expect(diagram.style.getPropertyValue("--demo-body-height")).toBe("190px");
  });

  // A card that ends at a tear is its header, the body, and the closing edge:
  // 52 + 190 + 20. The whole dialog adds the action bar, the form surface's
  // inset above and below the body, and three more torn bands — one under the
  // header and the form's own two — for 418.
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

  // The MOST the drawing hangs below the toggle is the Figma's own and varies by
  // design, so it is the caller's to state — and it scales with the drawing,
  // since the distance from a control to the picture it drives belongs to the
  // composition. It is a ceiling on the spring above the drawing rather than a
  // distance: what the air actually comes to is a layout question, and layout
  // is not something jsdom answers.
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

  // The column fills the frame's content box so the demo area has no slack to
  // centre, which is what puts the toggle at the TOP where the Figma draws it.
  // The share it fills is the SHAPE's, not a constant: a demo shown at 3/2 is
  // two thirds as tall as it is wide, and one at 2/1 is half.
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
