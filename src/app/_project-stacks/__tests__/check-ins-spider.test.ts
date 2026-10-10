import { describe, expect, it } from "vitest";
import { CHECK_INS } from "../check-ins-content";
import { isHot, overall, radius } from "../check-ins-spider";

const { spider } = CHECK_INS.signals;
const levels = (key: string) => {
  const worker = spider.workers.find((w) => w.key === key)!;
  return spider.factors.map((f) => worker.readings[f.id].level);
};

describe("radius", () => {
  it("puts none at the centre and low, medium and high equal steps out", () => {
    expect([0, 1, 2, 3].map(radius)).toEqual([0, 50, 100, 150]);
  });
});

describe("isHot", () => {
  it("lights the factor pointed at, and only that one", () => {
    expect(isHot("cancel", "cancel")).toBe(true);
    expect(isHot("cancel", "lateCancel")).toBe(false);
  });

  it("lights every factor at none when the centre they share is pointed at", () => {
    expect(isHot("cancel location company", "location")).toBe(true);
    expect(isHot("cancel location company", "worker")).toBe(false);
  });

  it("lights nothing when nothing is pointed at", () => {
    expect(isHot(null, "cancel")).toBe(false);
  });
});

describe("the mock workers' no-show risk", () => {
  it("rates Brittany high, Aspen medium and Angel low", () => {
    expect(spider.levels[overall(levels("brittany"))]).toBe("High");
    expect(spider.levels[overall(levels("aspen"))]).toBe("Medium");
    expect(spider.levels[overall(levels("angel"))]).toBe("Low");
  });

  it("draws each worker as a shape, not a line", () => {
    // The shoelace area of the readings, a spoke apart round the centre.
    const area = (values: number[]) => {
      const points = values.map((level, i) => {
        const angle = (i * 2 * Math.PI) / values.length;
        return [radius(level) * Math.cos(angle), radius(level) * Math.sin(angle)];
      });
      return Math.abs(points.reduce((sum, [x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length];
        return sum + x * ny - nx * y;
      }, 0)) / 2;
    };
    for (const { key } of spider.workers) expect(area(levels(key))).toBeGreaterThan(0);
  });

  it("reads every factor for every worker", () => {
    for (const worker of spider.workers) {
      expect(Object.keys(worker.readings).sort()).toEqual(spider.factors.map((f) => f.id).sort());
    }
  });
});
