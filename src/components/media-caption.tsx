import type { HTMLAttributes } from "react";
import { Typography, type TypographyType } from "@/components/ui/typography";
import type { MediaCaptionStyle, MediaNode } from "@/domain/nodes";

/** The type a picture's caption is drawn in, on the page and in the editor. */
export const CAPTION_TYPE: Record<MediaCaptionStyle, TypographyType> = {
  caption: "caption",
  paragraph: "bodyLarge",
  subheading: "subheading",
};

interface MediaCaptionProps extends HTMLAttributes<HTMLElement> {
  caption: string | undefined;
  /** Absent for the plain caption. */
  captionStyle: MediaNode["captionStyle"];
  [state: `data-${string}`]: unknown;
}

export function MediaCaption({
  caption,
  captionStyle,
  ...rest
}: MediaCaptionProps) {
  if (!caption) return null;
  return (
    <Typography
      tag="figcaption"
      type={CAPTION_TYPE[captionStyle ?? "caption"]}
      data-caption-style={captionStyle}
      {...rest}
    >
      {caption}
    </Typography>
  );
}
