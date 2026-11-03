"use client";

import { useEffect, useState, type ReactNode } from "react";
import CheckIcon from "@/assets/icons/check.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

// A sidebar's Copy values, Paste values and Reset, for its header. `onPaste` takes the parsed JSON and
// says whether it held any values.

const NOTES = { copied: "Copied", pasted: "Pasted", failed: "No values on the clipboard" };

export function ValuesActions({
  values,
  onPaste,
  onReset,
}: {
  values: unknown;
  onPaste: (pasted: unknown) => boolean;
  onReset: () => void;
}) {
  const [clip, setClip] = useState<keyof typeof NOTES | null>(null);
  useEffect(() => {
    if (!clip) return;
    const timer = setTimeout(() => setClip(null), 1500);
    return () => clearTimeout(timer);
  }, [clip]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      setClip("copied");
    } catch {
      setClip("failed");
    }
  };
  const paste = async () => {
    try {
      setClip(onPaste(JSON.parse(await navigator.clipboard.readText())) ? "pasted" : "failed");
    } catch {
      setClip("failed");
    }
  };

  const action = (label: string, icon: ReactNode, onClick: () => void) => (
    <Button variant="icon" aria-label={label} onClick={onClick}>
      {icon}
      <Button.Tooltip>
        <Tooltip.Text>{label}</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );

  return (
    <>
      {action(
        clip === "copied" ? NOTES.copied : "Copy values",
        clip === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />,
        copy,
      )}
      {action(
        clip === "pasted" || clip === "failed" ? NOTES[clip] : "Paste values",
        clip === "pasted" ? <CheckIcon aria-hidden /> : <ReplaceIcon aria-hidden />,
        paste,
      )}
      {action("Reset", <ResetIcon aria-hidden />, onReset)}
    </>
  );
}
