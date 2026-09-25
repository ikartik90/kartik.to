// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

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
    signedInAsAuthor();
    render(<Analytics />);

    await waitFor(() => expect(isAnalyticsOptedOut()).toBe(true));
  });

  it("leaves a visitor's browser unmarked", async () => {
    render(<Analytics />);

    await waitFor(() => expect(received.analytics).toBeDefined());
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it("keeps the mark after the author signs out", async () => {
    signedInAsAuthor();
    const view = render(<Analytics />);
    await waitFor(() => expect(isAnalyticsOptedOut()).toBe(true));

    mockUseSession.mockReturnValue({ data: null });
    view.rerender(<Analytics />);

    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it("hands the console both directions, for a browser it never sees a login on", async () => {
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
