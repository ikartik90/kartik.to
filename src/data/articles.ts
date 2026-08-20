import type { Post } from "@/domain/post";

export const articles: Post[] = [
  {
    id: "article-1",
    title: "CSS Anchor Positioning Kills the Tooltip Library",
    slug: "css-anchor-positioning",
    category: "ARTICLE",
    publishedAt: new Date("2025-11-20"),
    createdAt: new Date("2025-11-18"),
    updatedAt: new Date("2025-11-20"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Most tooltip libraries ship between 40 and 80 kB of JavaScript to solve a problem CSS has had an answer to since 2023. That problem: positioning one element relative to another element that isn't its parent.",
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "How it works" }],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", text: "Three CSS properties handle the whole thing. " },
            { type: "text", text: "anchor-name", marks: [{ type: "code" }] },
            {
              type: "text",
              text: " marks the reference element with a custom identifier. ",
            },
            { type: "text", text: "position-anchor", marks: [{ type: "code" }] },
            { type: "text", text: " connects the floating element to it. " },
            { type: "text", text: "anchor()", marks: [{ type: "code" }] },
            {
              type: "text",
              text: " reads the reference element's edges to compute offsets.",
            },
          ],
        },
        {
          type: "media",
          kind: "image",
          src: "https://placehold.co/800x400/EEF2F6/576675?text=anchor-name+and+position-anchor+diagram",
          alt: "Diagram showing a trigger element with anchor-name and a tooltip positioned with position-anchor and anchor()",
          caption:
            "anchor-name on the trigger, position-anchor and anchor() on the tooltip. Three properties, no JavaScript.",
        },
        {
          type: "code_block",
          language: "css",
          children: [
            {
              type: "text",
              text: `.trigger {
  anchor-name: --my-tooltip;
}

.tooltip {
  position: absolute;
  position-anchor: --my-tooltip;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;
}`,
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "What you were doing before" }],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", text: "Before this, you'd call " },
            { type: "text", text: "getBoundingClientRect()", marks: [{ type: "code" }] },
            {
              type: "text",
              text: " on the trigger, add scroll offsets, check viewport edges, and set ",
            },
            { type: "text", text: "top", marks: [{ type: "code" }] },
            { type: "text", text: " and " },
            { type: "text", text: "left", marks: [{ type: "code" }] },
            { type: "text", text: " in a " },
            { type: "text", text: "useEffect", marks: [{ type: "code" }] },
            {
              type: "text",
              text: ". Libraries like Floating UI automate that calculation. The calculation was always the wrong abstraction.",
            },
          ],
        },
        {
          type: "code_block",
          language: "javascript",
          children: [
            {
              type: "text",
              text: `const rect = trigger.getBoundingClientRect();

setPosition({
  top: rect.bottom + window.scrollY + 8,
  left: rect.left + window.scrollX + rect.width / 2,
});`,
            },
          ],
        },
        {
          type: "blockquote",
          children: [
            {
              type: "text",
              text: "Floating UI is well-built. You shouldn't need it for tooltips.",
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "Browser support" }],
        },
        {
          type: "media",
          kind: "image",
          src: "https://placehold.co/800x200/EEF2F6/576675?text=Chrome+125%2B+%7C+Firefox+130%2B+%7C+Safari+18.4%2B",
          alt: "Browser support: Chrome 125+, Firefox 130+, Safari 18.4+",
          caption: "Full support across the three major engines as of late 2024.",
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Anchor positioning has full support in Chrome 125+ and Firefox 130+. Safari ships it in Safari 18.4. For older Safari, the ",
            },
            {
              type: "text",
              text: "@oddbird/css-anchor-positioning",
              marks: [{ type: "code" }],
            },
            {
              type: "text",
              text: " polyfill covers the spec with a 12 kB footprint, cheaper than the library it replaces.",
            },
          ],
        },
        {
          type: "horizontal_rule",
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "When to use it" }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Use anchor positioning for tooltips, popovers, dropdowns, and any UI where one element needs to track another without JavaScript. Skip it when you need collision detection across nested scroll containers; Floating UI still handles that better.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "article-2",
    title: "Your Design Tokens Are in the Wrong Place",
    slug: "design-tokens-wrong-place",
    category: "ARTICLE",
    publishedAt: new Date("2025-10-08"),
    createdAt: new Date("2025-10-05"),
    updatedAt: new Date("2025-10-08"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Somewhere on your team, someone opened Figma, picked a color, and typed the hex value directly into a CSS file. You now have 37 hardcoded hex values across 12 files. Some are the same color with different names. None of them update when the design changes.",
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "The failure mode" }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Design tokens exist in Figma. They don't reach your code. Engineers redeclare them from screenshots, from memory, or from a six-month-old Zeplin export. The design system and the codebase drift apart.",
            },
          ],
        },
        {
          type: "media",
          kind: "image",
          src: "https://placehold.co/800x400/EEF2F6/576675?text=Figma+%E2%86%92+%3F%3F%3F+%E2%86%92+CSS",
          alt: "Diagram of a broken token pipeline: Figma variables with no connection to CSS",
          caption:
            "Tokens defined in Figma with no automated export step. Engineers fill the gap manually.",
        },
        {
          type: "blockquote",
          children: [
            {
              type: "text",
              text: "A token that lives only in Figma isn't a token. It's a note.",
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "The correct chain" }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Tokens need one source, one export step, and one import step. Define tokens as Figma variables. Export them via a plugin to a style-dictionary-compatible JSON file. style-dictionary transforms that JSON into CSS custom properties. Components consume those properties, not hardcoded values.",
            },
          ],
        },
        {
          type: "code_block",
          language: "json",
          children: [
            {
              type: "text",
              text: `{
  "color": {
    "text": {
      "default": { "value": "#414244", "type": "color" },
      "paragraph": { "value": "#576675", "type": "color" }
    }
  }
}`,
            },
          ],
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "What it looks like in your CSS" }],
        },
        {
          type: "code_block",
          language: "css",
          children: [
            {
              type: "text",
              text: `:root {
  --color-text-default: #414244;
  --color-text-paragraph: #576675;
}

[data-theme="dark"] {
  --color-text-default: #cfd9e2;
  --color-text-paragraph: #a9bfd6;
}`,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", text: "Components reference " },
            { type: "text", text: "var(--color-text-default)", marks: [{ type: "code" }] },
            {
              type: "text",
              text: ", never the hex. When the design changes, you update the JSON, run style-dictionary, and every component updates.",
            },
          ],
        },
        {
          type: "media",
          kind: "image",
          src: "https://placehold.co/800x300/EEF2F6/576675?text=Figma+Variables+%E2%86%92+JSON+%E2%86%92+CSS+Custom+Properties+%E2%86%92+Components",
          alt: "The complete pipeline: Figma Variables to JSON to CSS custom properties to components",
          caption: "Every step is automated. No manual copying of hex values.",
        },
        {
          type: "horizontal_rule",
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "The chain only works if every part is connected. If your CSS has one hardcoded hex value, the pipeline is broken. Audit them. Delete every hex value that has a token equivalent.",
            },
          ],
        },
      ],
    },
  },
];
