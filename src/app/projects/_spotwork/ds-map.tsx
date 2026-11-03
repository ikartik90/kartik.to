"use client";

import { cloneElement, useState, type ComponentProps, type ReactElement } from "react";
import { css } from "../../../../styled-system/css";
import { LOCATION_HISTORY } from "./copy";
import { TRACES, siteOf } from "./dashboard";
import { LocationMap } from "./dashboard-overlays";
import { datum } from "./ds-code";
import { defineStory, type Story } from "./ds-story";
import { COMPANY_PLACE } from "./geo";
import type { Geofence, LatLng } from "./geofence";
import { GeofenceMap, RangeMap } from "./geofence-map";

// The job site's maps: its geofence, dragged into shape as a template's Address & Wage step does; a worker's location
// against it, and the history of it View Location plays, as View Location and the dashboard's sheet draw it; and a search's range round an address, as Find
// workers' minimap and its widened map draw it.

type DrawnProps = { children: ReactElement<ComponentProps<typeof GeofenceMap>> };

/** Its map, holding the geofence and entrance they're dragged to. */
function Drawn({ children }: DrawnProps) {
  const [fence, setFence] = useState<Geofence | null>(null);
  const [entrance, setEntrance] = useState<LatLng | null>(null);
  return cloneElement(children, { value: fence, onChange: setFence, entrance, onEntranceChange: setEntrance });
}

// The code view shows the map alone.
Drawn.unwrap = ({ children }: DrawnProps) => children;

const GEOFENCING_POLYGON = defineStory({
  id: "Geofencing Polygon",
  figma: "Maps/Geofencing Polygon",
  examples: [
    {
      layout: "edge",
      render: () =>
        datum(COMPANY_PLACE, "site", (site) => (
          <Drawn>
            <GeofenceMap place={site} value={null} size="location" />
          </Drawn>
        )),
    },
    {
      title: "Read-only",
      layout: "edge",
      render: () =>
        datum(COMPANY_PLACE, "site", (site) => <GeofenceMap place={site} value={null} size="location" editable={false} />),
    },
  ],
});

const LOCATION_TRACKING = defineStory({
  id: "Location Tracking",
  figma: "Maps/Location Tracking",
  examples: [
    { layout: "edge", render: () => <LocationMap away={7300} /> },
    { title: "Location disabled", layout: "edge", render: () => <LocationMap away={7300} untracked /> },
    {
      title: LOCATION_HISTORY.example,
      layout: "edge",
      render: () =>
        datum({ site: siteOf("Sweets from the Earth"), trace: TRACES.sikander }, "history", (history) => (
          <LocationMap site={history.site} trace={history.trace} />
        )),
    },
  ],
});

type RangedProps = { children: ReactElement<ComponentProps<typeof RangeMap>> };

// Mini, as tall as Find workers' two rows of fields.
const miniStyle = css({ width: "12.5rem", height: "10.5rem" });

/** Its map, holding where its pin is let go; mini, a press widens it, as Find workers' does. */
function Ranged({ children }: RangedProps) {
  const [place, setPlace] = useState(children.props.place);
  const [size, setSize] = useState(children.props.size);
  const map = cloneElement(children, {
    place,
    size,
    onExpand: () => setSize("wide"),
    onMove: (to) => setPlace({ ...place, ...to }),
  });
  return size === "mini" ? <div className={miniStyle}>{map}</div> : map;
}

// The code view shows the map alone.
Ranged.unwrap = ({ children }: RangedProps) => children;

const RANGE = defineStory({
  id: "Range",
  figma: "Maps/Range",
  examples: [
    {
      layout: "fill",
      render: () =>
        datum(COMPANY_PLACE, "site", (site) => (
          <Ranged>
            <RangeMap place={site} km={5} />
          </Ranged>
        )),
    },
    {
      title: "Mini",
      layout: "fill",
      render: () =>
        datum(COMPANY_PLACE, "site", (site) => (
          <Ranged>
            <RangeMap place={site} km={5} size="mini" />
          </Ranged>
        )),
    },
  ],
});

export const MAP_STORIES: Story[] = [GEOFENCING_POLYGON, LOCATION_TRACKING, RANGE];
