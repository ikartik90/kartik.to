// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Both clients inject a remote script and render nothing. The stand-ins keep
// the one thing this component exists to get right — the props each is handed
// — and skip the network.
type Props = { beforeSend?: (event: { url: string }) => unknown };
const received: Record<string, Props> = {};

vi.mock("@vercel/analytics/next", () => ({
  Analytics: (props: Props) => {
    received.analytics = props;
    return null;
  },
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: (props: Props) => {
    received.speedInsights = props;
    return null;
  },
}));

import { Analytics } from "../analytics";

afterEach(cleanup);

describe("Analytics", () => {
  it("mounts both of Vercel's clients", () => {
    render(<Analytics />);
    expect(received.analytics).toBeDefined();
    expect(received.speedInsights).toBeDefined();
  });

  it("filters the admin surface out of both", () => {
    // The point of the wrapper. Either client shipping unfiltered would put
    // `/edit/*` pageviews on the dashboard, so assert the behaviour through
    // the prop each one actually got rather than trusting the wiring.
    render(<Analytics />);

    for (const client of [received.analytics, received.speedInsights]) {
      expect(client.beforeSend?.({ url: "https://kartik.to/edit/new" })).toBe(
        null,
      );
      const published = { url: "https://kartik.to/writing/some-post" };
      expect(client.beforeSend?.(published)).toBe(published);
    }
  });
});
