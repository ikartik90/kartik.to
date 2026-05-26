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
  {
    id: "project-4",
    title: "Density",
    slug: "density",
    category: "WORK",
    publishedAt: new Date("2025-04-20"),
    createdAt: new Date("2025-03-15"),
    updatedAt: new Date("2025-04-20"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A spacing scale explorer that shows how token relationships break down at extreme sizes. Drag a base unit and watch concentric radius compliance propagate across all derived values in real time.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-5",
    title: "Typeface",
    slug: "typeface",
    category: "WORK",
    publishedAt: new Date("2025-02-14"),
    createdAt: new Date("2025-01-10"),
    updatedAt: new Date("2025-02-14"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A variable font test rig for evaluating axis ranges under real editorial conditions. Paste any body copy and the tool renders it across the full weight and optical-size axes side by side.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-6",
    title: "Cascade",
    slug: "cascade",
    category: "WORK",
    publishedAt: new Date("2024-11-30"),
    createdAt: new Date("2024-10-05"),
    updatedAt: new Date("2024-11-30"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A CSS specificity visualizer that ranks every selector on a page and highlights conflicts. Paste a stylesheet and see exactly which rules win and why.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-7",
    title: "Grid",
    slug: "grid",
    category: "WORK",
    publishedAt: new Date("2024-09-18"),
    createdAt: new Date("2024-08-01"),
    updatedAt: new Date("2024-09-18"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "A layout audit tool that overlays any live webpage with a configurable column grid. Toggle breakpoints, adjust gutter widths, and check alignment without leaving the browser.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "project-8",
    title: "Motion",
    slug: "motion",
    category: "WORK",
    publishedAt: new Date("2024-07-04"),
    createdAt: new Date("2024-05-20"),
    updatedAt: new Date("2024-07-04"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "An easing curve editor with a live preview panel. Build custom cubic-bezier curves, compare them against system presets, and export as CSS custom properties or Framer Motion values.",
            },
          ],
        },
      ],
    },
  },
];
