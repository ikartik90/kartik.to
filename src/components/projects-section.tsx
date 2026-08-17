import { css } from "../../styled-system/css";
import { ProjectCard } from "./project-card";
import { listingColumnsFor } from "@/utils/listing-columns";
import type { Post } from "@/domain/post";

// Container queries, not viewport ones: the thresholds are the grid's own
// floors, so they're measured against the space `main` actually leaves rather
// than against the window minus a page inset restated here. Literal px because
// an at-rule condition can't read a token — kept in step with `sizes.listingColumn`
// (320) and its 2-up/3-up multiples by hand.
const TWO_UP = "@container projectsGrid (min-width: 640px)";
const THREE_UP = "@container projectsGrid (min-width: 960px)";

const containerStyle = css({
  containerType: "inline-size",
  containerName: "projectsGrid",
});

// Multi-column, not `display: grid`. Masonry is what a column box does by
// nature — each card is laid where the previous one ended, and `column-fill`'s
// default balancing evens the columns out — where a grid would hold every card
// in a row to the tallest one in it and leave the short ones trailing a gap.
// (`grid-template-rows: masonry` is still not something to ship on.)
const gridStyle = css({
  // Full width, not the tier's own floor: 320 and 640 are the LEAST a one- and
  // two-column listing may be, not what they are held to, so a grid with more
  // room than its tier needs spends it on wider columns instead of leaving a
  // gutter down either side. Only three-up has a ceiling, and it is the 960
  // showcase column the rest of the page reads at.
  width: "token(spacing.full)",
  marginInline: "auto",
  columnGap: "xxl",
  // A column box has no row-gap — the space between two stacked cards has to
  // come from the cards themselves, which leaves one gap's worth hanging off
  // the foot of every column. This takes it back.
  marginBlockEnd: "calc(-1 * token(spacing.xxl))",
  "& > *": {
    breakInside: "avoid",
    marginBlockEnd: "xxl",
  },
  // The two tiers OVERLAP — past 960 the 640 query still matches — so the wider
  // one has to be the later of the two, which is why they are written narrow to
  // wide. `data-columns` is the ceiling `listingColumnsFor` set from the size of
  // the set; a tier only ever hands out the smaller of that and what it can fit,
  // and a 1 is left to `column-count`'s own `auto`.
  [TWO_UP]: {
    "&[data-columns='2'], &[data-columns='3']": { columnCount: 2 },
  },
  [THREE_UP]: {
    width: "min(100%, token(sizes.listingGrid3Up))",
    "&[data-columns='3']": { columnCount: 3 },
  },
});

interface ProjectsSectionProps {
  projects: Post[];
}

export function ProjectsSection({ projects }: ProjectsSectionProps) {
  return (
    <section aria-label="Projects" className={containerStyle}>
      <div
        className={gridStyle}
        data-columns={listingColumnsFor(projects.length)}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
