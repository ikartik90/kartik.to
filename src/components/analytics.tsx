"use client";

import { useEffect } from "react";
import { Analytics as WebAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { dropPrivateEvents } from "@/utils/analytics-event";
import { setAnalyticsOptOut } from "@/utils/analytics-opt-out";

// Must stay a client component: beforeSend is a function and cannot cross the RSC boundary.

declare global {
  interface Window {
    analyticsOptOut?: () => void;
    analyticsOptIn?: () => void;
  }
}

export function Analytics() {
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (isAdmin) setAnalyticsOptOut(true);
  }, [isAdmin]);

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
