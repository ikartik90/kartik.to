"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { useModal } from "./modal";
import { overlayBase } from "./overlay";
import { RULE_ABOVE } from "./candidate-table";
import { plainButtonStyle, primaryButtonStyle } from "./parts";
import { useWalkthrough } from "./walkthrough";
import {
  BlindCover,
  ExampleCover,
  KnownOutcomesCover,
  TitleCover,
} from "./intro-covers";
import { BENCHMARK_CANDIDATES } from "./harness-data";
import { JOB_TITLE } from "./job";
import CloseIcon from "./icons/close.svg";
import BackIcon from "./icons/chevron-left.svg";
import NextIcon from "./icons/chevron-right.svg";
import InfoIcon from "./icons/info-subtle.svg";

const dialogStyle = css(overlayBase, {
  margin: "auto",
  width: "800px",
  maxWidth: "calc(100% - 40px)",
  minHeight: "min(616px, calc(100% - 40px))",
  maxHeight: "calc(100% - 40px)",
  borderRadius: "12px",
  filter: "drop-shadow(0 0 10px var(--cashby-border))",
  // An ::after outline: the pictures run to the edge and would cover an inset shadow.
  _after: {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
    pointerEvents: "none",
  },
});

// `1 1 auto`, not `flex: 1`: Safari sizes a 0% basis here to nothing.
const stagesStyle = css({
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  flex: "1 1 auto",
  minHeight: 0,
});

// Inert, not also hidden: reduced motion transitions visibility, so a returning
// page would still be hidden when it should take focus.
const stackedStyle = css({
  gridArea: "1 / 1",
  transition: "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&[inert]": { opacity: 0 },
});

const welcomeStyle = css({
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  backgroundImage:
    "linear-gradient(99.46deg, var(--cashby-cover-lilac) 0%, var(--cashby-cover-rose) 94.444%)",
});

const welcomeTextStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flex: "1 1 auto",
  gap: "32px",
  paddingBlock: "40px",
  paddingInline: "52px",
  backgroundColor: "var(--cashby-surface)",
  textAlign: "center",
});

const welcomeHeadingStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
});

const welcomeTitleStyle = css({ font: "var(--cashby-text-page-title)" });

const welcomeSubtitleStyle = css({ font: "var(--cashby-text-body-strong)" });

const startStyle = css({
  display: "flex",
  alignItems: "center",
  height: "40px",
  paddingInline: "12px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-accent)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-button)",
  whiteSpace: "nowrap",
  "html[data-keyboard-focus] &": {
    _focusVisible: {
      boxShadow:
        "0 0 0 1.5px var(--cashby-surface), 0 0 0 3px var(--cashby-accent)",
    },
  },
});

const tourStyle = css({
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
});

const pagesStyle = css({
  display: "grid",
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
});

const pageStyle = css({ display: "flex", flexDirection: "column" });

const textStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  flex: "1 1 auto",
  gap: "12px",
  padding: "24px",
  boxShadow: RULE_ABOVE,
});

const headingStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const eyebrowStyle = css({
  font: "var(--cashby-text-small)",
  color: "var(--cashby-accent)",
});

const titleStyle = css({ font: "var(--cashby-text-section-title)" });

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  paddingInlineStart: "20px",
  listStyleType: "disc",
  _marker: { color: "var(--cashby-slate-muted)" },
});

const noteStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  marginBlockStart: "auto",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate-subtle)",
  "& > svg": { flexShrink: 0 },
});

const iconButtonStyle = css({ justifyContent: "center", width: "32px" });

const closeStyle = css({
  position: "absolute",
  insetBlockStart: "12px",
  insetInlineEnd: "12px",
});

const footerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  padding: "12px",
  backgroundColor: "var(--cashby-fill)",
  boxShadow: RULE_ABOVE,
});

const dotsStyle = css({ display: "flex", marginInlineStart: "-4px" });

const dotStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  borderRadius: "8px",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
  "& > span": {
    width: "8px",
    height: "8px",
    borderRadius: "4px",
    backgroundColor: "var(--cashby-slate-muted)",
    transition: "background-color 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  _currentStep: { "& > span": { backgroundColor: "var(--cashby-accent)" } },
});

const waysStyle = css({ display: "flex", gap: "12px" });

interface Page {
  eyebrow: string;
  title: string;
  cover: ReactNode;
  body: ReactNode;
}

export function Intro() {
  const modal = useModal();
  const titleId = useId();
  const startRef = useRef<HTMLButtonElement>(null);
  const forwardRef = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const walkthrough = useWalkthrough();
  const close = () => void modal.close();

  const pages: Page[] = [
    {
      eyebrow: "UX gap",
      title: "AI criteria can silently exclude strong candidates",
      cover: <BlindCover />,
      body: (
        <>
          <p>
            Criteria prompts capture a recruiter’s best intentions, but depend
            on the AI’s interpretation of the language.
          </p>
          <ul className={listStyle}>
            <li>
              A criterion that reads well can still eliminate candidates you
              would likely hire.
            </li>
            <li>
              Today, the only way to spot a bad prompt is to run it past your
              entire pipeline, at a credit per evaluation.
            </li>
            <li>
              Even so, fixing the prompt is guesswork, as active applicants
              don’t have an outcome to compare against yet.
            </li>
          </ul>
        </>
      ),
    },
    {
      eyebrow: "Recommendation",
      title: "Test your criteria against talent with known outcomes",
      cover: <KnownOutcomesCover />,
      body: (
        <>
          <p>
            Before applying your criteria on active candidates, test them on a
            small set of past hires and archived profiles.
          </p>
          <ul className={listStyle}>
            <li>
              A criterion that excludes one of your hires will likely exclude
              strong active candidates too.
            </li>
            <li>
              A criterion that passes a profile you archived will likely let
              weak ones through.
            </li>
            <li>
              Tests flag mismatches and the criteria that caused them, with
              suggested rewrites to take out the guesswork.
            </li>
          </ul>
        </>
      ),
    },
    {
      eyebrow: "Try it yourself",
      title: "Add a criterion and put it to the test",
      cover: <ExampleCover />,
      body: (
        <>
          <p>
            You will add a criterion to an {JOB_TITLE} job, test it against{" "}
            {BENCHMARK_CANDIDATES.length} profiles with known outcomes, and
            apply suggested rewrites to fix what the test finds.
          </p>
          <p className={noteStyle}>
            <InfoIcon aria-hidden />
            Concept prototype. Fictional candidate profiles and resumes
            generated with AI.
          </p>
        </>
      ),
    },
  ];
  const last = pages.length - 1;
  const onLast = current === last;

  function go(page: number) {
    if (page >= 0 && page <= last) setCurrent(page);
  }

  const arrive = useEffectEvent(() => modal.open());
  useEffect(() => arrive(), []);

  // The dialog would focus Close; Get started (then Next) takes focus instead.
  useEffect(() => {
    if (modal.session > 0) startRef.current?.focus();
  }, [modal.session]);
  useEffect(() => {
    if (started) forwardRef.current?.focus();
  }, [started]);

  return (
    <dialog
      {...modal.dialogProps}
      className={dialogStyle}
      aria-labelledby={started ? `${titleId}-${current}` : `${titleId}-title`}
    >
      <div className={stagesStyle}>
        <section className={cx(stackedStyle, welcomeStyle)} inert={started}>
          <TitleCover />
          <div className={welcomeTextStyle}>
            <hgroup className={welcomeHeadingStyle}>
              <p className={eyebrowStyle}>Concept prototype</p>
              <h2 id={`${titleId}-title`} className={welcomeTitleStyle}>
                Benchmarking AI review criteria
              </h2>
              <p className={welcomeSubtitleStyle}>
                A proposal for taking the guesswork out of AI-assisted screening
              </p>
            </hgroup>
            <button
              ref={startRef}
              type="button"
              className={startStyle}
              onClick={() => setStarted(true)}
            >
              Get started
            </button>
          </div>
        </section>

        <div className={cx(stackedStyle, tourStyle)} inert={!started}>
          <div className={pagesStyle}>
            {pages.map((page, index) => (
              <section
                key={page.title}
                className={cx(stackedStyle, pageStyle)}
                inert={index !== current}
              >
                {page.cover}
                <div className={textStyle}>
                  <hgroup className={headingStyle}>
                    <p className={eyebrowStyle}>{page.eyebrow}</p>
                    <h2 id={`${titleId}-${index}`} className={titleStyle}>
                      {page.title}
                    </h2>
                  </hgroup>
                  {page.body}
                </div>
              </section>
            ))}
          </div>

          <footer className={footerStyle}>
            <div role="group" aria-label="Pages" className={dotsStyle}>
              {pages.map((page, index) => (
                <button
                  key={page.title}
                  type="button"
                  aria-label={`Page ${index + 1}`}
                  aria-current={index === current ? "step" : undefined}
                  className={dotStyle}
                  onClick={() => go(index)}
                >
                  <span />
                </button>
              ))}
            </div>
            {/* Back passes focus to Next before it unmounts; Next and Start
                walkthrough are one button, so focus survives the swap. */}
            <div className={waysStyle}>
              {current > 0 && (
                <button
                  type="button"
                  aria-label="Back"
                  className={cx(plainButtonStyle, iconButtonStyle)}
                  onClick={(event) => {
                    if (
                      current === 1 &&
                      document.activeElement === event.currentTarget
                    )
                      forwardRef.current?.focus();
                    go(current - 1);
                  }}
                >
                  <BackIcon aria-hidden />
                </button>
              )}
              <button
                ref={forwardRef}
                type="button"
                aria-label={onLast ? undefined : "Next"}
                className={
                  onLast
                    ? primaryButtonStyle
                    : cx(plainButtonStyle, iconButtonStyle)
                }
                onClick={
                  onLast
                    ? () => void modal.close().then(walkthrough.start)
                    : () => go(current + 1)
                }
              >
                {onLast ? "Start walkthrough" : <NextIcon aria-hidden />}
              </button>
            </div>
          </footer>

          <button
            type="button"
            aria-label="Close"
            className={cx(plainButtonStyle, iconButtonStyle, closeStyle)}
            onClick={close}
          >
            <CloseIcon aria-hidden />
          </button>
        </div>
      </div>
    </dialog>
  );
}
