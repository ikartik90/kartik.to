"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { Analytics as WebAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { dropPrivateEvents, isRecordedPage } from "@/utils/analytics-event";
import { setAnalyticsOptOut } from "@/utils/analytics-opt-out";
import { fillMissingReferrer } from "@/utils/analytics-referrer";

// Must stay a client component: beforeSend is a function and cannot cross the RSC boundary.

declare global {
  interface Window {
    analyticsOptOut?: () => void;
    analyticsOptIn?: () => void;
  }
}

const HOTJAR_SNIPPET = `(function(h,o,t,j,a,r){
    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
    h._hjSettings={hjid:6438248,hjsv:6};
    a=o.getElementsByTagName('head')[0];
    r=o.createElement('script');r.async=1;
    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
    a.appendChild(r);
})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`;

const noSubscription = () => () => {};

export function Analytics() {
  const isAdmin = useIsAdmin();
  const recorded = useSyncExternalStore(
    noSubscription,
    () => isRecordedPage(location.href),
    () => false,
  );

  // A layout effect, so it lands before the children's passive effects inject Vercel's script.
  useLayoutEffect(fillMissingReferrer, []);

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
      {recorded && (
        <Script id="hotjar" dangerouslySetInnerHTML={{ __html: HOTJAR_SNIPPET }} />
      )}
    </>
  );
}
