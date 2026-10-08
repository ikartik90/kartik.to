import { css } from "../../../styled-system/css";

// The figures' dotted ground, under its host's words (`zIndex` below 0), so the host isolates it. In a framed card it
// stops inside the edge (`data-inset`), so it never blends with the frame.

const dotsStyle = css({
  "--grid-ink": "color-mix(in srgb, token(colors.neutral.500) 15%, transparent)",
  _dark: { "--grid-ink": "color-mix(in srgb, token(colors.neutral.500) 25%, transparent)" },
  // In a metric card, a feature's icon box or a graphic's card, the project cards' own dots (`figure.tsx`): text.default
  // at 10%, unblended. Restated for dark, which would otherwise win the tie.
  ":is([data-metric-card], [data-feature-icon], [data-take-card]) > &": {
    "--grid-ink": "color-mix(in srgb, token(colors.text.default) 10%, transparent)",
    _dark: { "--grid-ink": "color-mix(in srgb, token(colors.text.default) 10%, transparent)" },
    mixBlendMode: "normal",
  },
  position: "absolute",
  zIndex: -1,
  inset: 0,
  backgroundImage: "radial-gradient(circle, var(--grid-ink) 0 token(spacing.3xs), transparent token(spacing.xxs))",
  backgroundSize: "token(spacing.sm) token(spacing.sm)",
  mixBlendMode: "color-dodge",
  pointerEvents: "none",
  "&[data-inset]": { inset: "xxs", borderRadius: "calc(token(radii.lg) - token(spacing.xxs))" },
});

/** `mask` fades them, as a CSS mask image. */
export function Dots({ inset, mask }: { inset?: boolean; mask?: string }) {
  return (
    <span
      aria-hidden
      className={dotsStyle}
      data-inset={inset ? "" : undefined}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    />
  );
}
