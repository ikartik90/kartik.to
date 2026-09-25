"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import type { useModal } from "./modal";
import { overlayBase } from "./overlay";
import { ProgressBar } from "./progress-bar";
import { primaryButtonStyle } from "./parts";
import { RULE_ABOVE, RULE_BELOW } from "./candidate-table";
import ValidIcon from "./icons/check-circle-ink.svg";

export const VALIDATING_MS = 300;

const dialogStyle = css(overlayBase, {
  margin: "auto",
  width: "320px",
  maxWidth: "calc(100% - 40px)",
  height: "200px",
  maxHeight: "calc(100% - 40px)",
  borderRadius: "12px",
  // An ::after outline: the footer's fill would cover an inset shadow.
  _after: {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
    pointerEvents: "none",
  },
});

const headerStyle = css({
  flexShrink: 0,
  padding: "8px",
  boxShadow: RULE_BELOW,
});

const titleStyle = css({ font: "var(--cashby-text-label)" });

const bodyStyle = css({
  display: "flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 0,
  padding: "8px",
});

const progressStyle = css({ width: "100%", paddingInline: "32px" });

const resultStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  font: "var(--cashby-text-label)",
});

const footerStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  flexShrink: 0,
  height: "48px",
  padding: "8px",
  backgroundColor: "var(--cashby-fill)",
  boxShadow: RULE_ABOVE,
});

export function ValidateDialog({
  modal,
  onValidated,
}: {
  modal: ReturnType<typeof useModal>;
  onValidated: () => void;
}) {
  const titleId = useId();
  return (
    <dialog
      {...modal.dialogProps}
      className={dialogStyle}
      aria-labelledby={titleId}
    >
      <header className={headerStyle}>
        <h2 id={titleId} className={titleStyle}>
          Validating job criteria
        </h2>
      </header>
      {modal.session > 0 && (
        <Validation
          key={modal.session}
          titleId={titleId}
          onValidated={onValidated}
          onClose={() => void modal.close()}
        />
      )}
    </dialog>
  );
}

function Validation({
  titleId,
  onValidated,
  onClose,
}: {
  titleId: string;
  onValidated: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // An effect event, so a new `onValidated` doesn't restart the timer.
  const finish = useEffectEvent(() => {
    setDone(true);
    onValidated();
  });

  useEffect(() => {
    const timer = window.setTimeout(finish, VALIDATING_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (done) closeRef.current?.focus();
  }, [done]);

  return (
    <>
      <div aria-live="polite" className={bodyStyle}>
        {done ? (
          <p className={resultStyle}>
            <ValidIcon aria-hidden />
            All criteria are valid
          </p>
        ) : (
          <div className={progressStyle}>
            <ProgressBar labelledBy={titleId} ms={VALIDATING_MS} />
          </div>
        )}
      </div>
      {done && (
        <footer className={footerStyle}>
          <button
            ref={closeRef}
            type="button"
            className={primaryButtonStyle}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      )}
    </>
  );
}
