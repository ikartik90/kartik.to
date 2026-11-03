"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { css, cx } from "../../../../../styled-system/css";
import { DemoCursor } from "@/components/demo/demo-cursor";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { BAR_HEIGHT, BrowserBar, type BarHistory } from "../browser-bar/browser-bar";
import { CheckInsApp } from "../check-ins-app";
import { shiftStart } from "../data";
import { DesignSystem } from "../design-system";
import { useDemo } from "../demo";
import { demoOf } from "../demos";
import type { Choice } from "../project-nav";
import { pageOf, windowOf } from "../prototype-overlay";
import { manrope, poppins, spotworkTheme } from "../theme";

// A card's cover plays its project's demo in the live app while the whole card is in view, from the start
// each time it comes into view, and again after a pause while it stays there. The app takes no pointer: the card under it is what's pressed.
// The window is laid out at 1440×900, then scaled to the card's window, which has its shape.

const WINDOW = { width: 1440, height: 900 };
const ACCENT = "var(--sw-colors-blue-ribbon-700)";
const THEME = cx(poppins.variable, manrope.variable, spotworkTheme);
const SPOTWORK_CURSOR = css.raw({ "--cursor-ink": "var(--sw-glyph-selected)", "--cursor-edge": "var(--sw-surface-selected)" });
// Between one run's end and the next.
const REPLAY_MS = 2000;
// It plays only while its whole face shows; a hair under 1, as one resting on the carousel's edge can sit a subpixel out.
const WHOLE = 0.99;
// How long nothing may scroll before a card builds its app, or builds it afresh to start.
const STILL_MS = 150;

// When the page or a carousel last scrolled, or a card last built its app. Building one takes frames, so it waits for
// the scrolling to stop, and the cards take turns.
let busy = -Infinity;
const onScroll = (event: Event) => {
  if (!(event.target instanceof Element && event.target.closest("[data-cover]"))) busy = Date.now();
};

/** Calls `then` once `after` ms have passed and all has been still for a beat; returns a cancel. */
function whenStill(then: () => void, after = 0) {
  const from = Date.now();
  const check = () => {
    const wait = Math.max(from + after, busy + STILL_MS) - Date.now();
    if (wait > 0) return void (timer = setTimeout(check, wait));
    busy = Date.now();
    then();
  };
  let timer = setTimeout(check, 0);
  return () => clearTimeout(timer);
}
const untilStill = () => new Promise<void>((resolve) => void whenStill(resolve));

const windowStyle = css({ position: "absolute", inset: 0, overflow: "clip", pointerEvents: "none" });
const scaledStyle = css({ display: "flex", flexDirection: "column", transformOrigin: "0 0" });
const contentsStyle = css({ display: "contents" });

/** The project's first version, which its demo starts on; the design system has no demo, so its site stands still. */
const CHOICES: Record<string, Choice> = {
  "check-ins": { project: "check-ins", version: "company" },
  "activation-and-retention": { project: "activation-and-retention", version: "activation" },
  "design-system": { project: "design-system" },
};

const DesignSystemBar = (history: BarHistory) => (
  <BrowserBar url={windowOf("design-system")!.url} accent={ACCENT} history={history} />
);

/** `near`: whether its carousel is near the window, for the app to be built before the card slides in. */
export function LiveDemo({ project, paused, near }: { project: string; paused: boolean; near: boolean }) {
  const choice = CHOICES[project];
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [inView, setInView] = useState(false);
  const [anchor] = useState(() => shiftStart(new Date()));
  const reduced = useReducedMotion();
  const { cursor, playing, play, stop } = useDemo(box);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setScale(Math.max(node.clientWidth / WINDOW.width, node.clientHeight / WINDOW.height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const listen = (event: Event) => onScroll(event);
    document.addEventListener("scroll", listen, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", listen, { capture: true });
  }, []);

  // The card's face.
  useEffect(() => {
    const node = box.current?.closest("[data-cover]");
    if (!node) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.intersectionRatio >= WHOLE);
      },
      { threshold: WHOLE },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, []);

  const [built, setBuilt] = useState(false);
  useEffect(() => {
    if (!near || !scale || built) return;
    return whenStill(() => setBuilt(true));
  }, [near, scale, built]);

  // Each time it goes live the app starts afresh, and again for each replay; the first run plays on the app as built.
  const playable = !!choice && !!demoOf(choice, () => null);
  const ready = playable && built && inView && !paused && !reduced;
  const [live, setLive] = useState(false);
  if (live && !ready) setLive(false);
  useEffect(() => {
    if (!ready || live) return;
    return whenStill(() => setLive(true));
  }, [ready, live]);
  const [runs, setRuns] = useState(0);
  const [wasLive, setWasLive] = useState(false);
  if (live !== wasLive) {
    setWasLive(live);
    if (live) setRuns((n) => n + 1);
  }

  useEffect(() => {
    if (!live || !choice) return;
    play(demoOf(choice, () => box.current) ?? [], untilStill);
    return stop;
  }, [live, runs, choice, play, stop]);

  // A run that ends on its own, not one stopped as the card goes.
  const [wasPlaying, setWasPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  if (playing !== wasPlaying) {
    setWasPlaying(playing);
    if (!playing && live) setEnded(true);
  }
  useEffect(() => {
    if (!ended) return;
    return whenStill(() => {
      setEnded(false);
      if (live) setRuns((n) => n + 1);
    }, REPLAY_MS);
  }, [ended, live]);

  const site = choice && windowOf(choice.project);
  const run = Math.max(runs - 1, 0);
  // Apart from the cursor, which moves on every step.
  const app = useMemo(
    () =>
      site &&
      (site.site === "design-system" ? (
        <DesignSystem width={WINDOW.width} height={WINDOW.height - BAR_HEIGHT} bar={DesignSystemBar} />
      ) : (
        <>
          <BrowserBar url={site.url} accent={ACCENT} />
          <CheckInsApp
            key={run}
            anchor={anchor}
            width={WINDOW.width}
            height={WINDOW.height - BAR_HEIGHT}
            initialPage={pageOf(choice)}
          />
        </>
      )),
    [site, choice, anchor, run],
  );
  return (
    <div ref={box} className={windowStyle} inert>
      {built && app && scale > 0 && (
        <>
          <div
            className={cx(scaledStyle, THEME)}
            style={{ ...WINDOW, transform: `scale(${scale})`, "--window-scale": scale } as CSSProperties}
          >
            {app}
          </div>
          <div className={cx(THEME, contentsStyle)}>
            <DemoCursor {...cursor} css={SPOTWORK_CURSOR} />
          </div>
        </>
      )}
    </div>
  );
}
