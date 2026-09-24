import { useId, useRef } from "react";
import { css } from "../../../../styled-system/css";
import type { SuggestedRewrite } from "./benchmark";
import { accentButton, accentButtonLabelStyle } from "./parts";
import { useWalkthrough, WalkthroughTip } from "./walkthrough";
import SuggestionIcon from "./icons/suggestion.svg";

// ---------------------------------------------------------------------------
// A suggested rewrite, under the prompt it would replace (Figma 86:3757): the
// whole rewritten prompt, with what it adds marked, and the two answers to it.
//
// Offered, not applied — the prompt above is still the one that was tested —
// until Apply puts it there (Figma 93:4095). Ignore dismisses it. Applying it
// is the walkthrough's fifth step, and its tip points at Apply.
// ---------------------------------------------------------------------------

const boxStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  width: "100%",
  paddingBlock: "8px",
  paddingInlineStart: "32px",
  paddingInlineEnd: "8px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-caution-tint)",
});

const iconStyle = css({
  position: "absolute",
  insetBlockStart: "10px",
  insetInlineStart: "8px",
});

const titleStyle = css({
  font: "var(--cashby-text-body-strong)",
  color: "var(--cashby-caution-ink)",
});

const textStyle = css({
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate)",
});

const addedStyle = css({
  font: "var(--cashby-text-label)",
  color: "var(--cashby-caution-ink)",
  textDecorationLine: "underline",
  textDecorationThickness: "from-font",
  textUnderlinePosition: "from-font",
  textDecorationSkipInk: "none",
});

const actionsStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  paddingBlockStart: "8px",
});

const ignoreStyle = css({
  display: "flex",
  alignItems: "center",
  height: "32px",
  paddingInline: "12px",
  borderRadius: "8px",
  color: "var(--cashby-accent)",
  font: "var(--cashby-text-body-strong)",
  whiteSpace: "nowrap",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
});

export interface RewriteSuggestionProps {
  rewrite: SuggestedRewrite;
  onApply: () => void;
  onIgnore: () => void;
}

export function RewriteSuggestion({
  rewrite,
  onApply,
  onIgnore,
}: RewriteSuggestionProps) {
  const titleId = useId();
  const applyRef = useRef<HTMLButtonElement>(null);
  const walkthrough = useWalkthrough();
  const at = rewrite.prompt.indexOf(rewrite.addedClause);
  return (
    <div role="group" aria-labelledby={titleId} className={boxStyle}>
      <SuggestionIcon aria-hidden className={iconStyle} />
      <p id={titleId} className={titleStyle}>
        Suggested rewrite
      </p>
      <p className={textStyle}>
        {rewrite.prompt.slice(0, at)}
        <span className={addedStyle}>{rewrite.addedClause}</span>
        {rewrite.prompt.slice(at + rewrite.addedClause.length)}
      </p>
      <div className={actionsStyle}>
        {/* Where focus lands on the way back from the benchmark. */}
        <button
          ref={applyRef}
          type="button"
          className={accentButton({ glyphs: "none" })}
          data-apply-rewrite=""
          aria-describedby={walkthrough.describe("apply-rewrite")}
          onClick={onApply}
        >
          <span className={accentButtonLabelStyle}>
            Apply suggested rewrite
          </span>
        </button>
        {/* Under it: over it is the rewrite it would apply. */}
        <WalkthroughTip step="apply-rewrite" anchor={applyRef} />
        <button type="button" className={ignoreStyle} onClick={onIgnore}>
          Ignore
        </button>
      </div>
    </div>
  );
}
