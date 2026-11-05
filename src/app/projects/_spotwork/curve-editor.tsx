"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { css } from "../../../../styled-system/css";
import { beginControlDrag, endControlDrag } from "@/utils/control-drag";
import { eased, type Curve } from "./fade";

// A cubic-bezier's two control points dragged on its graph: time across, progress up.

const rootStyle = css({ display: "flex", flexDirection: "column", gap: "sm" });

const boxStyle = css({
  position: "relative",
  aspectRatio: "2",
  borderRadius: "sm",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "field.bg.default",
});

// Inset, so a handle at an end of the curve isn't clipped.
const plotStyle = css({ position: "absolute", inset: "md", touchAction: "none" });

const svgStyle = css({
  position: "absolute",
  inset: 0,
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  overflow: "visible",
  fill: "none",
  "& path": { vectorEffect: "non-scaling-stroke" },
});
const linearStroke = css({
  stroke: "field.border.default",
  strokeWidth: "token(spacing.xxs)",
  strokeDasharray: "token(spacing.xs) token(spacing.xs)",
});
const tangentStroke = css({ stroke: "text.body", strokeWidth: "token(spacing.xxs)", opacity: 0.5 });
const curveStroke = css({ stroke: "text.default", strokeWidth: "token(spacing.xs)", strokeLinecap: "round" });

const handleStyle = css({
  position: "absolute",
  width: "token(spacing.lg)",
  height: "token(spacing.lg)",
  padding: 0,
  translate: "-50% -50%",
  borderRadius: "full",
  borderWidth: "token(spacing.xs)",
  borderStyle: "solid",
  borderColor: "text.default",
  backgroundColor: "bg.canvas",
  cursor: "grab",
  touchAction: "none",
  transition: "border-color 150ms ease",
  _hover: { borderColor: "text.highlight" },
  _active: { cursor: "grabbing", borderColor: "text.highlight" },
  _focusVisible: { outline: "none", borderColor: "text.highlight" },
});

const readoutStyle = css({ textStyle: "code", color: "text.body" });

const W = 100;
const H = 100;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 100) / 100;

export function CurveEditor({ curve, onCurveChange }: { curve: Curve; onCurveChange: (curve: Curve) => void }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const alpha = eased({ amount: 1, curve });
  const path = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return `${i ? "L" : "M"}${(t * W).toFixed(2)} ${((1 - alpha(t)) * H).toFixed(2)}`;
  }).join(" ");
  const [x1, y1, x2, y2] = curve;

  const move = (index: 0 | 1, x: number, y: number) => {
    const next = [...curve] as Curve;
    next[index * 2] = round(clamp(x));
    next[index * 2 + 1] = round(clamp(y));
    onCurveChange(next);
  };

  const handle = (index: 0 | 1) => {
    const [x, y] = [curve[index * 2], curve[index * 2 + 1]];
    const drag = (event: PointerEvent<HTMLButtonElement>) => {
      const rect = plotRef.current!.getBoundingClientRect();
      move(index, (event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
    };
    return (
      <button
        type="button"
        className={handleStyle}
        style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
        aria-label={`${index ? "Second" : "First"} control point: x ${x}, y ${y}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginControlDrag(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event);
        }}
        onLostPointerCapture={(event) => endControlDrag(event.pointerId)}
        onKeyDown={(event: KeyboardEvent) => {
          const step = event.shiftKey ? 0.1 : 0.01;
          const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[
            event.key
          ];
          if (!by) return;
          event.preventDefault();
          move(index, x + by[0], y + by[1]);
        }}
      />
    );
  };

  return (
    <div className={rootStyle}>
      <div className={boxStyle}>
        <div ref={plotRef} className={plotStyle}>
          <svg className={svgStyle} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <path className={linearStroke} d={`M0 ${H}L${W} 0`} />
            <path
              className={tangentStroke}
              d={`M0 ${H}L${x1 * W} ${(1 - y1) * H}M${W} 0L${x2 * W} ${(1 - y2) * H}`}
            />
            <path className={curveStroke} d={path} />
          </svg>
          {handle(0)}
          {handle(1)}
        </div>
      </div>
      <span className={readoutStyle}>{curve.join(", ")}</span>
    </div>
  );
}
