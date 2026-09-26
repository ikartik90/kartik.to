import { cva, cx } from "../../../styled-system/css";
import { WireframeText } from "./wireframe";

export type TypographyType =
  | "title"
  | "subheading"
  | "bodyLarge"
  | "bodySmall"
  | "quote"
  | "caption"
  | "sidenote";

export type TypographyTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "blockquote"
  | "figcaption"
  | "small"
  | "cite"
  | "label";

// Variant values must stay static literals so Panda can extract them at build time.
export const typographyStyles = cva({
  base: {
    color: "text.default",
    textWrap: "pretty",
  },
  variants: {
    type: {
      title: {
        textStyle: "title",
        color: "text.title",
        textWrap: "balance",
      },
      subheading: {
        textStyle: "subheading",
        textWrap: "balance",
      },
      bodyLarge: {
        textStyle: "bodyLarge",
        color: "text.body",
      },
      bodySmall: {
        textStyle: "bodySmall",
        color: "text.body",
      },
      quote: {
        textStyle: "quote",
      },
      caption: {
        textStyle: "caption",
        textWrap: "balance",
      },
      sidenote: {
        textStyle: "sidenote",
      },
    },
    // A variant, not a call-site `textWrap`, which would tie with the base on specificity.
    wrap: {
      balance: {
        textWrap: "balance",
      },
      nowrap: {
        textWrap: "nowrap",
      },
    },
  },
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement> {
  tag: TypographyTag;
  type: TypographyType;
  /** `balance` evens out the lines; `nowrap` keeps one line. */
  wrap?: "balance" | "nowrap";
  children: React.ReactNode;
  className?: string;
}

export function Typography({
  tag: Tag,
  type,
  wrap,
  children,
  className,
  ...rest
}: TypographyProps) {
  return (
    <Tag className={cx(typographyStyles({ type, wrap }), className)} {...rest}>
      <WireframeText>{children}</WireframeText>
    </Tag>
  );
}
