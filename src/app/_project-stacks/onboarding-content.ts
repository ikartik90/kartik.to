import ClockIcon from "@/assets/icons/clock.svg";
import EmailIcon from "@/assets/icons/email.svg";
import PauseIcon from "@/assets/icons/pause.svg";
import type { MediaNode } from "@/domain/nodes";
import { clipGround, walkthroughClip } from "./clips-carousel";
import type { Feature } from "./feature-grid";
import type { Metric } from "./metric-card";

// The company onboarding sheet's words and clips. `*`s mark what's highlighted.

const R2 = "https://pub-3f00bf1204d54dbe88e07be7288fe49c.r2.dev";
const clip = (file: string, alt: string, ground: ReturnType<typeof clipGround>) =>
  walkthroughClip(`${R2}/media/${file}.mp4`, `${R2}/posters/${file}.jpg`, alt, ground);

const CLIPS: MediaNode[] = [
  clip(
    "4e2eb752-5cdd-47e4-a533-19c946cf4695-onboarding-1-activations",
    "A video of sales adding a prospect on the activations dashboard, approving them and sending their invitation.",
    clipGround(["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"], {
      positions: 57,
      waveX: 0.49,
      waveXShift: 0.25,
      waveYShift: 0.46,
      mixing: 0.61,
      grainMixer: 0.4,
    }),
  ),
  clip(
    "e43d79cd-9d9d-4c9a-a0ea-87555a40521f-onboarding-2-onboarding",
    "A video of the owner setting a password and creating their company and first team, then an invited teammate joining one of their teams.",
    clipGround(["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"], { positions: 29, grainMixer: 0.65, offsetY: -0.08 }),
  ),
  clip(
    "05298c50-2064-4093-9c7a-12625c46497a-onboarding-3-team-members",
    "A video of a team admin changing a member's role, inviting two people and resending an invitation.",
    clipGround(["#DAEBFFFF", "#1954DCFF", "#C3DEEBFF"], {
      positions: 78,
      mixing: 0.67,
      grainMixer: 0.75,
      rotation: 90,
      offsetX: 0.47,
    }),
  ),
];

const reasons: Feature[] = [
  {
    Icon: EmailIcon,
    title: "Blocked verification emails",
    body: "Corporate firewalls frequently blocked self-verification emails required to complete signup.",
  },
  {
    Icon: ClockIcon,
    title: "Urgent verification support",
    body: "The sales team often raised urgent support requests mid-call, and anxiously waited for the verification to go through.",
  },
  {
    Icon: PauseIcon,
    title: "Perception of friction",
    body: "This stalled experience created a perception of friction among new customers, causing them to drop off after a few shifts.",
  },
];

const outcome: Metric = {
  value: "78%",
  label: "fifth‑shift retention",
  trend: "up",
  change: "16 points",
  detail:
    "A smoother onboarding process *improved perceived ease‑of‑use and lifted fifth‑shift retention 16 points*, from 62% to 78%.",
};

export const ONBOARDING = {
  clips: CLIPS,
  stakes: {
    eyebrow: "Business fit",
    heading: "We were losing customers at onboarding",
    body: "Sales-qualified leads, including enterprise clients, frequently abandoned signup citing purely technical reasons.",
    reasons,
  },
  // Quadrants run 1 top right, then round anticlockwise.
  gap: {
    eyebrow: "UX gap",
    heading: "Email verification blocked paying customers but allowed threat actors to pass through",
    up: "Allowed",
    down: "Blocked",
    left: "Threat actor",
    right: "Paying customer",
    items: [
      {
        text: "Firewall blocked sales-qualified leads",
        caption: "Company network firewalls quarantined verification emails, locking out customers sales had already vetted.",
        quadrant: 4,
      },
      {
        text: "Email verification allowed threat actors",
        caption: "Self-verification was a weak gate, as threat actors only needed a valid email inbox to gain access to the platform.",
        quadrant: 2,
      },
    ] as { text: string; caption: string; quadrant: 2 | 4 }[],
    label:
      "A two-by-two grid of allowed above blocked and threat actors left of paying customers, with the two quadrants we got hatched: sales-qualified leads blocked by their company firewall, marked with a firewall, and threat actors allowed through email verification alone, marked with a skull.",
  },
  northStar: "Get the right customer from signup to first shift with zero friction.",
  // A heading over paragraphs each, split on blank lines.
  cards: {
    activations: {
      title: "Put Sales in charge of customer activations",
      text: "With email verification gone, unverified customers could still post shifts, and a *default made us liable to pay the worker*.\n\nSales brought in over *95% of our recurring revenue through outbound deals*. So they were best placed to decide who gets in.",
    },
    workflows: {
      title: "Give owners and collaborators their own workflow",
      text: "Owners and collaborators shared a common sign-up workflow, where a mistyped company name *created a duplicate account*.\n\n*Generating magic links for sign-up allowed each to have their own workflow*: for owners to set up their company, and for collaborators to join the team they had been invited to.",
    },
    inviteLinks: {
      title: "Let our team share invitation links over chat",
      text: "Corporate firewalls usually *blocked our invitation emails* from reaching the customer, stalling their onboarding.\n\nMagic links gave every approved customer a sign-up link of their own. So whoever was onboarding them could *copy that link and share it over chat*.",
    },
  },
  outcome,
  takeaway: {
    eyebrow: "Takeaway",
    heading: "Automation starts with simplicity",
    paragraphs: [
      "With a streamlined onboarding workflow in place, an agent could now review most activations on its own, matching prospect data with HubSpot, and checking the company's domain and public information to confirm business fit.",
      "Even the best AI reaches the right outcomes only when the steps in front of it are few and clearly signposted.",
    ],
  },
};
