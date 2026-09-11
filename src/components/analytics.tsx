"use client";

import { Analytics as WebAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { dropStealthEvents } from "@/utils/analytics-event";

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
// Both render `null`, so this adds no markup and no layout cost; the scripts
// load `defer` from the site's own origin.
// ---------------------------------------------------------------------------

export function Analytics() {
  return (
    <>
      <WebAnalytics beforeSend={dropStealthEvents} />
      <SpeedInsights beforeSend={dropStealthEvents} />
    </>
  );
}
