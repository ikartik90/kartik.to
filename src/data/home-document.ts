import type { Document } from "@/domain/post";

// The homepage's default content, until a `PAGE` post with slug `home` overrides it.

export const DEFAULT_HOME_DOCUMENT: Document = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      align: "center",
      children: [
        {
          type: "text",
          text: "Hi, I'm Kartik. As a design systems and prototyping specialist of 12 years, I design to help startups achieve product-market-fit and hypergrowth. I invest care into the details that make software feel considered.",
        },
      ],
    },
    { type: "button_link", text: "About me", href: "/about" },
    { type: "social_links" },
    { type: "project_grid" },
  ],
};
