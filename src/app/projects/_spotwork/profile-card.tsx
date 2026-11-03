"use client";

import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
import type { RiskReading } from "./dashboard";
import type { Person, Tier } from "./data";
import { Avatar } from "./data-table";
import { NoShowRisk } from "./risk-chart";
import { partsOf, restOf } from "./slots";
import { Chip, LabelValuePair, Presence, Spotscore, Typography, enterRaw } from "./ui";

// A worker's name, in the link colour, over SW Curie's Profile Overview Card (10679:34884), less its View Location
// and View complete profile links; any other trigger can open a card of its own the same way.

const rootStyle = css({ position: "relative", display: "inline-flex", minWidth: 0, maxWidth: "100%" });

// A name too long for its cell ends in an ellipsis, as Figma's do.
const nameStyle = css({
  minWidth: 0,
  padding: "var(--sw-padding-none)",
  border: "none",
  background: "none",
  color: "var(--sw-glyph-link-primary-default)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  cursor: "pointer",
  _hover: { color: "var(--sw-glyph-link-primary-hover)" },
  _active: { color: "var(--sw-glyph-link-primary-active)" },
});

const cardStyle = css(enterRaw, {
  position: "absolute",
  insetBlockStart: "calc(100% + 0.25rem)",
  insetInlineStart: 0,
  zIndex: 4,
  display: "flex",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "var(--sw-overlay-shadow)",
  whiteSpace: "normal",
  cursor: "default",
  "&[data-side=above]": { insetBlockStart: "auto", insetBlockEnd: "calc(100% + 0.25rem)", "--entrance-from": "4px" },
});

const profileStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)", width: "18rem", paddingBlock: "var(--sw-padding-xl)" });

const headStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-md)",
  paddingInlineStart: "var(--sw-padding-md)",
  paddingInlineEnd: "var(--sw-padding-xl)",
});

const faceStyle = css({ flexShrink: 0, padding: "var(--sw-padding-xxs)" });

const summaryStyle = css({
  display: "flex",
  flex: "1 1 0",
  flexDirection: "column",
  justifyContent: "center",
  gap: "var(--sw-gap-md)",
  minWidth: 0,
  alignSelf: "stretch",
  color: "var(--sw-glyph-default)",
  "& > [data-typography]": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const tagsStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xs)" });

const detailsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-md)",
  paddingBlockStart: "var(--sw-padding-xl)",
  paddingInline: "var(--sw-padding-xl)",
  borderBlockStart: "1px solid var(--sw-border-subdued)",
  color: "var(--sw-glyph-default)",
});

const riskStyle = css({
  justifyContent: "space-between",
  padding: "var(--sw-padding-xl)",
  borderInlineStart: "1px solid var(--sw-border-subdued)",
});

/** Molecules/Overlay/Profile Overview Card: its `Header` over its `Details`, then any action. */
function ProfileCardRoot({ children }: { children: ReactNode }) {
  return <div className={profileStyle}>{children}</div>;
}
ProfileCardRoot.displayName = "ProfileCard";

/** The worker's `Avatar` beside their name, a `Typography`, over the rest of its children, their pills. */
function ProfileHeader({ children }: { children: ReactNode }) {
  const [face] = partsOf(children, Avatar);
  const tags = restOf(children, Avatar, Typography);
  return (
    <div className={headStyle}>
      {face && <div className={faceStyle}>{face}</div>}
      <div className={summaryStyle}>
        {partsOf(children, Typography)}
        {tags.length > 0 && <div className={tagsStyle}>{tags}</div>}
      </div>
    </div>
  );
}
ProfileHeader.displayName = "ProfileCard.Header";

/** The worker's Label-value Pairs, ruled off under the header. */
function ProfileDetails({ children }: { children: ReactNode }) {
  return <div className={detailsStyle}>{children}</div>;
}
ProfileDetails.displayName = "ProfileCard.Details";

export const ProfileCard = Object.assign(ProfileCardRoot, { Header: ProfileHeader, Details: ProfileDetails });

/** `worker`'s card as the app shows it, less its links. */
function WorkerCard({ worker }: { worker: Person }) {
  const { profile } = worker;
  return (
    <ProfileCard>
      <ProfileCard.Header>
        <Avatar src={worker.face} />
        <Typography variant="heading">{worker.name}</Typography>
        <Spotscore tier={profile.tier.toLowerCase() as Lowercase<Tier>}>
          {profile.score}
        </Spotscore>
        <Chip size="small" state="affirmative">{profile.pool}</Chip>
      </ProfileCard.Header>
      <ProfileCard.Details>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">
            Phone Number
          </Typography>
          <Typography variant="body">{profile.phone}</Typography>
        </LabelValuePair>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">
            Location
          </Typography>
          <Typography variant="body">{profile.location}</Typography>
        </LabelValuePair>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">
            Total Shifts Completed
          </Typography>
          <Typography variant="body">{`${profile.shifts} (${profile.hours.toLocaleString("en-US")} Hours)`}</Typography>
        </LabelValuePair>
      </ProfileCard.Details>
    </ProfileCard>
  );
}

/** The worker's name opens their card; with `risk`, the card ends with the worker's no-show risk. */
export function WorkerName({ worker, risk }: { worker: Person; risk?: RiskReading[] }) {
  return (
    <ProfilePopover
      trigger={
        <Typography tag="button" variant="body" type="button" className={nameStyle}>
          {worker.name}
        </Typography>
      }
    >
      <WorkerCard worker={worker} />
      {risk && <NoShowRisk className={riskStyle} name={worker.name} readings={risk} />}
    </ProfilePopover>
  );
}

/**
 * `trigger`, a button, opens `children`, a card, after a hover's pause, or on focus; the card stays while the pointer
 * is over either, or the focus is in either.
 */
export function ProfilePopover({
  trigger,
  className,
  children,
}: {
  trigger: ReactElement<{ "aria-expanded"?: boolean }>;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  const after = useCallback((next: boolean, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Below the name, or above it when the app's view has no room below.
  useLayoutEffect(() => {
    const node = card.current;
    const view = root.current?.closest("[data-check-ins-app]")?.getBoundingClientRect();
    if (!open || !node || !view || !root.current) return;
    const name = root.current.getBoundingClientRect();
    const height = node.getBoundingClientRect().height;
    // The card's 4px, at the scale the overlay draws the app.
    const gap = (4 * name.width) / root.current.offsetWidth;
    node.dataset.side = name.bottom + gap + height > view.bottom && name.top - gap - height > view.top ? "above" : "below";
  }, [open]);

  // The overlay's dialog takes Escape first and passes it on as this event (prototype-overlay).
  useEffect(() => {
    const node = card.current;
    if (!open || !node) return;
    const close = () => setOpen(false);
    node.addEventListener("escape-layer", close);
    return () => node.removeEventListener("escape-layer", close);
  }, [open]);

  return (
    <span
      ref={root}
      className={cx(rootStyle, className)}
      onPointerEnter={() => after(true, open ? 0 : 300)}
      onPointerLeave={() => after(false, 150)}
      onFocus={() => after(true, 0)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && after(false, 0)}
    >
      {cloneElement(trigger, { "aria-expanded": open })}
      <Presence>
        {open && (
          <div ref={card} className={cardStyle} data-escape-layer="">
            {children}
          </div>
        )}
      </Presence>
    </span>
  );
}
