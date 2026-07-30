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
        textStyle: "caption",
      },
      sidenote: {
        textStyle: "sidenote",
      },
    },
  },
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement> {
  tag: TypographyTag;
  type: TypographyType;
  children: React.ReactNode;
  className?: string;
}

export function Typography({
  tag: Tag,
  type,
  children,
  className,
  ...rest
}: TypographyProps) {
  return (
    <Tag className={cx(typographyStyles({ type }), className)} {...rest}>
      <WireframeText>{children}</WireframeText>
    </Tag>
  );
}
