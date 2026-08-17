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

// Single home for all typography styles. All variant values are static string
// literals so Panda's extractor generates the CSS at build time.
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
        // `balance` rather than the base's `pretty`: a caption is a line or
        // two set under something and centred on it, so what matters is that
        // the lines come out even — `pretty` only guards the last one, which
        // leaves a centred caption looking bottom-heavy.
        textStyle: "caption",
        textWrap: "balance",
      },
      sidenote: {
        textStyle: "sidenote",
      },
    },
    // The base's `pretty` is right for prose that runs on — it guards the last
    // line and leaves the rest alone. A short centred paragraph standing on its
    // own wants every line even instead, and that has to be asked for HERE: the
    // base is an atomic utility, so a `text-wrap` from the call site would sit
    // in the same layer at the same specificity and the winner would be
    // stylesheet order. As a variant it is merged into one class before
    // anything is emitted.
    wrap: {
      balance: {
        textWrap: "balance",
      },
    },
  },
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement> {
  tag: TypographyTag;
  type: TypographyType;
  /** Even out the lines instead of the type's own wrapping. */
  wrap?: "balance";
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
