"use client";

import { useEffect } from "react";
import { Analytics as WebAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { dropPrivateEvents } from "@/utils/analytics-event";
import { setAnalyticsOptOut } from "@/utils/analytics-opt-out";

// ---------------------------------------------------------------------------
// Vercel's two measurement clients, mounted together and filtered the same
// way. Web Analytics counts visits; Speed Insights reports the field vitals
// (LCP, INP, CLS) from real visitors — the only numbers that can say whether
// the shader work costs anyone anything on hardware that isn't this laptop.
//
// A component of our own rather than the two vendor tags dropped straight
// into the layout, for a reason the docs' example quietly gets wrong: both
// packages are `"use client"`, and `beforeSend` is a function. A Server
// Component cannot pass a function across that boundary — React has nothing
// to serialize it into — so the filter has to be attached on the client side
// of the line. This file IS that line. It also keeps the two clients from
// drifting apart: one place to mount, one filter, applied to both.
//
// It is also where the author's own browser gets marked, because this is the
// only client component that is mounted on every page and cares who is
// looking. `useIsAdmin` is already subscribed site-wide (the command palette
// asks it), so the session costs nothing extra here.
//
// Both render `null`, so this adds no markup and no layout cost; the scripts
// load `defer` from the site's own origin.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    analyticsOptOut?: () => void;
    analyticsOptIn?: () => void;
  }
}

export function Analytics() {
  const isAdmin = useIsAdmin();

  // Marking is a write, not a question: by the time the session has resolved,
  // this load's pageview is long gone. What it buys is every load after it —
  // `dropPrivateEvents` reads the mark synchronously, before the vendor script
  // has had a chance to send anything. Repeated on each load the author is
  // signed in for, which is free and keeps the mark from depending on catching
  // one particular moment.
  useEffect(() => {
    if (isAdmin) setAnalyticsOptOut(true);
  }, [isAdmin]);

  // The other half, for a browser that never sees a login: a phone, or a
  // machine the site is only read from. Console handles rather than UI, the
  // same idiom as `window.adminLogin()` — nothing about this is worth a
  // control on a page that visitors can see.
  useEffect(() => {
    window.analyticsOptOut = () => setAnalyticsOptOut(true);
    window.analyticsOptIn = () => setAnalyticsOptOut(false);

    return () => {
      delete window.analyticsOptOut;
      delete window.analyticsOptIn;
    };
  }, []);

  return (
    <>
      <WebAnalytics beforeSend={dropPrivateEvents} />
      <SpeedInsights beforeSend={dropPrivateEvents} />
    </>
  );
}
