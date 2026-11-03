"use client";

import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type FC,
  type Ref,
} from "react";
import { css } from "../../../../styled-system/css";
import { pageScrollStyle } from "./check-ins-app";
import { DESIGN_SYSTEM } from "./copy";
import { ColorsPage, EffectsPage, IconPage, LayoutPage, RadiusPage, TextStylesPage } from "./ds-foundations";
import { GuidelinesPage, OverviewPage } from "./ds-overview";
import { CTA_STORIES, TOOLTIP } from "./ds-cta";
import { CHIP, PILL, SPOTSCORE } from "./ds-form-more";
import { FORM_NAVIGATION, FORM_PRIMITIVES, FORM_STORIES, SEARCH } from "./ds-form";
import { FILTER_STORIES } from "./ds-filter";
import { MAP_STORIES } from "./ds-map";
import { SNACKBAR } from "./ds-dialog";
import { BADGE, CARD_STORIES, DIVIDER, INLINE_TABLE_RECORD } from "./ds-card";
import { TAB_STORIES } from "./ds-tab";
import { AVATAR, DATA_TABLE_STORIES } from "./ds-data-table";
import {
  APPLICANT_SELECTOR,
  BILLABLE_DURATION_CARD,
  CONFIRMATION_DIALOG,
  LABEL_VALUE_PAIR,
  METADATA,
  NOTES_AND_HISTORY,
  OVERLAY_STORIES,
  PROFILE_OVERVIEW_CARD,
  WORKER_HOURS_DIALOG,
} from "./ds-overlay";
import { NAVIGATION_STORIES, NOTIFICATIONS, POPOVER_MENU } from "./ds-navigation";
import { DATA_VIZ_STORIES } from "./ds-data-viz";
import { TYPOGRAPHY } from "./ds-typography";
import { DsStory, type Story } from "./ds-story";
import { PixelValues, pageStyle } from "./ds-ui";
import { Sidebar } from "./sidebar";
import type { BarHistory } from "./browser-bar/browser-bar";
import { Typography } from "./ui";

// SW Curie, the design system, as its own site in the window: no Spotwork header, its overview and guidelines, its
// foundations on one page the sidebar jumps down, and each of Figma's components on a page of its own, listed under
// what it's for.

type Section = { id: string; label: string; page: FC };

// Pages of their own ahead of the foundations; the overview's cards open the others.
const FRONT: {
  id: string;
  label: string;
  page: FC<{
    onOpen: (page: string) => void;
    components: Story[];
    layer: HTMLElement | null;
    height: number;
    target?: string;
  }>;
}[] = [
  { id: "overview", label: DESIGN_SYSTEM.overview, page: OverviewPage },
  { id: "guidelines", label: DESIGN_SYSTEM.guidelines, page: GuidelinesPage },
];

const FOUNDATIONS: Section[] = [
  { id: "colors", label: "Colors", page: ColorsPage },
  { id: "text-styles", label: DESIGN_SYSTEM.typesetting, page: TextStylesPage },
  { id: "layout", label: DESIGN_SYSTEM.layout, page: LayoutPage },
  { id: "radius", label: DESIGN_SYSTEM.radius, page: RadiusPage },
  { id: "effects", label: DESIGN_SYSTEM.effects, page: EffectsPage },
  { id: "icon", label: "Icon", page: IconPage },
];

// Each group's components, alphabetically.
export const CATEGORIES: { label: string; stories: Story[] }[] = [
  {
    label: "Primitives",
    stories: [TYPOGRAPHY, APPLICANT_SELECTOR, AVATAR, BADGE, CHIP, DIVIDER, LABEL_VALUE_PAIR, PILL, SPOTSCORE, ...FORM_PRIMITIVES],
  },
  { label: "Maps", stories: MAP_STORIES },
  {
    label: "Actions",
    stories: [
      ...CTA_STORIES,
      CONFIRMATION_DIALOG,
      POPOVER_MENU,
      TOOLTIP,
      WORKER_HOURS_DIALOG,
    ],
  },
  { label: "Form", stories: FORM_STORIES },
  {
    label: "Card",
    stories: [
      ...CARD_STORIES,
      METADATA,
      NOTES_AND_HISTORY,
      BILLABLE_DURATION_CARD,
      PROFILE_OVERVIEW_CARD,
    ],
  },
  { label: "Data Table", stories: [...DATA_TABLE_STORIES, INLINE_TABLE_RECORD] },
  { label: "Overlay", stories: OVERLAY_STORIES },
  { label: "Filter", stories: [...FILTER_STORIES, SEARCH] },
  { label: "Status", stories: [NOTIFICATIONS, SNACKBAR] },
  { label: "Navigation", stories: [...NAVIGATION_STORIES, ...TAB_STORIES, FORM_NAVIGATION] },
  { label: "Data Viz", stories: DATA_VIZ_STORIES },
].map(({ label, stories }) => ({ label, stories: stories.toSorted((a, b) => a.id.localeCompare(b.id)) }));

const STORIES = CATEGORIES.flatMap((category) => category.stories);
/** A page's name as the sidebar writes it, in sentence case; its title keeps Figma's capitals. */
const sentenceCase = (name: string) => name[0] + name.slice(1).toLowerCase();
const isFoundation = (id: string) => FOUNDATIONS.some((section) => section.id === id);

// `data-check-ins-app` lets the live overlays on its pages wall off and place themselves as they do in the app.
const rootStyle = css({
  position: "relative",
  isolation: "isolate",
  display: "flex",
  flexShrink: 0,
  overflow: "hidden",
  "& button": { cursor: "pointer" },
});

/** Of parts laid out down a page at `tops`, the one in view: the last whose top has reached `line`, or else the first. */
export function inView(tops: number[], line: number) {
  return Math.max(tops.findLastIndex((top) => top <= line), 0);
}

/** Where `part` lies down the page `scroller` scrolls, in the page's own pixels: the window may be drawn scaled. */
function boxIn(scroller: HTMLElement, part: Element) {
  const view = scroller.getBoundingClientRect();
  const scale = view.height / scroller.offsetHeight || 1;
  const box = part.getBoundingClientRect();
  return (box.top - view.top) / scale + scroller.scrollTop;
}

const moves = () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Sends the site to a page from outside it: a page's id, a component's Figma name, or a group of components, which
 * opens at its first. A Guidelines group named as `target` is marked and landed on until another page opens.
 */
export type DesignSystemHandle = { go: (page: string, target?: string) => void };

/**
 * The site, opened at `defaultPage` (a page's id or a component's Figma name), or else at its overview, under `Bar`,
 * given the way back and forward through the pages opened.
 */
export function DesignSystem({
  ref,
  width,
  height,
  defaultPage,
  bar: Bar,
}: {
  ref?: Ref<DesignSystemHandle>;
  width: number;
  height: number;
  defaultPage?: string;
  bar?: ComponentType<BarHistory>;
}) {
  // A page's id, or a component's Figma name.
  const [current, setCurrent] = useState(defaultPage ?? FRONT[0].id);
  // The pages opened, as a browser keeps them; scrolling through the foundations opens none.
  const [history, setHistory] = useState({ pages: [defaultPage ?? FRONT[0].id], at: 0 });
  const story = STORIES.find((entry) => entry.figma === current);
  const front = FRONT.find((page) => page.id === current);
  // What the scroller holds: a component, a front page, or the foundations.
  const view = story?.figma ?? front?.id ?? "foundations";
  // The overview is a landing page, across the window with no sidebar.
  const landingPage = view === "overview";
  const scroll = useRef<HTMLDivElement>(null);
  // Where a page's side sheet opens, over the window's end.
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  // Set by a jump from the sidebar, which picks what's current until its scroll settles or the person takes over.
  const jumping = useRef(false);
  // The foundation to land on once the foundations' page is drawn.
  const landing = useRef<string | null>(null);
  // A new object each time the site is sent to a target, so the same one lands again.
  const [target, setTarget] = useState<{ name: string } | null>(null);
  // Counts the sends from outside, each drawing its page afresh: Colors, say, back on its palette.
  const [sends, setSends] = useState(0);

  // A page just drawn opens at its top, or at the foundation it was opened for.
  useLayoutEffect(() => {
    const scroller = scroll.current!;
    const id = landing.current;
    landing.current = null;
    const section = id && scroller.querySelector(`[data-ds-page="${id}"]`);
    scroller.scrollTo?.({ top: section ? boxIn(scroller, section) : 0, behavior: "auto" });
    // A landing that doesn't move the page fires no scroll to settle it.
    const settle = window.setTimeout(() => (jumping.current = false), 150);
    return () => clearTimeout(settle);
  }, [view]);

  // Then the target, its scroll margin clear above it.
  useLayoutEffect(() => {
    const scroller = scroll.current!;
    const part = target && scroller.querySelector("[data-target]");
    if (!part) return;
    const margin = parseFloat(getComputedStyle(part).scrollMarginTop) || 0;
    scroller.scrollTo?.({ top: boxIn(scroller, part) - margin, behavior: "auto" });
  }, [target]);

  useEffect(() => {
    const scroller = scroll.current!;
    let settle = 0;
    const follow = () => {
      if (jumping.current) {
        clearTimeout(settle);
        settle = window.setTimeout(() => (jumping.current = false), 150);
        return;
      }
      const pages = [...scroller.querySelectorAll<HTMLElement>("[data-ds-page]")];
      if (pages.length === 0) return;
      const page = inView(pages.map((part) => boxIn(scroller, part)), scroller.scrollTop + scroller.clientHeight / 3);
      setCurrent(pages[page].dataset.dsPage!);
    };
    const takeOver = () => (jumping.current = false);
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    scroller.addEventListener("scroll", follow, { passive: true });
    for (const input of inputs) scroller.addEventListener(input, takeOver, { passive: true });
    return () => {
      clearTimeout(settle);
      scroller.removeEventListener("scroll", follow);
      for (const input of inputs) scroller.removeEventListener(input, takeOver);
    };
  }, []);

  const show = (id: string) => {
    jumping.current = true;
    setCurrent(id);
    if (!isFoundation(id) || view !== "foundations") {
      landing.current = id;
      return;
    }
    const scroller = scroll.current!;
    const section = scroller.querySelector(`[data-ds-page="${id}"]`)!;
    scroller.scrollTo?.({ top: boxIn(scroller, section), behavior: moves() ? "smooth" : "auto" });
  };

  // A page opened partway back drops the ones ahead of it.
  const open = (id: string) => {
    const { pages, at } = history;
    if (pages[at] !== id) setHistory({ pages: [...pages.slice(0, at + 1), id], at: at + 1 });
    setTarget(null);
    show(id);
  };

  const go = (at: number) => {
    setHistory({ ...history, at });
    setTarget(null);
    show(history.pages[at]);
  };

  useImperativeHandle(ref, () => ({
    go: (page, name) => {
      open(CATEGORIES.find((category) => category.label === page)?.stories[0].figma ?? page);
      setTarget(name ? { name } : null);
      setSends((count) => count + 1);
    },
  }));

  return (
    <PixelValues>
      {Bar && (
        <Bar
          back={history.at > 0 ? () => go(history.at - 1) : undefined}
          forward={history.at < history.pages.length - 1 ? () => go(history.at + 1) : undefined}
        />
      )}
      <div ref={setLayer} className={rootStyle} style={{ width, height }} data-check-ins-app="">
        {!landingPage && (
        <Sidebar label={DESIGN_SYSTEM.nav} value={current} onChange={open}>
          {FRONT.map((page) => (
            <Sidebar.Item key={page.id} value={page.id}>
              <Typography variant="body">{sentenceCase(page.label)}</Typography>
            </Sidebar.Item>
          ))}
          <Sidebar.Group>
            <Sidebar.GroupLabel>
              <Typography tag="div" variant="metadataStrong" color="subdued">
                {DESIGN_SYSTEM.foundations}
              </Typography>
            </Sidebar.GroupLabel>
            {FOUNDATIONS.map((section) => (
              <Sidebar.Item key={section.id} value={section.id}>
                <Typography variant="body">{sentenceCase(section.label)}</Typography>
              </Sidebar.Item>
            ))}
          </Sidebar.Group>
          {CATEGORIES.map((category) => (
            <Sidebar.Group key={category.label}>
              <Sidebar.GroupLabel>
                <Typography tag="div" variant="metadataStrong" color="subdued">
                  {sentenceCase(category.label)}
                </Typography>
              </Sidebar.GroupLabel>
              {category.stories.map((entry) => (
                <Sidebar.Item key={entry.figma} value={entry.figma}>
                  <Typography variant="body">{sentenceCase(entry.id)}</Typography>
                </Sidebar.Item>
              ))}
            </Sidebar.Group>
          ))}
        </Sidebar>
        )}
        <div ref={scroll} className={pageScrollStyle} data-app-scroll="">
          <Fragment key={sends}>
            {story ? (
              <div className={pageStyle}>
                <DsStory key={story.figma} story={story} />
              </div>
            ) : front ? (
              <front.page onOpen={open} components={STORIES} layer={layer} height={height} target={target?.name} />
            ) : (
              FOUNDATIONS.map(({ id, label, page: Page }) => (
                <section key={id} data-ds-page={id} aria-label={label}>
                  <Page />
                </section>
              ))
            )}
          </Fragment>
        </div>
      </div>
    </PixelValues>
  );
}
