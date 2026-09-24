"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { MenuButton } from "./menu-button";
import { BenchmarkDialog } from "./benchmark-dialog";
import type { CandidatesTab } from "./benchmark-results";
import { ValidateDialog } from "./validate-dialog";
import {
  benchmark,
  suggestedRewrites,
  type BenchmarkRow,
  type SuggestedRewrite,
} from "./benchmark";
import {
  CriterionEditor,
  criterionEditorsStyle,
  type Field,
} from "./criterion-editor";
import { useModal } from "./modal";
import { hasChanged, withCustomCriterion, type DraftCriterion } from "./draft";
import { CUSTOM_CRITERION, JOB_TITLE } from "./job";
import { BENCHMARK_CANDIDATES } from "./harness-data";
import { BETWEEN_FIELDS_MS, keystrokeDelays } from "./typing";
import { useWalkthrough, WalkthroughTip } from "./walkthrough";
import {
  accentButton,
  accentButtonLabelStyle,
  card,
  cardActionsStyle,
  cardHeaderStyle,
  cardTitleBoxStyle,
  cardTitleStyle,
  CriteriaChanged,
  plainButtonLabelStyle,
  plainButtonStyle,
  primaryButtonStyle,
  UpToDate,
} from "./parts";
import GotoIcon from "./icons/goto-small.svg";
import RetestChevron from "./icons/chevron-down-white.svg";
import AddIcon from "./icons/add.svg";
import MenuChevron from "./icons/chevron-down-accent.svg";
import SuggestionsIcon from "./icons/ai.svg";
import PreviousIcon from "./icons/history-menu.svg";
import CustomIcon from "./icons/write.svg";
import ChangeIcon from "./icons/replace.svg";
import ResultsIcon from "./icons/menu-option.svg";
import InfoIcon from "./icons/info.svg";

// ---------------------------------------------------------------------------
// What the edit drawer holds (Figma 94:5023): the job's criteria, each as a
// short title and a prompt the recruiter can rewrite, and the two ways out.
//
// The fields are a DRAFT of the criteria RUNNING. This component is remounted
// every time the drawer opens, so Cancel — or any other way of closing but
// saving — throws the draft away and the next opening starts from what is
// running.
//
// Choosing it is the walkthrough's second step, and its tip points at Add
// criteria; retesting is the third, whose tip points at Retest criteria once
// the typing is through; reviewing the suggested rewrites is the fourth,
// applying one the fifth, and retesting once more the sixth, at Retest
// criteria again. The seventh is the results all matching, done with once they
// are closed.
//
// "Add custom" puts the custom criterion at the top, blank, and TYPES it in —
// title, a breath, then prompt — in the field's own caret, as if the recruiter
// were writing it (Figma 55:620). Typing into it takes over at once; reduced
// motion fills it in whole. The header says the criteria have changed since
// they were tested for as long as the draft differs from what was last tested
// — until a retest, what is running.
//
// View benchmark results shows the last benchmark at once — at first, the run
// of the criteria running — and Change candidates... shows it at once on the
// Suggested candidates list. Retesting with the
// previous candidate set benchmarks the draft (anything still being typed is
// typed out in full first, so the whole criterion is tested), and from then on
// the draft counts as tested and that run is the last one. Reviewing its
// suggested rewrites brings the recruiter back here, each rewrite under the
// prompt it is for (Figma 86:3757), with focus on it. Applying one writes it
// into that prompt, so the draft differs from what was tested again and
// Retest criteria is back (Figma 93:4095); ignoring one just dismisses it.
//
// A candidate removed from the suggested list is out of the benchmark until
// added back: their result goes, and every retest leaves them out. One added
// back has no result until the next retest, so the results say they are no
// longer valid.
//
// Validate is offered once changed criteria have up-to-date benchmark results
// and have not been validated since — as the primary action, unless suggested
// rewrites are still waiting on an answer — and validates in a dialog of its
// own (Figma 119:5974). Once that has finished and is closed, Validate goes and
// Save becomes the primary "Save and evaluate all active candidates", which
// makes the criteria validated the ones running and closes the drawer; the
// evaluating is pretend. The form opens with neither: the criteria running were
// validated, saved and evaluated with the last run. Reordering and deleting are
// drawn but not offered.
// ---------------------------------------------------------------------------

/** One step of the typing: after `delay`, `field` reads `value`. */
interface Keystroke {
  delay: number;
  field: Field;
  value: string;
  /** Move the caret into this field first — the second field's first step. */
  focus?: boolean;
}

function script(title: string, prompt: string): Keystroke[] {
  const type = (field: Field, text: string) =>
    keystrokeDelays(text).map((delay, i) => ({
      delay,
      field,
      value: text.slice(0, i + 1),
    }));
  const [firstOfPrompt, ...restOfPrompt] = type("prompt", prompt);
  return [
    ...type("title", title),
    {
      ...firstOfPrompt,
      delay: BETWEEN_FIELDS_MS + firstOfPrompt.delay,
      focus: true,
    },
    ...restOfPrompt,
  ];
}

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// --- Header -----------------------------------------------------------------

const headerStyle = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexShrink: 0,
  padding: "12px",
  backgroundColor: "var(--cashby-fill)",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-border)",
});

const headingStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
  paddingInline: "6px",
});

const eyebrowStyle = css({
  font: "var(--cashby-text-body-strong)",
  color: "var(--cashby-slate)",
});

const titleStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-section-title)",
});

// Drawn as a button, and scenery like the rest of the product around the
// criteria: nothing here leads anywhere.
const learnMoreStyle = css({
  paddingInlineStart: "8px",
  paddingInlineEnd: "6px",
});

// --- Body -------------------------------------------------------------------

const bodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  flex: 1,
  minHeight: 0,
  padding: "12px",
  overflowY: "auto",
});

const criteriaActionsStyle = css({ gap: "8px" });

const emptyStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "120px",
  paddingInline: "8px",
  backgroundColor: "var(--cashby-surface)",
});

const emptyTextStyle = css({
  maxWidth: "406px",
  textAlign: "center",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate)",
  "& em": { fontStyle: "italic" },
});

// --- Footer -----------------------------------------------------------------

const footerStyle = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  gap: "12px",
  flexShrink: 0,
  padding: "12px",
  backgroundColor: "var(--cashby-fill)",
  borderBlockStartWidth: "var(--cashby-rule)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "var(--cashby-border)",
});

const footerButtonStyle = css({ paddingInline: "8px" });

export interface CriteriaDrawerProps {
  /** The id its title is given, which the dialog is named by. */
  titleId: string;
  /** The criteria running: validated, saved, and benchmarked last. */
  running: DraftCriterion[];
  /** Save the criteria validated, to run from now on. */
  onSave: (criteria: DraftCriterion[]) => void;
  onCancel: () => void;
}

export function CriteriaDrawer({
  titleId,
  running,
  onSave,
  onCancel,
}: CriteriaDrawerProps) {
  const [draft, setDraft] = useState(running);
  const [tested, setTested] = useState(running);
  const [rewrites, setRewrites] = useState<SuggestedRewrite[]>([]);
  // The run the criteria running were saved on — the same prompts give the
  // same answers.
  const [lastRun, setLastRun] = useState<BenchmarkRow[]>(() =>
    benchmark(running),
  );
  // Whether the results benchmark first (a retest) or show at once (a view).
  const [benchmarking, setBenchmarking] = useState(false);
  // Which of the overlay's tabs it opens on.
  const [opensOn, setOpensOn] = useState<CandidatesTab>("results");
  // The candidates taken out of the benchmark from the suggested list.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  // The ones still in it, in the fixture's order.
  const candidates = BENCHMARK_CANDIDATES.filter(
    (candidate) => !removed.has(candidate.id),
  ).map((candidate) => candidate.id);
  const results = useModal({ onClosed: closeResults });
  // The criteria last validated: at first, those running, validated with the
  // last run.
  const [validated, setValidated] = useState(running);
  const validation = useModal({ onClosed: closeValidation });
  // Whether the validation open now has finished, so that closing it counts.
  const validationDone = useRef(false);
  const validateRef = useRef<HTMLButtonElement>(null);
  const editorsRef = useRef<HTMLUListElement>(null);
  const viewResultsRef = useRef<HTMLButtonElement>(null);
  const addCriteriaRef = useRef<HTMLButtonElement>(null);
  const retestRef = useRef<HTMLButtonElement>(null);
  const walkthrough = useWalkthrough();
  const uid = useId();
  const resumeId = `${uid}-resume`;
  const fieldId = (id: string, field: Field) => `${uid}-${id}-${field}`;
  const saveId = `${uid}-save`;

  // The typing in progress: its next timer, and the row it is typing into.
  const typing = useRef<{ timer: number; row: string } | null>(null);
  // Whether it is, for what waits for it to finish.
  const [typingOn, setTypingOn] = useState(false);
  // A field to put the caret in once the row holding it has been committed.
  const focusNext = useRef<string | null>(null);

  function stopTyping() {
    if (typing.current) window.clearTimeout(typing.current.timer);
    typing.current = null;
    setTypingOn(false);
  }
  useEffect(() => stopTyping, []);

  useLayoutEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function setField(id: string, field: Field, value: string) {
    setDraft((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  // The recruiter's own typing: into the row being typed, it takes over.
  function edit(id: string, field: Field, value: string) {
    if (typing.current?.row === id) stopTyping();
    setField(id, field, value);
  }

  function addCustom() {
    const { id, title, prompt } = CUSTOM_CRITERION;
    walkthrough.done("add-custom");
    setDraft(withCustomCriterion);
    focusNext.current = fieldId(id, "title");
    if (prefersReducedMotion()) {
      setField(id, "title", title);
      setField(id, "prompt", prompt);
      return;
    }
    setTypingOn(true);
    play(id, script(title, prompt));
  }

  function play(row: string, [next, ...rest]: Keystroke[]) {
    if (!next) {
      typing.current = null;
      setTypingOn(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (next.focus) {
        // Only while the caret is still in this row — never out of a field
        // the recruiter has since moved to.
        const target = document.getElementById(fieldId(row, next.field));
        const active = document.activeElement;
        if (
          target &&
          (!active ||
            active === document.body ||
            active.closest("li") === target.closest("li"))
        ) {
          target.focus();
        }
      }
      setField(row, next.field, next.value);
      play(row, rest);
    }, next.delay);
    typing.current = { timer, row };
  }

  // Whatever is still being typed, typed out in full at once: the draft as it
  // is about to be.
  function finishTyping(): DraftCriterion[] {
    const row = typing.current?.row;
    if (!row) return draft;
    stopTyping();
    const { title, prompt } = CUSTOM_CRITERION;
    const whole = draft.map((criterion) =>
      criterion.id === row ? { ...criterion, title, prompt } : criterion,
    );
    setDraft(whole);
    return whole;
  }

  // Against the candidates in the benchmark — the previous set and the
  // suggested set alike.
  function retest() {
    walkthrough.done("test-criteria");
    walkthrough.done("retest-criteria");
    const draftTested = finishTyping();
    setTested(draftTested);
    setLastRun(benchmark(draftTested, candidates));
    // A new run supersedes whatever the last one suggested.
    setRewrites([]);
    setBenchmarking(true);
    setOpensOn("results");
    results.open();
  }

  // Out of the benchmark, their results go with them; back in, they have none
  // until a retest.
  function removeCandidates(ids: readonly string[]) {
    setRemoved((was) => new Set([...was, ...ids]));
    setLastRun((run) => run.filter((row) => !ids.includes(row.id)));
  }

  function addCandidates(ids: readonly string[]) {
    setRemoved((was) => new Set([...was].filter((id) => !ids.includes(id))));
  }

  // From the stale results' own footer: the overlay stays open and benchmarks
  // in place. The button goes with the results, so the dialog holds focus.
  function retestFromResults() {
    results.dialogProps.ref.current?.focus();
    retest();
  }

  // The last results at once, on either tab.
  function show(tab: CandidatesTab) {
    setBenchmarking(false);
    setOpensOn(tab);
    results.open();
  }
  const viewResults = () => show("results");
  const changeCandidates = () => show("suggested");

  // However the results close, the walkthrough's seventh step is done with.
  function closeResults() {
    walkthrough.done("results-match");
    returnFocus();
  }

  // A retest takes Retest criteria away the moment it starts — the criteria are
  // tested — so the results can close with nothing to hand focus back to; and
  // Safari never focuses a clicked button, so it hands focus to the drawer
  // itself. View benchmark results takes it, unless focus has somewhere better.
  function returnFocus() {
    const drawer = editorsRef.current?.closest("dialog");
    const active = document.activeElement;
    if (active === drawer || active?.closest("dialog") !== drawer)
      viewResultsRef.current?.focus();
  }

  // Closed before it finished, nothing has changed. Finished, the criteria are
  // validated: Validate goes with that, and saving is what is left to do.
  function closeValidation() {
    if (!validationDone.current) {
      validateRef.current?.focus();
      return;
    }
    validationDone.current = false;
    setValidated(draft);
    focusNext.current = saveId;
  }

  function reviewRewrites() {
    walkthrough.done("review-rewrites");
    setRewrites(suggestedRewrites(lastRun));
    results
      .close()
      .then(() =>
        editorsRef.current
          ?.querySelector<HTMLElement>("[data-apply-rewrite]")
          ?.focus(),
      );
  }

  // Either answer takes the suggestion away, and the caret goes to the prompt
  // it was for — rewritten, if it was applied.
  function answerRewrite(rewrite: SuggestedRewrite, apply: boolean) {
    if (apply) {
      walkthrough.done("apply-rewrite");
      edit(rewrite.criterionId, "prompt", rewrite.prompt);
    }
    setRewrites((offered) =>
      offered.filter((suggestion) => suggestion !== rewrite),
    );
    focusNext.current = fieldId(rewrite.criterionId, "prompt");
  }

  const changed = hasChanged(draft, tested);
  // The last results no longer answer for the benchmark: from the retest
  // menu's View last benchmark results the criteria have changed since, or a
  // candidate added back has not been benchmarked.
  const stale =
    changed || candidates.some((id) => !lastRun.some((row) => row.id === id));
  const canValidate = !stale && hasChanged(draft, validated);
  // Validated, and not what is running.
  const canSave = !hasChanged(draft, validated) && hasChanged(draft, running);

  return (
    <>
      <header className={headerStyle}>
        <div className={headingStyle}>
          <p className={eyebrowStyle}>{JOB_TITLE}</p>
          <h2 id={titleId} className={titleStyle}>
            AI-assisted application review criteria
          </h2>
        </div>
        <span className={cx(plainButtonStyle, learnMoreStyle)}>
          <span className={plainButtonLabelStyle}>Learn more</span>
          <GotoIcon aria-hidden />
        </span>
      </header>

      <div className={bodyStyle}>
        <section className={card()}>
          <div className={cardHeaderStyle}>
            <div className={cardTitleBoxStyle}>
              <h3 id={resumeId} className={cardTitleStyle}>
                Resume criteria
              </h3>
            </div>
            <div className={cx(cardActionsStyle, criteriaActionsStyle)}>
              {changed ? <CriteriaChanged /> : <UpToDate />}
              {changed ? (
                // Retest criteria's menu (Figma 96:5262). The previous
                // candidate set and the suggested candidates are the same, so
                // both retest (Figma 73:2989); the last results open at once,
                // and Change candidates... opens them on the suggested list.
                <MenuButton
                  className={primaryButtonStyle}
                  width="wide"
                  triggerRef={retestRef}
                  aria-describedby={
                    walkthrough.describe("test-criteria") ??
                    walkthrough.describe("retest-criteria")
                  }
                  items={[
                    {
                      icon: SuggestionsIcon,
                      label: `Retest with ${candidates.length} suggested candidates`,
                      onSelect: retest,
                    },
                    {
                      icon: PreviousIcon,
                      label: "Retest with previous candidate set",
                      onSelect: retest,
                    },
                    {
                      icon: ChangeIcon,
                      label: "Change candidates...",
                      onSelect: changeCandidates,
                    },
                    {
                      icon: ResultsIcon,
                      label: "View last benchmark results",
                      separated: true,
                      onSelect: viewResults,
                    },
                  ]}
                >
                  <span className={accentButtonLabelStyle}>
                    Retest criteria
                  </span>
                  <RetestChevron aria-hidden />
                </MenuButton>
              ) : (
                <button
                  ref={viewResultsRef}
                  type="button"
                  className={accentButton({ glyphs: "none" })}
                  onClick={viewResults}
                >
                  <span className={accentButtonLabelStyle}>
                    View benchmark results
                  </span>
                </button>
              )}
              {/* Beside it: under it is the criterion just typed in, and
                  then rewritten. */}
              {changed && !typingOn && (
                <>
                  <WalkthroughTip
                    step="test-criteria"
                    anchor={retestRef}
                    side="start"
                  />
                  <WalkthroughTip
                    step="retest-criteria"
                    anchor={retestRef}
                    side="start"
                  />
                </>
              )}
              {/* Only "Add custom" leads anywhere; it cannot add the criterion twice. */}
              <MenuButton
                className={accentButton({ glyphs: "both" })}
                width="narrow"
                triggerRef={addCriteriaRef}
                aria-describedby={walkthrough.describe("add-custom")}
                items={[
                  { icon: SuggestionsIcon, label: "Add from 8 suggestions" },
                  { icon: PreviousIcon, label: "Add previously used" },
                  {
                    icon: CustomIcon,
                    label: "Add custom",
                    onSelect: addCustom,
                    disabled: draft.some(
                      (row) => row.id === CUSTOM_CRITERION.id,
                    ),
                  },
                ]}
              >
                <AddIcon aria-hidden />
                <span className={accentButtonLabelStyle}>Add criteria</span>
                <MenuChevron aria-hidden />
              </MenuButton>
              <WalkthroughTip step="add-custom" anchor={addCriteriaRef} />
            </div>
          </div>

          <ul
            ref={editorsRef}
            className={criterionEditorsStyle}
            aria-labelledby={resumeId}
          >
            {draft.map((row) => {
              const rewrite = rewrites.find(
                (suggestion) => suggestion.criterionId === row.id,
              );
              return (
                <CriterionEditor
                  key={row.id}
                  row={row}
                  titleField={fieldId(row.id, "title")}
                  promptField={fieldId(row.id, "prompt")}
                  onEdit={(field, value) => edit(row.id, field, value)}
                  rewrite={rewrite}
                  onAnswerRewrite={(apply) =>
                    rewrite && answerRewrite(rewrite, apply)
                  }
                />
              );
            })}
          </ul>
        </section>

        <section className={card()}>
          <div className={cardHeaderStyle}>
            <div className={cardTitleBoxStyle}>
              <h3 className={cardTitleStyle}>Application form criteria</h3>
            </div>
          </div>
          <div className={emptyStyle}>
            <p className={emptyTextStyle}>
              Add a question of type <em>Long Unformatted Answer</em> to the
              job’s application form to create criteria based on applicant
              answers.
            </p>
          </div>
        </section>
      </div>

      <footer className={footerStyle}>
        <button
          type="button"
          className={cx(plainButtonStyle, footerButtonStyle)}
          onClick={onCancel}
        >
          <span className={plainButtonLabelStyle}>Cancel</span>
        </button>
        <button
          ref={validateRef}
          type="button"
          className={
            canValidate && rewrites.length === 0
              ? primaryButtonStyle
              : cx(plainButtonStyle, footerButtonStyle)
          }
          disabled={!canValidate}
          onClick={validation.open}
        >
          <span className={plainButtonLabelStyle}>Validate</span>
        </button>
        {canSave ? (
          // No info glyph: it is drawn in the ink, which the accent would drown.
          <button
            id={saveId}
            type="button"
            className={primaryButtonStyle}
            onClick={() => onSave(validated)}
          >
            Save and evaluate all active candidates
          </button>
        ) : (
          <button
            id={saveId}
            type="button"
            className={cx(plainButtonStyle, footerButtonStyle)}
            disabled
          >
            <span className={plainButtonLabelStyle}>Save</span>
            <InfoIcon aria-hidden />
          </button>
        )}
      </footer>

      <BenchmarkDialog
        modal={results}
        rows={lastRun}
        benchmarking={benchmarking}
        opensOn={opensOn}
        stale={stale}
        removed={removed}
        onRemoveCandidates={removeCandidates}
        onAddCandidates={addCandidates}
        onReviewRewrites={reviewRewrites}
        onRetest={retestFromResults}
      />
      <ValidateDialog
        modal={validation}
        onValidated={() => {
          validationDone.current = true;
        }}
      />
    </>
  );
}
