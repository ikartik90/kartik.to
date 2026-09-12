// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The author's session, as the client sees it. `useIsAdmin` reads it through
// `authClient`, so this is the one knob that says whose browser this is.
const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

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
import {
  ANALYTICS_OPT_OUT_KEY,
  isAnalyticsOptedOut,
} from "@/utils/analytics-opt-out";

const signedInAsAuthor = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });

afterEach(() => {
  cleanup();
  localStorage.clear();
  mockUseSession.mockReturnValue({ data: null });
});

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
  it("marks the browser once the author is seen signed in", async () => {
    // The point of marking rather than asking: the session resolves through a
    // fetch, long after the vendor script has fired the first pageview of this
    // load. The mark is what makes the NEXT load — and every load after it —
    // free of the author, before any script has run.
    signedInAsAuthor();
    render(<Analytics />);

    await waitFor(() => expect(isAnalyticsOptedOut()).toBe(true));
  });

  it("leaves a visitor's browser unmarked", async () => {
    render(<Analytics />);

    // Nothing to wait for, so give the effects a turn and assert the absence.
    await waitFor(() => expect(received.analytics).toBeDefined());
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it("keeps the mark after the author signs out", async () => {
    // Deliberate: a browser that has authored this site is the author's
    // browser, and signing out to read the public pages is exactly the visit
    // that should not land on the dashboard.
    signedInAsAuthor();
    const view = render(<Analytics />);
    await waitFor(() => expect(isAnalyticsOptedOut()).toBe(true));

    mockUseSession.mockReturnValue({ data: null });
    view.rerender(<Analytics />);

    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it("hands the console both directions, for a browser it never sees a login on", async () => {
    // A phone, or a machine the author reads the site from but never authors
    // on. Same console idiom as `window.adminLogin()`.
    render(<Analytics />);
    await waitFor(() => expect(window.analyticsOptOut).toBeTypeOf("function"));

    window.analyticsOptOut?.();
    expect(isAnalyticsOptedOut()).toBe(true);

    window.analyticsOptIn?.();
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("takes the console handles back down with it", async () => {
    render(<Analytics />);
    await waitFor(() => expect(window.analyticsOptOut).toBeTypeOf("function"));

    cleanup();

    expect(window.analyticsOptOut).toBeUndefined();
    expect(window.analyticsOptIn).toBeUndefined();
  });
});
