import { Fragment, useId, type ReactNode } from "react";
import { css, cva, cx } from "../../../../styled-system/css";
import { KNOWN_OUTCOMES, benchmark, suggestedRewrites } from "./benchmark";
import {
  EvaluationRing,
  ResultRow,
  ResultsTable,
  cautionStyle,
  outcomeTag,
} from "./benchmark-results";
import { nameStyle } from "./candidate-table";
import { Checkbox } from "./checkbox";
import { AvgScore } from "./avg-score";
import { CriterionEditor, criterionEditorsStyle } from "./criterion-editor";
import { CUSTOM_CRITERION, STARTING_CRITERIA } from "./job";
import { NoWalkthrough } from "./walkthrough";
import type { KnownOutcome } from "./harness-data";
import {
  accentButton,
  accentButtonLabelStyle,
  card,
  cardActionsStyle,
  cardHeaderStyle,
  cardTitleBoxStyle,
  cardTitleStyle,
  UpToDate,
} from "./parts";
import FlaggedIcon from "./icons/changed-warning.svg";
import CriterionIcon from "./icons/document-check.svg";
import AddIcon from "./icons/add.svg";
import MenuChevron from "./icons/chevron-down-accent.svg";

// ---------------------------------------------------------------------------
// The intro's pictures, as Figma draws them: on the title page, every benchmark
// candidate's ring (147:8677); then pieces of the product laid over a
// lilac-to-rose wash and cut off by its bottom edge, each showing what its page
// says — the review card with the new criterion flagged, its prompts sketched
// as bars, and a candidate it turns away (133:6248); the results table
// (134:6311); the drawer's resume criteria with the rewrite that fixes New Logo
// Acquisition (134:6823). The product's own parts wherever it has them, and
// benchmarked as the drawer tests the criteria — new one on top, so every ring
// reads in the list's order. Pictures only: out of the accessibility tree, and
// inert.
// ---------------------------------------------------------------------------

const nothing = () => {};

// Too narrow for the pieces side by side, in a dialog on a phone: they step
// down instead, below the dialog's close button.
const NARROW = "@container (max-width: 520px)";

/**
 * The four criteria as the drawer tests them once the custom one is added — on
 * top — and their benchmark, whose rings follow that order.
 */
const TESTED = [CUSTOM_CRITERION, ...STARTING_CRITERIA];
const ROWS = benchmark(TESTED.map(({ id, prompt }) => ({ id, prompt })));
const DANA = ROWS.find((row) => row.id === "dana")!;

// The text under it draws the rule between them.
const coverStyle = css({
  position: "relative",
  containerType: "inline-size",
  flexShrink: 0,
  height: "300px",
  overflow: "hidden",
  backgroundImage:
    "linear-gradient(108.43deg, var(--cashby-cover-lilac) 0%, var(--cashby-cover-rose) 94.444%)",
});

// A piece of the product, lifted off the wash, white under whatever it draws.
// A card is rounded small and outlined, the outline drawn over what it holds as
// the product draws its own (Figma 133:6248); the results table is rounded as
// the results' panel is, and edged by its shadow alone (Figma 134:6311).
const panel = cva({
  base: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "var(--cashby-surface)",
    boxShadow: "0 0 25px var(--cashby-border)",
  },
  variants: {
    shape: {
      card: {
        borderRadius: "8px",
        _after: {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
          pointerEvents: "none",
        },
      },
      table: { borderRadius: "12px" },
      // The drawer's card draws its own band and outline (Figma 134:6823).
      drawerCard: { borderRadius: "16px" },
    },
  },
  defaultVariants: { shape: "card" },
});

// A titled one: the band is the product's translucent grey, over the white.
const bandedStyle = css({
  backgroundImage: "linear-gradient(var(--cashby-fill), var(--cashby-fill))",
});

// The product's own parts, drawn: a rewrite's Apply here is not the one the
// walkthrough points at.
function Cover({ children }: { children: ReactNode }) {
  return (
    <div data-cover="" aria-hidden inert className={coverStyle}>
      <NoWalkthrough>{children}</NoWalkthrough>
    </div>
  );
}

// --- Benchmarking AI review criteria ----------------------------------------

const OUTCOME_GROUP: Record<KnownOutcome, string> = {
  hired: "Past hires",
  "archived-interview": "Archived after interview",
  "archived-application-review": "Archived at application review",
};

// Over the title page's own wash, which runs on under its text.
const titleCoverStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  height: "300px",
  overflow: "hidden",
});

const outcomesStyle = css({
  display: "flex",
  gap: "8px",
  paddingBlockStart: "20px",
});

// Its label over it, clear of the rings.
const outcomeGroupStyle = css({
  position: "relative",
  display: "flex",
  gap: "8px",
  height: "68px",
});

const outcomeGroupLabelStyle = css({
  position: "absolute",
  insetBlockStart: "-24px",
  insetInlineStart: "50%",
  transform: "translateX(-50%)",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate-subtle)",
  whiteSpace: "nowrap",
});

// Drawn over the gap, taking none of it, as Figma's zero-width rule does.
const outcomeRuleStyle = css({
  flexShrink: 0,
  width: "var(--cashby-rule)",
  marginInline: "calc(var(--cashby-rule) / -2)",
  height: "68px",
  backgroundColor: "var(--cashby-border)",
});

const outcomeCandidateStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

// A box of its own, so the ring (an inline span) takes its size.
const outcomeRingStyle = css({ display: "flex", padding: "8px" });

/**
 * The benchmark at a glance: each candidate's ring, grouped by how they are
 * known to have ended, and marked under it where the criteria get them wrong.
 */
export function TitleCover() {
  return (
    <div data-cover="" aria-hidden inert className={titleCoverStyle}>
      <div className={outcomesStyle}>
        {KNOWN_OUTCOMES.map((outcome, index) => (
          <Fragment key={outcome}>
            {index > 0 && <span className={outcomeRuleStyle} />}
            <div className={outcomeGroupStyle}>
              <p className={outcomeGroupLabelStyle}>{OUTCOME_GROUP[outcome]}</p>
              {ROWS.filter((row) => row.knownOutcome === outcome).map((row) => (
                <div key={row.id} className={outcomeCandidateStyle}>
                  <span className={outcomeRingStyle}>
                    <EvaluationRing
                      bare
                      evaluations={row.evaluations}
                      met={row.met}
                    />
                  </span>
                  {row.mismatch && <FlaggedIcon />}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// --- AI criteria can silently exclude strong candidates ---------------------

/** Each criterion's prompt, sketched on the review card as two bars this wide. */
const PROMPT_BARS: Record<string, readonly number[]> = {
  [CUSTOM_CRITERION.id]: [321, 73.8],
  "full-cycle": [278, 125],
  crm: [342, 194],
  "large-deals": [278, 125],
};

const reviewPanelStyle = css({
  insetBlockStart: "42px",
  insetInlineStart: "59.5px",
  width: "401px",
  [NARROW]: { insetBlockStart: "52px", insetInlineStart: "24px" },
});

const candidatePanelStyle = css({
  insetBlockStart: "80px",
  insetInlineStart: "420.5px",
  width: "320px",
  [NARROW]: {
    insetBlockStart: "104px",
    insetInlineStart: "auto",
    insetInlineEnd: "16px",
    width: "280px",
  },
});

// The review card's band: its title set 12px in, with no box of its own.
const reviewHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  height: "48px",
  paddingInline: "12px",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-border)",
});

// A row of the card: white, or washed and ruled in the caution colour where it
// is flagged; a glyph in its margin, or the wider margin of a ring. The last
// row goes unruled: the card's outline closes it.
const row = cva({
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingBlock: "8px",
    paddingInlineStart: "32px",
    paddingInlineEnd: "4px",
    borderBlockEndWidth: "var(--cashby-rule)",
    borderBlockEndStyle: "solid",
    backgroundColor: "var(--cashby-surface)",
    _last: { borderBlockEndWidth: 0 },
  },
  variants: {
    flagged: {
      false: { borderBlockEndColor: "var(--cashby-border)" },
      true: {
        backgroundImage:
          "linear-gradient(var(--cashby-caution-tint), var(--cashby-caution-tint))",
        borderBlockEndColor: "var(--cashby-caution-border)",
      },
    },
    ringed: { true: { paddingInlineStart: "36px" } },
  },
});

const rowTitle = cva({
  base: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  variants: {
    flagged: {
      false: { font: "var(--cashby-text-body)" },
      true: {
        font: "var(--cashby-text-body-strong)",
        color: "var(--cashby-caution-ink)",
      },
    },
  },
});

const rowGlyphStyle = css({
  position: "absolute",
  insetBlockStart: "10px",
  insetInlineStart: "8px",
});

// A box of its own, so the ring (an inline span) takes its size.
const rowRingStyle = css({
  position: "absolute",
  display: "flex",
  insetBlockStart: "8px",
  insetInlineStart: "8px",
});

// A prompt's line, sketched: a rounded bar in the middle of a line's height.
const barLineStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "20px",
  paddingInline: "1px",
});

const bar = cva({
  base: { height: "9px", borderRadius: "6px" },
  variants: {
    flagged: {
      false: { backgroundColor: "var(--cashby-border)" },
      true: { backgroundColor: "var(--cashby-caution-border)" },
    },
  },
});

const candidateHeadStyle = css({
  display: "flex",
  alignItems: "flex-start",
  backgroundColor: "var(--cashby-surface)",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-border)",
});

const candidateNameStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  flex: "1 0 0",
  minWidth: "1px",
  overflow: "hidden",
  padding: "8px",
});

const candidateScoreStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  flexShrink: 0,
  width: "88px",
  height: "64px",
  overflow: "hidden",
  padding: "8px",
});

const scoreLabelStyle = css({
  font: "var(--cashby-text-fine)",
  color: "var(--cashby-slate)",
  whiteSpace: "nowrap",
});

const verdictNoteStyle = css({
  font: "var(--cashby-text-fine)",
  color: "var(--cashby-caution-ink)",
});

/** The review card with the new criterion flagged, and a strong fit it turns away. */
export function BlindCover() {
  return (
    <Cover>
      <div className={cx(panel(), bandedStyle, reviewPanelStyle)}>
        <div className={reviewHeaderStyle}>
          <p className={cardTitleStyle}>AI-assisted application review</p>
        </div>
        {TESTED.map(({ id, title }) => {
          const flagged = id === CUSTOM_CRITERION.id;
          return (
            <div key={id} className={row({ flagged })}>
              <p className={rowTitle({ flagged })}>{title}</p>
              <div>
                {PROMPT_BARS[id].map((width) => (
                  <div key={width} className={barLineStyle}>
                    <div className={bar({ flagged })} style={{ width }} />
                  </div>
                ))}
              </div>
              {flagged ? (
                <FlaggedIcon className={rowGlyphStyle} />
              ) : (
                <CriterionIcon className={rowGlyphStyle} />
              )}
            </div>
          );
        })}
      </div>
      <div className={cx(panel(), bandedStyle, candidatePanelStyle)}>
        <div className={candidateHeadStyle}>
          <div className={candidateNameStyle}>
            <span className={nameStyle}>{DANA.name}</span>
            <span className={outcomeTag({ outcome: "hired" })}>
              Potential High Fit
            </span>
          </div>
          <div className={candidateScoreStyle}>
            <span className={scoreLabelStyle}>Avg. score</span>
            <AvgScore value={DANA.avgScore} small />
          </div>
        </div>
        <div className={row({ flagged: true, ringed: true })}>
          <p className={rowTitle({ flagged: true })}>Excluded</p>
          <p className={verdictNoteStyle}>
            Candidate matches role requirement but gets silently filtered out
            because it fails to meet the criteria.
          </p>
          <span className={rowRingStyle}>
            <EvaluationRing
              small
              evaluations={DANA.evaluations}
              met={DANA.met}
              className={cautionStyle}
            />
          </span>
        </div>
      </div>
    </Cover>
  );
}

// --- Test your criteria against talent with known outcomes ------------------

// The results as the product shows them (Figma 139:7502): two hires, one the
// criteria exclude, then two archived, one they let through. It runs off the
// right edge, as the table runs on past the window in the product.
const KNOWN_OUTCOME_ROWS = ["renee", "dana", "sam", "tomas"].map(
  (id) => ROWS.find((row) => row.id === id)!,
);

const tablePanelStyle = css({
  insetBlockStart: "42px",
  insetInlineStart: "59px",
  width: "830px",
  [NARROW]: { insetBlockStart: "52px", insetInlineStart: "24px" },
});

/** How the first four candidates came out, against what really happened. */
export function KnownOutcomesCover() {
  const tableId = useId();
  return (
    <Cover>
      <div className={cx(panel({ shape: "table" }), tablePanelStyle)}>
        <ResultsTable
          labelledBy={tableId}
          selectAll={
            <Checkbox
              label="Select all candidates"
              checked={false}
              onChange={nothing}
            />
          }
        >
          {KNOWN_OUTCOME_ROWS.map((result, index) => (
            <ResultRow
              key={result.id}
              candidate={result}
              result={result}
              striped={index % 2 === 1}
              selected={false}
              onSelect={nothing}
              unfolded={false}
              onToggle={nothing}
            />
          ))}
        </ResultsTable>
      </div>
    </Cover>
  );
}

// --- Walk through an example ------------------------------------------------

// The drawer's resume criteria once the test has found what to fix (Figma
// 134:6823): up to date, New Logo Acquisition on top with its rewrite, and the
// rest of the list running on under the edge.
const drawerPanelStyle = css({
  insetBlockStart: "42px",
  insetInlineStart: "59px",
  width: "682px",
  [NARROW]: { insetBlockStart: "52px", insetInlineStart: "24px" },
});

const drawerActionsStyle = css({ gap: "8px" });

/** The criterion found at fault, and the rewrite that fixes it. */
export function ExampleCover() {
  const fieldId = useId();
  const [rewrite] = suggestedRewrites(ROWS);
  return (
    <Cover>
      <div className={cx(panel({ shape: "drawerCard" }), drawerPanelStyle)}>
        <div className={card()}>
          <div className={cardHeaderStyle}>
            <div className={cardTitleBoxStyle}>
              <p className={cardTitleStyle}>Resume criteria</p>
            </div>
            <div className={cx(cardActionsStyle, drawerActionsStyle)}>
              <UpToDate />
              <span className={accentButton({ glyphs: "none" })}>
                <span className={accentButtonLabelStyle}>
                  View benchmark results
                </span>
              </span>
              <span className={accentButton({ glyphs: "both" })}>
                <AddIcon />
                <span className={accentButtonLabelStyle}>Add criteria</span>
                <MenuChevron />
              </span>
            </div>
          </div>
          <ul className={criterionEditorsStyle}>
            {TESTED.map(({ id, title, prompt }) => (
              <CriterionEditor
                key={id}
                row={{ id, title, prompt }}
                titleField={`${fieldId}-${id}-title`}
                promptField={`${fieldId}-${id}-prompt`}
                onEdit={nothing}
                rewrite={rewrite.criterionId === id ? rewrite : undefined}
                onAnswerRewrite={nothing}
              />
            ))}
          </ul>
        </div>
      </div>
    </Cover>
  );
}
