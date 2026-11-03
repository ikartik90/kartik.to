// The homepage hero's words.

export const HOME_HERO = {
  heading: {
    full: ["12 years of design craft", "and engineering know‑how", "for early‑stage product teams"],
    // For phones too narrow for the full lines; `&` for those 375px wide and narrower.
    short: ["12 years of design craft and", "engineering know‑how", "for early‑stage teams"],
    shortest: ["12 years of design craft &", "engineering know‑how", "for early‑stage teams"],
  },
  lede: [
    "I'm Kartik Iyer, a Toronto-based designer and builder.",
    "I thrive in environments of high agency, urgency, and uncertainty. I invest care into the details that make software feel considered.",
  ],
  status: { available: "Available for work", location: "Toronto, ON" },
} as const;
