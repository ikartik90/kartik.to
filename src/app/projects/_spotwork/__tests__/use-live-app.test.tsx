import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveApp } from "../use-live-app";

const { fetched } = vi.hoisted(() => ({ fetched: vi.fn() }));
vi.mock("../live-app", () => {
  fetched();
  return { LiveDemo: () => null, CheckInsApp: () => null, demoOf: () => undefined, demoFencesOf: () => undefined };
});

afterEach(cleanup);

function Probe({ seen }: { seen: (app: unknown) => void }) {
  seen(useLiveApp());
  return null;
}

describe("useLiveApp", () => {
  it("draws without the prototype's code at first, fetches it once from mount, and has it at once from then on", async () => {
    const first = vi.fn();
    render(<Probe seen={first} />);
    render(<Probe seen={first} />);
    expect(first.mock.calls[0][0]).toBeUndefined();
    await act(async () => {});
    expect(fetched).toHaveBeenCalledOnce();
    expect(first.mock.lastCall![0]).toHaveProperty("CheckInsApp");

    const later = vi.fn();
    render(<Probe seen={later} />);
    expect(later.mock.calls[0][0]).toHaveProperty("LiveDemo");
    expect(fetched).toHaveBeenCalledOnce();
  });

  it("fetches nothing while it isn't wanted, and fetches it once it is", async () => {
    // A fresh copy, which has fetched nothing yet.
    vi.resetModules();
    const { useLiveApp: fresh } = await import("../use-live-app");
    function Wanting({ wanted, seen }: { wanted: boolean; seen: (app: unknown) => void }) {
      seen(fresh(wanted));
      return null;
    }
    const seen = vi.fn();
    const { rerender } = render(<Wanting wanted={false} seen={seen} />);
    await act(async () => {});
    expect(seen.mock.lastCall![0]).toBeUndefined();

    rerender(<Wanting wanted seen={seen} />);
    await act(async () => {});
    expect(seen.mock.lastCall![0]).toHaveProperty("LiveDemo");
  });
});
