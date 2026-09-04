"use client";

import { Typography } from "@/components/ui/typography";
import { DemoFrame } from "@/components/demo-frame";
import { DemoComponent } from "@/components/demo-component";
import { getDemoComponent } from "@/components/demo/registry";
import { articleShowcase } from "../../styled-system/recipes";

interface ArticleComponentBlockProps {
  componentId: string;
  caption?: string;
}

export function ArticleComponentBlock({
  componentId,
  caption,
}: ArticleComponentBlockProps) {
  const demo = getDemoComponent(componentId);

  if (!demo) return null;

  return (
    <figure className={articleShowcase()}>
      <DemoFrame
        aspectRatio={demo.aspectRatio}
        logger={demo.logger}
        fill={demo.fill}
      >
        <DemoComponent entry={demo} aspect={demo.aspectRatio} />
      </DemoFrame>
      {caption ? (
        <Typography tag="figcaption" type="caption">
          {caption}
        </Typography>
      ) : null}
    </figure>
  );
}
