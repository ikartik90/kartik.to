"use client";

import { Surface, Variants, defineStory } from "./ds-story";
import { Button, Link, Tooltip } from "./ui";
import EditIcon from "./assets/edit.svg";
import TrashIcon from "./assets/trash.svg";

// SW Curie's CTA page (1633:3188): its buttons, Molecules/Button/Icon Button among them at size icon, and its link,
// each one the app shows. Hover and press are their own.

const BUTTON = defineStory({
  id: "Button",
  figma: "Molecules/Button",
  examples: [
    { render: () => <Button>Confirm hours</Button> },
    {
      title: "Size",
      render: () => (
        <Variants>
          <Button size="large">Confirm hours</Button>
          <Button size="small">Add note</Button>
          <Button size="icon" aria-label="Edit timecard">
            <EditIcon aria-hidden />
            <Tooltip>Edit timecard</Tooltip>
          </Button>
        </Variants>
      ),
    },
    {
      title: "Emphasis",
      render: () => (
        <Variants>
          <Button emphasis="primary">Confirm hours</Button>
          <Button emphasis="secondary">Save as draft</Button>
          <Button emphasis="tertiary">Cancel</Button>
        </Variants>
      ),
    },
    {
      // Figma draws the warning button on the surface it's made for.
      title: "Tone",
      render: () => (
        <Variants>
          <Button>Confirm hours</Button>
          <Button tone="destructive">Mark absent</Button>
          <Surface ground="warning">
            <Button emphasis="secondary" tone="warning">
              Approve hours
            </Button>
          </Surface>
          <Button size="icon" aria-label="Edit timecard">
            <EditIcon aria-hidden />
            <Tooltip>Edit timecard</Tooltip>
          </Button>
          <Button size="icon" tone="destructive" aria-label="Delete timecard">
            <TrashIcon aria-hidden />
            <Tooltip>Delete timecard</Tooltip>
          </Button>
        </Variants>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Button>Confirm hours</Button>
          <Button disabled>Confirm hours</Button>
          <Button emphasis="secondary" disabled>
            Save as draft
          </Button>
          <Button emphasis="tertiary" disabled>
            Cancel
          </Button>
          <Button size="icon" aria-label="Edit timecard">
            <EditIcon aria-hidden />
            <Tooltip>Edit timecard</Tooltip>
          </Button>
          <Button size="icon" aria-label="Edit timecard" disabled>
            <EditIcon aria-hidden />
          </Button>
        </Variants>
      ),
    },
  ],
});

// Molecules/Button/Icon Button's Float: under its button, from the button's right edge or its left.
export const TOOLTIP = defineStory({
  id: "Tooltip",
  figma: "Molecules/Button/Icon Button/Float",
  examples: [
    {
      render: () => (
        <Button size="icon" aria-label="Edit timecard" data-hover="">
          <EditIcon aria-hidden />
          <Tooltip>Edit timecard</Tooltip>
        </Button>
      ),
    },
    {
      title: "Align",
      render: () => (
        <Variants>
          <Button size="icon" aria-label="Edit timecard" data-hover="">
            <EditIcon aria-hidden />
            <Tooltip start>Edit timecard</Tooltip>
          </Button>
          <Button size="icon" aria-label="Edit timecard" data-hover="">
            <EditIcon aria-hidden />
            <Tooltip>Edit timecard</Tooltip>
          </Button>
        </Variants>
      ),
    },
  ],
});

const LINK = defineStory({
  id: "Link",
  figma: "Molecules/Link",
  examples: [
    { render: () => <Link>Contact us.</Link> },
    {
      title: "State",
      render: () => (
        <Variants>
          <Link>Contact us.</Link>
          <Link disabled>Contact us.</Link>
        </Variants>
      ),
    },
  ],
});

export const CTA_STORIES = [BUTTON, LINK];
