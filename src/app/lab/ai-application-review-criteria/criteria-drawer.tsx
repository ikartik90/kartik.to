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

interface Keystroke {
  delay: number;
  field: Field;
  value: string;
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

const learnMoreStyle = css({
  paddingInlineStart: "8px",
  paddingInlineEnd: "6px",
});

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
  titleId: string;
  running: DraftCriterion[];
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
  const [lastRun, setLastRun] = useState<BenchmarkRow[]>(() =>
    benchmark(running),
  );
  const [benchmarking, setBenchmarking] = useState(false);
  const [opensOn, setOpensOn] = useState<CandidatesTab>("results");
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const candidates = BENCHMARK_CANDIDATES.filter(
    (candidate) => !removed.has(candidate.id),
  ).map((candidate) => candidate.id);
  const results = useModal({ onClosed: closeResults });
  const [validated, setValidated] = useState(running);
  const validation = useModal({ onClosed: closeValidation });
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

  const typing = useRef<{ timer: number; row: string } | null>(null);
  const [typingOn, setTypingOn] = useState(false);
  // Focused after the next commit, once its row exists.
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
        // Never take focus from a field the recruiter has since moved to.
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

  function retest() {
    walkthrough.done("test-criteria");
    walkthrough.done("retest-criteria");
    const draftTested = finishTyping();
    setTested(draftTested);
    setLastRun(benchmark(draftTested, candidates));
    setRewrites([]);
    setBenchmarking(true);
    setOpensOn("results");
    results.open();
  }

  function removeCandidates(ids: readonly string[]) {
    setRemoved((was) => new Set([...was, ...ids]));
    setLastRun((run) => run.filter((row) => !ids.includes(row.id)));
  }

  function addCandidates(ids: readonly string[]) {
    setRemoved((was) => new Set([...was].filter((id) => !ids.includes(id))));
  }

  // The clicked button unmounts with the results, so the dialog takes focus.
  function retestFromResults() {
    results.dialogProps.ref.current?.focus();
    retest();
  }

  function show(tab: CandidatesTab) {
    setBenchmarking(false);
    setOpensOn(tab);
    results.open();
  }
  const viewResults = () => show("results");
  const changeCandidates = () => show("suggested");

  function closeResults() {
    walkthrough.done("results-match");
    returnFocus();
  }

  // The opener may be gone (a retest removes it) and Safari never focuses a clicked
  // button, so focus can end up on the drawer itself; View benchmark results takes it.
  function returnFocus() {
    const drawer = editorsRef.current?.closest("dialog");
    const active = document.activeElement;
    if (active === drawer || active?.closest("dialog") !== drawer)
      viewResultsRef.current?.focus();
  }

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
  const stale =
    changed || candidates.some((id) => !lastRun.some((row) => row.id === id));
  const canValidate = !stale && hasChanged(draft, validated);
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
