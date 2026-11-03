import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInsApp, type Page } from "../check-ins-app";
import { clock, minutesNow, parseClock, shiftStart } from "../data";
import { departure, leftSiteNote, rowsFor } from "../dashboard";
import { PLAY_STEP } from "../location-history";
import { useDemo } from "../demo";
import { BUILDING, GOODLEAF_TEMPLATES, demoFencesOf, demoOf } from "../demos";
import { alongEdge, fromWorldPixel, worldPixel, type LatLng, type Point } from "../geofence";
import type { Version } from "../new-shift";
import { postedMessage } from "../shifts";
import { SOURCES } from "../timesheet";
import { GOODLEAF_PLACE } from "../geo";
import { presetsSeed } from "../presets";
import { findNearby, withSkills } from "../worker-pool";
import { DEMO, SNACKS } from "../copy";
import type { Choice } from "../project-nav";
import { planDemoSweep } from "@/components/demo/shift-scheduling-v2";
import { Temporal } from "@js-temporal/polyfill";

// jsdom lays nothing out: dates sit on a grid a month apart, everything else in one box around them, so the date
// strip's marquee covers what the demo drags across.
const DAY = 40;
const MONTH = 8 * DAY;
function box(this: Element) {
  const date = this instanceof HTMLElement && this.matches("button[data-date]:not([data-outside])") ? this.dataset.date : null;
  if (!date) return { x: -5000, y: -5000, left: -5000, top: -5000, right: 15000, bottom: 15000, width: 20000, height: 20000 };
  const [year, month, day] = date.split("-").map(Number);
  const now = new Date();
  const months = (year - now.getFullYear()) * 12 + month - 1 - now.getMonth();
  const left = months * MONTH + new Date(Date.UTC(year, month - 1, day)).getUTCDay() * DAY;
  const top = Math.floor((day - 1 + new Date(Date.UTC(year, month - 1, 1)).getUTCDay()) / 7) * DAY;
  return { x: left, y: top, left, top, right: left + DAY - 4, bottom: top + DAY - 4, width: DAY - 4, height: DAY - 4 };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(box as () => DOMRect);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const PAGES: Record<string, Page> = { final: "shifts", recurrence: "shifts", old: "shifts", company: "check-ins", admin: "dashboard", activation: "activations" };

function Harness({ choice, name, from }: { choice: Choice; name?: string; from?: Page }) {
  const stage = useRef<HTMLDivElement>(null);
  const demo = useDemo(stage);
  return (
    <>
      <button onClick={() => demo.play(demoOf(choice, () => stage.current, name) ?? [])}>Play</button>
      <div ref={stage}>
        <CheckInsApp
          fences={demoFencesOf(choice, name)}
          anchor={shiftStart(new Date())}
          width={1440}
          height={900}
          initialPage={from ?? PAGES[choice.version!]}
          shiftVersion={choice.version && PAGES[choice.version] === "shifts" ? (choice.version as Version) : undefined}
        />
      </div>
    </>
  );
}

/** Plays the demo through, returning the snackbars the app showed on the way: they hide themselves again. */
async function play(choice: Choice, snackbar = /\d+ shifts? posted/, name?: string, from?: Page) {
  render(<Harness choice={choice} name={name} from={from} />);
  const shown = new Set<string>();
  const watch = new MutationObserver(() => {
    const said = document.body.textContent?.match(snackbar)?.[0];
    if (said) shown.add(said);
  });
  watch.observe(document.body, { subtree: true, childList: true, characterData: true });
  fireEvent.click(screen.getByText("Play"));
  for (let t = 0; t < 60_000; t += 100) await act(() => vi.advanceTimersByTimeAsync(100));
  watch.disconnect();
  return [...shown];
}

const named = (element: Element) => element.getAttribute("aria-label") ?? element.textContent?.trim();

/** The first presses of the demo played from `from`. */
async function firstPresses(choice: Choice, from: Page, name?: string) {
  render(<Harness choice={choice} name={name} from={from} />);
  fireEvent.click(screen.getByText("Play"));
  const pressed: (string | undefined)[] = [];
  const press = (event: Event) => pressed.push(named((event.target as Element).closest("button") ?? (event.target as Element)));
  document.addEventListener("click", press);
  for (let t = 0; t < 8_000; t += 100) await act(() => vi.advanceTimersByTimeAsync(100));
  document.removeEventListener("click", press);
  return pressed.slice(0, 3);
}

describe("a demo started on a page of its project", () => {
  it("goes from Companies to Shifts on the shut sidebar's rail and starts on New shift", async () => {
    expect((await firstPresses({ project: "activation-and-retention", version: "final" }, "activations")).slice(0, 2)).toEqual(["Shifts", "New shift..."]);
  });

  it("starts on New shift when Shifts is already open", async () => {
    expect((await firstPresses({ project: "activation-and-retention", version: "recurrence" }, "shifts"))[0]).toBe("New shift...");
  });

  it("goes to Companies from Manage worker pool", async () => {
    expect((await firstPresses({ project: "activation-and-retention", version: "activation" }, "pool")).slice(0, 2)).toEqual(["Companies", "GoodLeaf Farms"]);
  });

  it("starts on GoodLeaf Farms when Companies is already open", async () => {
    expect((await firstPresses({ project: "activation-and-retention", version: "activation" }, "activations"))[0]).toBe("GoodLeaf Farms");
  });

  it("presses an open sidebar's item first", async () => {
    expect((await firstPresses({ project: "check-ins", version: "admin" }, "check-ins")).slice(0, 1)).toEqual(["Check-ins dashboard"]);
  });

  it("goes to the Overview page from Timesheets", async () => {
    expect((await firstPresses({ project: "check-ins", version: "company" }, "timesheets")).slice(0, 1)).toEqual(["Overview"]);
  });

  it("starts on Rayna's hours when Timesheets is already open", async () => {
    const [first] = await firstPresses({ project: "check-ins", version: "company" }, "timesheets", "timesheet");
    expect(["Menu", "Timesheets"]).not.toContain(first);
  });

  it("posts the shifts it drags, played from Companies", async () => {
    const swept = planDemoSweep(Temporal.Now.plainDateISO().add({ months: 1 })).dates.length;
    expect(await play({ project: "activation-and-retention", version: "final" }, undefined, undefined, "activations")).toEqual([postedMessage(swept)]);
  }, 30_000);
});

describe("which projects have a demo", () => {
  it("is every version of Activation and retention", () => {
    for (const version of ["activation", "final", "recurrence", "old"])
      expect(demoOf({ project: "activation-and-retention", version }, () => null)?.length).toBeGreaterThan(0);
  });

  it("is both of Check-ins' versions", () => {
    for (const choice of [{ project: "check-ins", version: "company" }, { project: "check-ins", version: "admin" }])
      expect(demoOf(choice, () => null)?.length).toBeGreaterThan(0);
    expect(demoOf({ project: "check-ins", version: "admin" }, () => null, "risk")?.length).toBeGreaterThan(0);
  });
  it("isn't the design system", () => {
    expect(demoOf({ project: "design-system" }, () => null)).toBeUndefined();
  });
});

describe("Scheduling shift", () => {
  // As many as the live sheet's Drag to select: next month's full Monday-to-Friday weeks, one date swapped.
  const swept = () => planDemoSweep(Temporal.Now.plainDateISO().add({ months: 1 })).dates.length;

  it("drags next month's full weeks in the final version, swaps a Wednesday for a Saturday, and posts as many as the live sheet", async () => {
    expect(await play({ project: "activation-and-retention", version: "final" })).toEqual([postedMessage(swept())]);
  }, 30_000);

  it("repeats tomorrow's shift on four weekdays until it makes the live sheet's 25 in the recurrence concept", async () => {
    expect(await play({ project: "activation-and-retention", version: "recurrence" })).toEqual([postedMessage(25)]);
  }, 30_000);

  it("picks Monday, Wednesday and Friday on the old design's calendar", async () => {
    expect(await play({ project: "activation-and-retention", version: "old" })).toEqual([postedMessage(3)]);
  }, 30_000);
});

const row = (worker: string) => document.querySelector<HTMLElement>(`[data-worker="${worker}"]`)!;

describe("Check-ins", () => {
  it("checks Maria in late but excused on the company's page, then marks Aspen absent, excused", async () => {
    await play({ project: "check-ins", version: "company" });
    const maria = [...row("Maria Franci").querySelectorAll("button")].map(named);
    expect(maria).toContain("Edit check-in");
    expect(maria).not.toContain("Check in...");
    expect(row("Aspen Curtis").textContent).toContain("Absent");
  }, 30_000);

  it("scrubs where Brittany has been from her 13th report to her 20th, back to when she left the job site, then asks her if she's coming back", async () => {
    // A minute before the dashboard's rows move on a quarter hour, which the demo plays past.
    const opened = new Date(2026, 10, 3, 23, 10, 30);
    vi.setSystemTime(opened);
    // The timeline's handle each time it moves, and when.
    const moves: number[] = [];
    const times: number[] = [];
    const watch = new MutationObserver(() => {
      const handle = document.querySelector('[role=dialog][aria-label^="View location"] [role=slider]');
      const at = Number(handle?.getAttribute("aria-valuenow") ?? NaN);
      if (Number.isNaN(at) || moves.at(-1) === at) return;
      moves.push(at);
      times.push(Date.now());
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-valuenow"] });
    let presses = 0;
    const press = (event: Event) => {
      if ((event.target as Element).closest?.("[data-track]")) presses += 1;
    };
    document.addEventListener("pointerdown", press);
    await play({ project: "check-ins", version: "admin" });
    watch.disconnect();
    document.removeEventListener("pointerdown", press);

    // As the dashboard laid them out when it opened.
    const brittany = rowsFor(minutesNow(shiftStart(opened), opened)).today.find((each) => each.id === "brittany")!;
    const last = brittany.trace!.length - 1;
    const left = brittany.trace!.indexOf(departure(brittany)!);
    const through = (from: number, to: number) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + Math.sign(to - from) * i);
    // Opened on her last report, pressed at her 13th and scrubbed through to her 20th, then back to the one she left at.
    expect(moves).toEqual([last, ...through(12, 19), ...through(18, left)]);
    // In one press, forward slow enough for the map, each report shown for at least half of Play's step; back quicker.
    expect(presses).toBe(1);
    const shown = times.slice(1).map((time, i) => time - times[i]);
    const forward = shown.slice(1, 8);
    expect(Math.min(...forward)).toBeGreaterThanOrEqual(PLAY_STEP / 2);
    expect(Math.max(...shown.slice(9))).toBeLessThan(Math.min(...forward));
    // The message sent is among her notes, the three she had and it, with the note on when she left.
    expect(row("Brittany Pilz").textContent).toContain("4 notes");
    fireEvent.click(within(row("Brittany Pilz")).getByRole("button", { name: "4 notes" }));
    const sheet = screen.getByRole("dialog", { name: "Brittany Pilz" });
    expect(within(sheet).getByRole("tab", { selected: true }).textContent).toMatch(/^Notes & history/);
    expect(within(sheet).getAllByText(leftSiteNote(clock(departure(brittany)!.at)))).toHaveLength(2);
  }, 30_000);
});

describe("Geofence", () => {
  const start = demoFencesOf({ project: "check-ins", version: "company" }, "geofence")!.picker;

  // The corners drawn on the wide map, and whether they're `places` as the map draws them: flat and north-up, a
  // place's point is its world pixel scaled and moved, so two of them place the rest.
  const drawn = () =>
    document
      .querySelector("[data-map][data-size=wide] polygon")!
      .getAttribute("points")!
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
  const drawsAt = (corners: number[][], places: LatLng[]) => {
    const world = places.map((place) => worldPixel(place, 0));
    const [[px, py], [qx, qy]] = [corners[0], corners[2]];
    const scale = Math.hypot(qx - px, qy - py) / Math.hypot(world[2].x - world[0].x, world[2].y - world[0].y);
    const at = ({ x, y }: Point) => [px + (x - world[0].x) * scale, py + (y - world[0].y) * scale];
    return world.every((place, i) => Math.hypot(at(place)[0] - corners[i][0], at(place)[1] - corners[i][1]) < 0.5);
  };

  // Where the wall from `a` to `b` passes nearest `place`.
  const nearest = (a: LatLng, b: LatLng, place: LatLng) => {
    const [p, q, at] = [a, b, place].map((each) => worldPixel(each, 0));
    return fromWorldPixel(alongEdge(p, q, at, 0), 0);
  };

  it("adds the step in its north-west wall and the bend in its south-west wall where the walls pass nearest them, moves two corners onto CCLS's building, then saves", async () => {
    expect(start).toHaveLength(6);
    // Each change to the outline: a corner added, or one moved, by its index.
    const edits: string[] = [];
    let last: number[][] | null = null;
    const watch = new MutationObserver(() => {
      if (!document.querySelector("[data-map][data-size=wide] polygon")) return;
      const now = drawn();
      const changed = now.flatMap((point, i) => (last && (!last[i] || point.some((value, axis) => value !== last![i][axis])) ? [i] : []));
      const edit = last && (now.length > last.length ? `add ${changed[0]}` : changed.length ? `move ${changed.join()}` : null);
      if (edit && edits.at(-1) !== edit) edits.push(edit);
      last = now;
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["points"] });
    const shown = await play({ project: "check-ins", version: "company" }, /Template updated/, "geofence");
    watch.disconnect();
    expect(shown).toEqual(["Template updated"]);
    // The step's far corner before any is moved, the north corner moved onto the building, the step's near corner
    // added and moved there; the bend added, and the south corner moved.
    expect(edits).toEqual(["add 6", "move 5", "add 6", "move 6", "add 1", "move 2"]);

    const card = [...document.querySelectorAll("[role=listitem]")].find((each) => each.querySelector("h2")?.textContent === "Picker Packer")!;
    fireEvent.click(card.querySelector("button[aria-label=Edit]")!);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click([...document.querySelectorAll("button")].find((each) => each.lastElementChild?.textContent === "Address & wage")!);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const corners = drawn();
    expect(corners).toHaveLength(9);
    const bend = nearest(start[0], start[1], BUILDING[1]);
    const step = nearest(start[5], start[0], BUILDING[8]);
    expect(drawsAt(corners, [BUILDING[0], bend, ...BUILDING.slice(2, 8), step])).toBe(true);
    // Not where it started.
    expect(drawsAt(corners.slice(0, 6), start)).toBe(false);
  }, 60_000);
});

describe("Risk signals", () => {
  it("shows Brittany's high risk factor, then Sikander's medium one and Jeff's low one, pointing at their factors and acknowledging their unread risk on the way", async () => {
    render(<Harness choice={{ project: "check-ins", version: "admin" }} name="risk" />);
    const workers = ["Brittany Pilz", "Sikander Mazumdar", "Jeff Gwartzmann"];
    // The table's Risk factor column.
    const risk = (worker: string) => row(worker).querySelectorAll("[role=cell]")[4];
    for (const worker of workers) expect(risk(worker).textContent).toContain("1 Unread");
    const seen: string[] = [];
    const pointed = new Set<string>();
    const watch = new MutationObserver(() => {
      const sheet = document.querySelector("[role=dialog][aria-label]");
      const tone = sheet?.querySelector("[data-risk]")?.getAttribute("data-tone");
      const acknowledged = sheet?.querySelector("[aria-label='Risk factor'] [role=checkbox]")?.getAttribute("aria-checked") === "true";
      const now = `${sheet?.getAttribute("aria-label")} ${tone}${acknowledged ? " acknowledged" : ""}`;
      if (sheet && seen.at(-1) !== now) seen.push(now);
      const hot = sheet?.querySelector("li[data-hot]")?.textContent;
      if (hot) pointed.add(`${sheet!.getAttribute("aria-label")}: ${hot}`);
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true });
    fireEvent.click(screen.getByText("Play"));
    for (let t = 0; t < 60_000; t += 100) await act(() => vi.advanceTimersByTimeAsync(100));
    watch.disconnect();
    expect(seen).toEqual([
      "Brittany Pilz alert",
      "Brittany Pilz alert acknowledged",
      "Sikander Mazumdar warning",
      "Sikander Mazumdar warning acknowledged",
      "Jeff Gwartzmann success",
      "Jeff Gwartzmann success acknowledged",
    ]);
    for (const worker of workers) expect(risk(worker).textContent).not.toContain("Unread");
    expect([...pointed].filter((each) => each.startsWith("Brittany Pilz")).length).toBe(2);
    expect([...pointed].filter((each) => each.startsWith("Sikander Mazumdar")).length).toBe(1);
    // Moved off the last it pointed at.
    expect(document.querySelector("li[data-hot]")).toBeNull();
  }, 30_000);
});

describe("Timesheet", () => {
  // A Monday, when the Timesheet opens on last week, and a Wednesday, on this one.
  it.each([new Date(2026, 9, 26, 16), new Date(2026, 9, 28, 16)])("opens the Timesheet, adjusts the hours Rayna sent in with a note, and confirms her timecard, %s", async (now) => {
    vi.setSystemTime(now);
    await play({ project: "check-ins", version: "company" }, undefined, "timesheet");
    const rayna = screen.getAllByRole("row").find((each) => each.textContent?.includes("Rayna Rhiel Madsen"))!;
    // The rest of her week is still to confirm.
    const [shift, ...others] = rayna.querySelectorAll<HTMLElement>("button[data-shift][aria-label^=Confirmed]");
    expect(others).toEqual([]);
    expect(rayna.querySelector("[data-status=submitted]")).toBeNull();
    fireEvent.click(shift);
    const picked = screen.getByRole("radio", { checked: true });
    expect(picked.textContent).toContain(SOURCES.adjusted.label);
    expect(picked.textContent).toContain(DEMO.note);
    const sent = screen.getAllByRole("radio").find((card) => card.textContent?.includes(SOURCES.submitted.label))!;
    // A card's first time is its start.
    const start = (card: Element) => parseClock(/\d{1,2}:\d{2} [AP]M/.exec(card.textContent ?? "")![0], 0)!;
    expect(start(picked) - start(sent)).toBe(15);
  }, 30_000);
});

describe("Activation", () => {
  it("approves GoodLeaf Farms from review and invites it, crops its logo, then gives it a Guelph team with three templates and the workers round it with their skills", async () => {
    const cropped = "data:image/png;base64,R29vZExlYWY=";
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as ImageBitmapRenderingContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(cropped);
    const skills = presetsSeed().flatMap((preset) => (GOODLEAF_TEMPLATES.includes(preset.title) ? preset.skills : []));
    // A farm's: no Assembly, nor General Labourer's builders.
    expect([...new Set(skills)].sort()).toEqual(["Agriculture", "Cleaning Services", "Food Processing", "Manufacturing"]);
    const nearby = findNearby(GOODLEAF_PLACE, 5, []);
    for (const skill of ["Agriculture", "Food Processing"]) expect(withSkills(nearby, [skill]).length, skill).toBeGreaterThan(1);
    const skilled = withSkills(nearby, skills).length;
    expect(skilled).toBeGreaterThan(0);
    expect(skilled).toBeLessThan(nearby.length);
    expect(await play({ project: "activation-and-retention", version: "activation" }, new RegExp(SNACKS.invitationSent))).toEqual([
      SNACKS.invitationSent,
    ]);
    expect(document.querySelector("[data-prospect='Anika Septimus']")?.textContent).toContain("Onboarding");
    const settings = screen.getByRole("dialog", { name: "Company settings" });
    expect(within(settings).getByRole("heading", { name: "GoodLeaf Farms Guelph" })).toBeTruthy();
    const record = (title: string) =>
      [...settings.querySelectorAll("[data-sheet-trigger]")].find((each) => each.textContent?.startsWith(title))?.textContent;
    expect(record("Manage templates")).toContain("3 templates");
    expect(record("Manage worker pool")).toContain(`${skilled} workers`);
    expect(screen.queryByRole("dialog", { name: "Manage worker pool" })).toBeNull();
    // The team, without a logo of its own, shows the company's.
    const logos = ["GoodLeaf Farms", "GoodLeaf Farms Guelph"].map(
      (name) => within(settings).getByRole("heading", { name }).closest("[data-card]")?.querySelector("[data-avatar] img")?.getAttribute("src"),
    );
    expect(logos).toEqual([cropped, cropped]);
  }, 30_000);

  it("sets the logo's crop by zooming alone, its mark already centred", () => {
    const steps = demoOf({ project: "activation-and-retention", version: "activation" }, () => document.body) ?? [];
    expect(steps.filter((step) => typeof step === "object" && step.to)).toHaveLength(1);
  });
});
