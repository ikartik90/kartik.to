import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../../styled-system/css";
import { notice } from "../../../styled-system/recipes";
import { WireframeText } from "./wireframe";

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function NoticeRoot({ className, children, ...rest }: NoticeProps) {
  return (
    <div className={cx(notice().root, className)} {...rest}>
      {children}
    </div>
  );
}

export interface NoticeIconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

function NoticeIcon({ className, children, ...rest }: NoticeIconProps) {
  return (
    <span aria-hidden className={cx(notice().icon, className)} {...rest}>
      {children}
    </span>
  );
}

export interface NoticeLabelProps
  extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

/** Wrap the salient bits in `<strong>`. */
function NoticeLabel({ className, children, ...rest }: NoticeLabelProps) {
  return (
    <p className={cx(notice().label, className)} {...rest}>
      <WireframeText>{children}</WireframeText>
    </p>
  );
}

export const Notice = Object.assign(NoticeRoot, {
  Icon: NoticeIcon,
  Label: NoticeLabel,
});
