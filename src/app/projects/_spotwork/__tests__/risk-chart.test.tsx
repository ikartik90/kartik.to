import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpiderChart } from "../risk-chart";
import { Chip, Pill, Typography } from "../ui";

afterEach(cleanup);

const chart = (details?: boolean) => (
  <SpiderChart name="Brittany Pilz" details={details}>
    <Typography variant="metadata">No-show risk</Typography>
    <Chip size="small" state="warning">Medium</Chip>
    <SpiderChart.Factor level={2}>
      {details && <Typography variant="body">5th shift</Typography>}
      {details && <Chip size="small" state="warning">Medium</Chip>}
      <Typography variant="metadata">New worker</Typography>
    </SpiderChart.Factor>
    <SpiderChart.Factor level={0}>
      {details && <Typography variant="body">No request</Typography>}
      {details && <Typography variant="metadata">None</Typography>}
      <Typography variant="metadata">Cancellation request</Typography>
    </SpiderChart.Factor>
  </SpiderChart>
);

describe("a spider chart", () => {
  it("heads its chart with its title and level, named by them and each factor's name and level", () => {
    const { container } = render(chart());
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Brittany Pilz's no-show risk: Medium. New worker: Medium, Cancellation request: None.",
    );
    expect(container.textContent).toBe("No-show riskMediumNew workerCancellation request");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("takes its caution colours from its factors' levels", () => {
    const { container } = render(chart());
    expect(container.querySelector("[data-risk]")?.getAttribute("data-tone")).toBe("warning");
  });

  it("heads a card with its heading, its level in a pill beside it and its action at the end, named by them", () => {
    render(
      <SpiderChart name="Brittany Pilz">
        <Typography tag="h3" variant="heading">Risk factor</Typography>
        <Pill state="warning">Medium</Pill>
        <button type="button">Acknowledge</button>
        <SpiderChart.Factor level={2}>
          <Typography variant="metadata">New worker</Typography>
        </SpiderChart.Factor>
      </SpiderChart>,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Brittany Pilz's risk factor: Medium. New worker: Medium.");
    const head = screen.getByRole("heading").parentElement!;
    expect([...head.children].map((each) => each.textContent)).toEqual(["Risk factor", "Medium", "Acknowledge"]);
  });

  it("lists each factor's reading, level and name beside the chart with its details", () => {
    render(chart(true));
    expect(screen.getAllByRole("listitem").map((item) => [item.textContent, item.dataset.level])).toEqual([
      ["5th shiftMediumNew worker", "2"],
      ["No requestNoneCancellation request", "0"],
    ]);
  });
});
