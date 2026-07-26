"use client";

import type { ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Tooltip } from "@/components/ui/tooltip";
import AddIcon from "@/assets/icons/add.svg";
import SaveIcon from "@/assets/icons/save.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import EditIcon from "@/assets/icons/edit.svg";
import ReturnIcon from "@/assets/icons/return.svg";
import OctocatIcon from "@/assets/icons/octocat.svg";

// ---------------------------------------------------------------------------
// Local-only gallery of every Button / Link style. `Button` acts, `Link`
// navigates, both share the one `action` recipe — so a specimen row of each
// makes the "same skin, different semantics" contract visible in one place.
// ---------------------------------------------------------------------------

const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  color: "text.body",
  display: "flex",
  flexDirection: "column",
  gap: "4xl",
  padding: "5xl",
});

const headerStyle = css({ display: "flex", flexDirection: "column", gap: "sm" });
const titleStyle = css({ textStyle: "title" });
const introStyle = css({
  textStyle: "bodySmall",
  color: "text.default/60",
  maxWidth: "60ch",
});

const sectionStyle = css({ display: "flex", flexDirection: "column", gap: "lg" });
const sectionTitleStyle = css({ textStyle: "subheading", color: "text.default" });
const rowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "xl",
  alignItems: "flex-end",
});

const specimenStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "sm",
});
const specimenLabelStyle = css({ textStyle: "caption", color: "text.default/50" });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={sectionStyle}>
      <h2 className={sectionTitleStyle}>{title}</h2>
      <div className={rowStyle}>{children}</div>
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={specimenStyle}>
      {children}
      <span className={specimenLabelStyle}>{label}</span>
    </div>
  );
}

/** Local-only preview route for the Button / Link primitives. */
export default function ButtonPreviewPage() {
  return (
    <main className={pageStyle}>
      <header className={headerStyle}>
        <h1 className={titleStyle}>Buttons &amp; Links</h1>
        <p className={introStyle}>
          <code>Button</code> acts, <code>Link</code> navigates — both share the
          one <code>action</code> recipe. Text buttons hug their content with an
          80px floor and a fixed 40px height; icon buttons match the toolbar
          chip. Hover an icon button for its cursor tooltip, and tab through to
          see the keyboard focus rings.
        </p>
      </header>

      <Section title="Text buttons">
        <Specimen label="default">
          <Button>Save changes</Button>
        </Specimen>
        <Specimen label="leading icon + Button.Text">
          <Button>
            <SaveIcon />
            <Button.Text>Save changes</Button.Text>
          </Button>
        </Specimen>
        <Specimen label="short — floored to 80px">
          <Button>OK</Button>
        </Specimen>
        <Specimen label="disabled">
          <Button disabled>Delete draft</Button>
        </Specimen>
      </Section>

      <Section title="Icon buttons — toolbar style (28px)">
        <Specimen label="icon only">
          <Button variant="icon" aria-label="Add block">
            <AddIcon />
          </Button>
        </Specimen>
        <Specimen label="Button.Tooltip on hover">
          <Button variant="icon" aria-label="Edit">
            <EditIcon />
            <Button.Tooltip>
              <Tooltip.Text>Edit</Tooltip.Text>
              <EditIcon />
            </Button.Tooltip>
          </Button>
        </Specimen>
        <Specimen label="disabled">
          <Button variant="icon" aria-label="Delete" disabled>
            <TrashIcon />
          </Button>
        </Specimen>
      </Section>

      <Section title="Inline link variant">
        <Specimen label='variant="link" — a button that reads as an anchor'>
          <span className={css({ textStyle: "bodySmall" })}>
            Drag a file here, or{" "}
            <Button variant="link">browse to upload</Button>.
          </span>
        </Specimen>
      </Section>

      <Section title="Links — navigation (render an <a>)">
        <Specimen label="internal, text">
          <Link href="/">Back to home</Link>
        </Specimen>
        <Specimen label="internal, icon + label (the ← Home affordance)">
          <Link href="/" variant="icon" aria-label="Home">
            <ReturnIcon />
            <Link.Text>Home</Link.Text>
          </Link>
        </Specimen>
        <Specimen label="external, icon + tooltip (opens in a new tab)">
          <Link
            href="https://github.com/ikartik90"
            target="_blank"
            variant="icon"
            aria-label="GitHub"
          >
            <OctocatIcon />
            <Link.Tooltip>
              <Tooltip.Text>GitHub</Tooltip.Text>
              <OctocatIcon />
            </Link.Tooltip>
          </Link>
        </Specimen>
      </Section>
    </main>
  );
}
