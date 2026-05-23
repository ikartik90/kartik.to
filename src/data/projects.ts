import type { Post } from "@/domain/post";

export const projects: Post[] = [
  {
    id: "project-1",
    title: "kartik.to",
    slug: "kartik-to",
    category: "WORK",
    publishedAt: new Date("2025-11-01"),
    createdAt: new Date("2025-09-01"),
    updatedAt: new Date("2025-11-01"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "This site. A design system built on Panda CSS, a custom block editor for writing, and a stealth admin interface. Deployed on Vercel.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-2",
    title: "Palette",
    slug: "palette",
    category: "WORK",
    publishedAt: new Date("2025-08-15"),
    createdAt: new Date("2025-07-20"),
    updatedAt: new Date("2025-08-15"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A color token generator that outputs style-dictionary-compatible JSON from a single seed color. Pick one hex value, get a full 9-step palette with semantic light and dark roles.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-3",
    title: "ReadTime",
    slug: "readtime",
    category: "WORK",
    publishedAt: new Date("2025-06-10"),
    createdAt: new Date("2025-05-28"),
    updatedAt: new Date("2025-06-10"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A reading-time estimator that accounts for code blocks and image scanning time, not just word count. Code blocks read slower. Images cost 10 seconds each. The estimate reflects that.",
            },
          ],
        },
      ],
    },
  },
];
