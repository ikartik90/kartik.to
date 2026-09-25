import { css } from "../../styled-system/css";
import { linkCard } from "../../styled-system/recipes";
import { Typography } from "./ui/typography";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { ScrimBlur } from "@/components/scrim-blur";
import { gridItemVars } from "@/utils/grid-item-vars";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { LinkCardTone } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";

// CSS, not a JS theme read: the card renders on the server, where the theme is unknown.
const lightOnlyStyle = css({ _dark: { display: "none" } });
const darkOnlyStyle = css({ display: "none", _dark: { display: "block" } });

export interface LinkCardProps {
  /** Absent renders a plain box, not an anchor with an empty href. */
  href?: string;
  title?: string;
  aspect: DemoFrameAspectRatio;
  /** A ceiling: CSS cuts it to the columns the grid has. */
  span?: number;
  /** Pre-formatted meta line above the title. */
  meta?: string;
  /** Accessible name for a card with no title; ignored when there is one. */
  label?: string;
  cover?: MediaNode | null;
  /** The picture shown instead in the dark theme. */
  coverDark?: MediaNode | null;
  /** Defaults to whether there is a picture. */
  scrim?: boolean;
  /** Pins the band's theme; absent follows the reader's. */
  tone?: LinkCardTone;
  newTab?: boolean;
  /** False also takes the link out of the tab order. */
  interactive?: boolean;
}

export function LinkCard({
  href,
  title,
  aspect,
  span,
  meta,
  label,
  cover,
  coverDark,
  scrim,
  tone,
  newTab = false,
  interactive = true,
}: LinkCardProps) {
  const styles = linkCard({ aspect, tone });

  const covered = Boolean(cover || coverDark);
  const captioned = Boolean(title || meta);
  const grounded = scrim ?? covered;

  return (
    // The aspect feeds both the recipe and the masonry vars, derived here so they never disagree.
    <a
      href={href}
      className={styles.root}
      style={gridItemVars(aspect, span)}
      aria-label={!title && label ? label : undefined}
      tabIndex={interactive ? undefined : -1}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      data-covered={covered ? "" : undefined}
    >
      {/* Decorative: the link is named by its words or `label`. */}
      <div className={styles.cover} role="presentation" aria-hidden="true">
        <CardCover
          media={cover}
          styles={styles}
          className={coverDark ? lightOnlyStyle : undefined}
        />
        {coverDark && (
          <CardCover
            media={coverDark}
            styles={styles}
            className={cover ? darkOnlyStyle : undefined}
          />
        )}
      </div>
      {/* Frosting before wash: a backdrop filter only blurs what has painted beneath it. */}
      {(captioned || grounded) && (
        <div className={styles.scrim}>
          {grounded && (
            <>
              <ScrimBlur towards="top" />
              <div className={styles.wash} />
            </>
          )}
          {captioned && (
            <div className={styles.caption}>
              {meta && (
                <Typography tag="p" type="caption">
                  {meta}
                </Typography>
              )}
              {title && (
                <Typography tag="h2" type="bodyLarge">
                  {title}
                </Typography>
              )}
            </div>
          )}
        </div>
      )}
    </a>
  );
}

function CardCover({
  media,
  styles,
  className,
}: {
  media: MediaNode | null | undefined;
  styles: ReturnType<typeof linkCard>;
  className?: string;
}) {
  if (!media) return null;
  return (
    <>
      {media.backgroundEffect && (
        <BackgroundEffectLayer
          effect={media.backgroundEffect}
          className={`${styles.backgroundEffect}${className ? ` ${className}` : ""}`}
        />
      )}
      <div
        className={`${styles.mediaFrame}${className ? ` ${className}` : ""}`}
      >
        <Media
          src={media.src}
          alt=""
          kind={media.kind}
          className={styles.media}
          layout={media}
          poster={media.kind === "video" ? media.poster : undefined}
          width={media.width}
          height={media.height}
        />
      </div>
    </>
  );
}
