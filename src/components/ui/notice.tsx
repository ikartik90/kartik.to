import { type HTMLAttributes, type ReactNode } from "react";
import { css, cx } from "../../../styled-system/css";
import type { SystemStyleObject } from "../../../styled-system/types";
import { WireframeText } from "./wireframe";

const noticeRootStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "sm",
  width: "token(spacing.full)",
  paddingInline: "md",
  paddingBlock: "md",
  borderRadius: "sm",
  backgroundColor: "bg.notice",
  color: "field.text.default",
});

const noticeIconBase = css.raw({
  flexShrink: 0,
  display: "block",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  "& svg": {
    width: "token(spacing.full)",
    height: "token(spacing.full)",
    display: "block",
  },
  "& svg path[stroke], & svg circle[stroke]": {
    stroke: "currentColor",
  },
  "& svg path[fill], & svg circle[fill]": { fill: "currentColor" },
});

const noticeLabelBase = css.raw({
  flex: "1 1 0",
  minWidth: 0,
  textStyle: "sidenote",
  color: "field.text.default/75",
  wordBreak: "break-word",
  "& :is(strong, b)": {
    color: "field.text.default",
    fontWeight: "bold",
  },
});

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function NoticeRoot({ className, children, ...rest }: NoticeProps) {
  return (
    <div className={cx(noticeRootStyle, className)} {...rest}>
      {children}
    </div>
  );
}

export interface NoticeIconProps extends HTMLAttributes<HTMLSpanElement> {
  /** Merged over the icon's own styles; pass a `css.raw()` so Panda extracts it. */
  css?: SystemStyleObject;
  children: ReactNode;
}

function NoticeIcon({
  css: cssProp,
  className,
  children,
  ...rest
}: NoticeIconProps) {
  return (
    <span
      aria-hidden
      className={cx(css(noticeIconBase, cssProp), className)}
      {...rest}
    >
      {children}
    </span>
  );
}

export interface NoticeLabelProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Merged over the label's own styles; pass a `css.raw()` so Panda extracts it. */
  css?: SystemStyleObject;
  children: ReactNode;
}

/** Wrap the salient bits in `<strong>`. */
function NoticeLabel({
  css: cssProp,
  className,
  children,
  ...rest
}: NoticeLabelProps) {
  return (
    <p className={cx(css(noticeLabelBase, cssProp), className)} {...rest}>
      <WireframeText>{children}</WireframeText>
    </p>
  );
}

export const Notice = Object.assign(NoticeRoot, {
  Icon: NoticeIcon,
  Label: NoticeLabel,
});
