"use client";

import { useEffect, useState } from "react";
import { css, cx } from "../../../styled-system/css";
import { menuIcon, menuItem } from "../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { TextInput } from "@/components/ui/input/text-input";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import CheckIcon from "@/assets/icons/check-small.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import CrossCircleIcon from "@/assets/icons/cross-circle.svg";
import EditIcon from "@/assets/icons/edit.svg";
import EmailIcon from "@/assets/icons/email.svg";
import MoreIcon from "@/assets/icons/more.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import { Stage } from "./wireframe-stage";

const ring = "inset 0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.border.divider) 50%, transparent)";

// Down the middle of the stage, its card running off the graphic's foot, where the stage fades it out.
export const columnStyle = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // Between a toggle and the card under it.
  gap: "4xl",
  width: "min(86%, token(sizes.testimonialCardWide))",
  // A card with more to show, across the graphic but for its padding, no wider than the article's column.
  "&[data-wide]": { width: "min(token(sizes.articleContent), max(86%, calc(100% - 2 * token(spacing.3xl))))" },
});
export const cardStyle = css({
  position: "relative",
  flex: "1",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  width: "token(spacing.full)",
  borderRadius: "xl",
  backgroundColor: "bg.surface",
  // For its icon buttons, which take their colour from here.
  color: "text.body",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  boxShadow: `${ring}, 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)`,
  overflow: "hidden",
  // Both panes in one cell, so it holds the taller one's height and doesn't resize as they cross-fade.
  // `minmax(0, 1fr)`: an auto column would widen to a pane's content and push past the card.
  "&[data-panes]": { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", "& > *": { gridArea: "1 / 1" } },
});
const headingStyle = css({ textStyle: "quote", color: "text.title" });
const titleStyle = css({ textStyle: "bodySmall", color: "text.title" });
const activeStyle = css({ textStyle: "bodySmall", color: "field.text.active" });
const subStyle = css({ textStyle: "caption", color: "text.body" });
// Each line its own width, so a bar is as long as the words it stands for.
const whoStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  flex: "1",
  minWidth: 0,
  "& > span": { maxWidth: "token(spacing.full)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
});

const tableHeadStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
  paddingInline: "xl",
  paddingBlock: "lg",
});
const countStyle = css({
  paddingBlock: "xs",
  paddingInline: "md",
  borderRadius: "full",
  boxShadow: ring,
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
});
// As tall decided as undecided, so a row doesn't jump.
const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  minHeight: "calc(token(spacing.4xl) + 2 * token(spacing.md))",
  paddingInline: "xl",
  paddingBlock: "md",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
});
const decideStyle = css({ display: "flex", alignItems: "center", gap: "sm", flexShrink: 0 });
// Where an undoable status has its revert button, so every status lines up.
const noRevertStyle = css({ flexShrink: 0, width: "token(sizes.toolbarButton)" });
// The icon's circle is drawn 3px inside its box: the padding and gap leave it as far from the pill's top, bottom and
// start as from the label.
const statusStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "xxs",
  paddingBlock: "xs",
  paddingInlineStart: "xs",
  paddingInlineEnd: "md",
  borderRadius: "full",
  backgroundColor: "bg.highlight",
  textStyle: "caption",
  lineHeight: "token(spacing.xl)",
  color: "text.highlight",
  "& > svg": { flexShrink: 0, width: "token(spacing.xxl)", height: "token(spacing.xxl)" },
  // At body text's size, as in a table's rows; on a phone, where a table's columns have no room for it, the standard size.
  "&[data-size=large]": {
    md: {
      gap: "xs",
      paddingBlock: "sm",
      paddingInlineStart: "sm",
      paddingInlineEnd: "lg",
      textStyle: "bodySmall",
      lineHeight: "token(spacing.xxl)",
    },
  },
  "&[data-status=rejected]": { backgroundColor: "bg.notice", color: "text.body" },
  // Solid, so its whole edge shows where the tints' fade into the card: half a pixel in all round to look their size.
  "&[data-status=onboarded]": {
    backgroundColor: "text.highlight",
    color: "bg.canvas",
    paddingBlock: "calc(token(spacing.xs) - token(spacing.3xs))",
    paddingInlineStart: "calc(token(spacing.xs) - token(spacing.3xs))",
    paddingInlineEnd: "calc(token(spacing.md) - token(spacing.3xs))",
  },
});

export type Decision = "approved" | "rejected" | "onboarded" | undefined;

const STATUS = { approved: "Approved", rejected: "Rejected", onboarded: "Onboarded" };

// `placeholder` shows the prospect as bars the size of their name and company.
const PROSPECTS: { name: string; company: string; decision?: Decision; placeholder?: boolean }[] = [
  { name: "Jason Spooner", company: "Flower Faucets LLC" },
  { name: "Paityn Aminoff", company: "Gemini Mattresses", decision: "approved" },
  { name: "Jocelyn Levin", company: "Bayonet Coffee", decision: "rejected" },
  { name: "Nolan Gouse", company: "Zeus Infrastructure Services Ltd.", decision: "onboarded", placeholder: true },
];

/** Every prospect waits on Sales: approve or reject each, and revert either until they've onboarded. */
export function ActivationsWireframe() {
  const [decisions, setDecisions] = useState(() => PROSPECTS.map(({ decision }) => decision));
  const decide = (index: number, decision: Decision) =>
    setDecisions((current) => current.map((d, i) => (i === index ? decision : d)));
  const waiting = decisions.filter((d) => !d).length;

  return (
    <Stage>
      <div className={columnStyle}>
        <div className={cardStyle}>
          <div className={tableHeadStyle}>
            <span className={headingStyle}>Activations</span>
            <span className={countStyle}>{waiting ? `${waiting} to review` : "All reviewed"}</span>
          </div>
          {PROSPECTS.map(({ name, company, placeholder }, index) => {
            const decision = decisions[index];
            return (
              <div key={name} className={rowStyle}>
                {placeholder ? (
                  <Wireframe className={whoStyle} opacity={25}>
                    <Skeleton className={titleStyle}>{name}</Skeleton>
                    <Skeleton className={subStyle}>{company}</Skeleton>
                  </Wireframe>
                ) : (
                  <span className={whoStyle}>
                    <span className={titleStyle}>{name}</span>
                    <span className={subStyle}>{company}</span>
                  </span>
                )}
                <span className={decideStyle}>
                  {decision ? (
                    <>
                      <Status decision={decision} />
                      {decision === "onboarded" ? (
                        <span className={noRevertStyle} />
                      ) : (
                        <Button variant="icon" aria-label={`Revert ${name}`} onClick={() => decide(index, undefined)}>
                          <ResetIcon />
                          <Button.Tooltip>
                            <Tooltip.Text>Revert changes</Tooltip.Text>
                          </Button.Tooltip>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => decide(index, "rejected")}>
                        Reject
                      </Button>
                      <Button size="sm" emphasis="accent" onClick={() => decide(index, "approved")}>
                        Approve
                      </Button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

const anchorStyle = css({ position: "relative" });
// Under its row's menu button, their ends level, over the rows below.
const menuStyle = css({
  position: "absolute",
  zIndex: 1,
  top: "calc(100% - token(spacing.sm))",
  insetInlineEnd: "xl",
  display: "flex",
  flexDirection: "column",
  padding: "xs",
  borderRadius: "md",
  backgroundColor: "bg.surface",
  boxShadow: `${ring}, 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)`,
});
const menuRowStyle = css({
  whiteSpace: "nowrap",
  _hover: { backgroundColor: "field.bg.hover" },
  "&[data-active]": { color: "field.text.active" },
});
// Both labels in one cell, so the menu keeps the longer one's width as they swap.
const labelsStyle = css({
  display: "grid",
  textAlign: "start",
  "& > *": { gridArea: "1 / 1" },
  "& > :not([data-shown])": { visibility: "hidden" },
});

const PROSPECT = { name: "Paityn Aminoff", company: "Gemini Mattresses" };
// The rest of the dashboard, dimmed: enough rows to run off the graphic's foot.
const OTHERS: { name: string; company: string; decision: "approved" | "onboarded" }[] = [
  { name: "Craig Curtis", company: "Click Llc.", decision: "approved" },
  { name: "Nolan Gouse", company: "Zeus Infrastructure Services Ltd.", decision: "onboarded" },
  { name: "Brittany Pilz", company: "Lantern Securities LLC.", decision: "onboarded" },
  { name: "Anika Septimus", company: "10nic Chemical Labs Inc.", decision: "approved" },
  { name: "Gustavo Donin", company: "Bandaidos Pharmacy", decision: "onboarded" },
];

/** A decision's pill: its tick, or a cross when rejected, then its name. */
export function Status({ decision, size }: { decision: NonNullable<Decision>; size?: "large" }) {
  return (
    <span className={statusStyle} data-status={decision} data-size={size}>
      {decision === "rejected" ? <CrossCircleIcon aria-hidden /> : <CheckCircleIcon aria-hidden />}
      {STATUS[decision]}
    </span>
  );
}

/** An approved prospect's menu, open on copying their invitation link; it says so, then closes. */
export function InviteLinkWireframe() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Stage>
      <div className={columnStyle}>
        <div className={cardStyle}>
          <div className={tableHeadStyle}>
            <span className={headingStyle}>Activations</span>
          </div>
          <div className={cx(rowStyle, anchorStyle)}>
            <span className={whoStyle}>
              <span className={titleStyle}>{PROSPECT.name}</span>
              <span className={subStyle}>{PROSPECT.company}</span>
            </span>
            <span className={decideStyle}>
              <Status decision="approved" />
              <Button
                variant="icon"
                aria-label={`Actions for ${PROSPECT.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
                data-hover={open ? "" : undefined}
                onClick={() => {
                  setCopied(false);
                  setOpen(!open);
                }}
              >
                <MoreIcon />
              </Button>
            </span>
            {open && (
              <div className={menuStyle} role="menu" aria-label={`Actions for ${PROSPECT.name}`}>
                <Wireframe opacity={25}>
                  <span className={menuItem()}>
                    <EmailIcon className={menuIcon()} />
                    <Skeleton>Send invitation</Skeleton>
                  </span>
                </Wireframe>
                <button
                  type="button"
                  role="menuitem"
                  className={cx(menuItem(), menuRowStyle)}
                  data-active=""
                  onClick={() => setCopied(true)}
                >
                  {copied ? <CheckIcon className={menuIcon()} /> : <CopyIcon className={menuIcon()} />}
                  <span className={labelsStyle}>
                    <span data-shown={copied ? undefined : ""}>Copy invitation link</span>
                    <span data-shown={copied ? "" : undefined}>Link copied</span>
                  </span>
                </button>
                <Wireframe opacity={25}>
                  <span className={menuItem()}>
                    <EditIcon className={menuIcon()} />
                    <Skeleton>Edit prospect info</Skeleton>
                  </span>
                  <span className={menuItem()}>
                    <ResetIcon className={menuIcon()} />
                    <Skeleton>Revert changes</Skeleton>
                  </span>
                </Wireframe>
              </div>
            )}
          </div>
          {OTHERS.map(({ name, company, decision }) => (
            <div key={name} className={rowStyle}>
              <Wireframe className={whoStyle} opacity={25}>
                <Skeleton className={titleStyle}>{name}</Skeleton>
                <Skeleton className={subStyle}>{company}</Skeleton>
              </Wireframe>
              <Wireframe className={decideStyle} opacity={25}>
                <Status decision={decision} />
                {decision === "approved" ? (
                  <Button variant="icon" aria-label={`Actions for ${name}`}>
                    <MoreIcon />
                  </Button>
                ) : (
                  <span className={noRevertStyle} />
                )}
              </Wireframe>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// A pill of equal segments, each wide enough for "Collaborator".
export const toggleStyle = css({ flex: "none", width: "token(sizes.optionListWidth)", borderRadius: "full" });
export const paneStyle = css({
  display: "flex",
  flexDirection: "column",
  transitionProperty: "opacity, filter",
  transitionDuration: "300ms",
  transitionTimingFunction: "ease-out",
  // The leaving pane blurs, so only one pane is legible at a time.
  "&[data-presented=false]": { opacity: 0, filter: "blur(4px)" },
});
// Stretched, so the steps' rules line up when a name runs to two lines.
export const stepsStyle = css({
  display: "flex",
  alignItems: "stretch",
  gap: "lg",
  paddingInline: "xl",
  paddingBlockStart: "xl",
  listStyle: "none",
});
export const stepStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "xs",
  paddingBlockEnd: "md",
  borderBlockEndWidth: "token(spacing.xs)",
  borderBlockEndStyle: "solid",
  "&[data-state=done], &[data-state=current]": { borderBlockEndColor: "field.text.active" },
  "&[data-state=pending]": { borderBlockEndColor: "field.text.muted" },
});
export const stepEyebrowStyle = css({
  textStyle: "sidenote",
  color: "text.body",
  whiteSpace: "nowrap",
  "[data-state=current] &": { color: "field.text.active" },
  "[data-state=pending] &": { color: "field.text.muted" },
});
export const stepNameStyle = css({
  textStyle: "bodySmall",
  color: "field.text.default",
  "[data-state=current] &": { color: "field.text.active" },
  "[data-state=pending] &": { color: "field.text.muted" },
});
const formStyle = css({ display: "flex", flexDirection: "column", gap: "lg", padding: "xl" });
const invitedStyle = css({ display: "flex", flexDirection: "column", gap: "md", padding: "xl" });
const invitedHeadStyle = css({ display: "flex", flexDirection: "column", gap: "xs", marginBlockEnd: "sm" });
const teamStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  paddingBlock: "md",
  paddingInline: "lg",
  borderRadius: "md",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  "&[data-selected]": { borderColor: "field.border.active" },
});
const teamMarkStyle = css({
  flexShrink: 0,
  width: "token(spacing.3xl)",
  height: "token(spacing.3xl)",
  borderRadius: "sm",
  backgroundColor: "bg.notice",
});

const OWNER_STEPS = [
  { name: "Workspace", state: "done" },
  { name: "Team", state: "current" },
  { name: "Invite", state: "pending" },
] as const;

const WORKFLOWS = [
  { value: "owner", label: "Owner" },
  { value: "collaborator", label: "Collaborator" },
];

/** The owner setting up the company from scratch, or a collaborator joining the team they were invited to. */
export function WorkflowsWireframe() {
  const [workflow, setWorkflow] = useState("owner");
  const showing = (which: string) => workflow === which;
  return (
    <Stage toggle>
      <div className={columnStyle}>
        <SegmentedControl
          ariaLabel="Sign-up workflow"
          className={toggleStyle}
          options={WORKFLOWS}
          value={workflow}
          onValueChange={setWorkflow}
        />
        <div className={cardStyle} data-panes="">
          <div
            className={paneStyle}
            data-presented={showing("owner")}
            aria-hidden={!showing("owner")}
            inert={!showing("owner")}
          >
            <ol className={stepsStyle}>
              {OWNER_STEPS.map((step, index) => (
                <li key={step.name} className={stepStyle} data-state={step.state}>
                  <span className={stepEyebrowStyle}>Step {index + 1}</span>
                  <span className={stepNameStyle}>{step.name}</span>
                </li>
              ))}
            </ol>
            <Wireframe className={formStyle} opacity={25}>
              <TextInput label="Team name" defaultValue="Jason Spooner’s Team" />
              <TextInput label="Team address" defaultValue="250 First Gulf Boulevard, Brampton" />
            </Wireframe>
          </div>
          <div
            className={paneStyle}
            data-presented={showing("collaborator")}
            aria-hidden={!showing("collaborator")}
            inert={!showing("collaborator")}
          >
            <div className={invitedStyle}>
              <span className={invitedHeadStyle}>
                <span className={headingStyle}>You’ve been invited</span>
                <Wireframe opacity={25}>
                  <Skeleton className={subStyle}>Join your co-workers at Spotwork</Skeleton>
                </Wireframe>
              </span>
              <div className={teamStyle} data-selected="">
                <span className={teamMarkStyle} />
                <span className={whoStyle}>
                  <span className={activeStyle}>Jason Spooner’s Team</span>
                  <span className={subStyle}>Flower Faucets LLC</span>
                </span>
              </div>
              <Wireframe opacity={25}>
                <div className={teamStyle}>
                  <span className={teamMarkStyle} />
                  <span className={whoStyle}>
                    <Skeleton className={titleStyle}>Warehouse Logistics Team</Skeleton>
                    <Skeleton className={subStyle}>Flower Faucets LLC</Skeleton>
                  </span>
                </div>
              </Wireframe>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}
