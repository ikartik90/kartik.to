"use client";

import { useState, type ReactNode } from "react";
import { defineStory, type Story } from "./ds-story";
import { Div } from "./ds-tailwind";
import { Header, Notifications, PopoverMenu, type NoticeType } from "./navigation";
import { Sidebar } from "./sidebar";
import { Button, Pill, SegmentedControl, Typography } from "./ui";
import { APP_TEAM, APP_TEAMS } from "./activations";
import { InlineTableRecord } from "./cards";
import { LOGOS } from "./data";
import { Avatar } from "./data-table";
import { datum } from "./ds-code";
import placeholderFace from "./assets/faces/placeholder-male.png";
import MenuNotesIcon from "./assets/menu-notes.svg";
import MenuPinIcon from "./assets/menu-pin.svg";
import CheckInIcon from "./assets/icons/medium/check-in.svg";
import ShiftsIcon from "./assets/icons/medium/shifts.svg";
import ClockIcon from "./assets/icons/medium/clock.svg";
import CancellationIcon from "./assets/icons/medium/cancellation.svg";
import VerificationIcon from "./assets/icons/medium/verification.svg";
import AdvancedSearchIcon from "./assets/icons/medium/advanced-search.svg";
import KebabIcon from "./assets/icons/medium/kebab-menu.svg";
import NotificationsIcon from "./assets/icons/medium/bell.svg";
import SettingsIcon from "./assets/icons/medium/settings.svg";
import ConfirmedIcon from "./assets/confirmed.svg";

// SW Curie's Navigation page (913:2017), each component at its Figma width, and its Global Navigation frames (5040:6268
// open, 5271:5309 closed) as one header whose Menu opens and closes the sidebar. Atoms/Navigation/Nav Item is a
// `Sidebar.Item`, and Notification Content the `Notifications.Item`.

/** Figma's sidebar items, then the Admin group's, Timesheets current; shut to a rail with `rail`, the account at its foot. */
// The company whose sidebar it is, as the store holds it.
const COMPANY = { logo: LOGOS["Canada Cartage"] };

const logo = (size?: "medium") =>
  datum(COMPANY, "company", (company) => <Avatar type="company" size={size} src={company.logo} />);

const sidebar = (rail?: { open: false; rail: true }, notifications?: { open: boolean; onToggle: () => void }) => (
  <Sidebar label="Main" defaultValue="Timesheets" {...rail}>
    {rail && (
      <Sidebar.Switcher label="Switch team">
        {logo()}
        <Typography variant="body">{APP_TEAM.team}</Typography>
        {APP_TEAMS.map(({ name, address }) => (
          <InlineTableRecord key={name} defaultSelected={name === APP_TEAM.team}>
            <InlineTableRecord.Cell fill>
              {logo("medium")}
              <Typography variant="body">{name}</Typography>
              <InlineTableRecord.Selected>
                <Pill state="success">
                  <ConfirmedIcon aria-hidden />
                  Selected
                </Pill>
              </InlineTableRecord.Selected>
              <Typography tag="p" variant="metadata" color="subdued">{address.label}</Typography>
            </InlineTableRecord.Cell>
          </InlineTableRecord>
        ))}
      </Sidebar.Switcher>
    )}
    <Sidebar.Item value="Check-ins">
      <CheckInIcon aria-hidden />
      <Typography variant="body">Check-ins</Typography>
    </Sidebar.Item>
    <Sidebar.Item value="Shifts">
      <ShiftsIcon aria-hidden />
      <Typography variant="body">Shifts</Typography>
    </Sidebar.Item>
    <Sidebar.Item value="Timesheets">
      <ClockIcon aria-hidden />
      <Typography variant="body">Timesheets</Typography>
    </Sidebar.Item>
    <Sidebar.Group>
      <Sidebar.GroupLabel>
        <Typography tag="div" variant="metadataStrong" color="subdued">
          Admin
        </Typography>
      </Sidebar.GroupLabel>
      <Sidebar.Item value="Cancellations">
        <CancellationIcon aria-hidden />
        <Typography variant="body">Cancellations</Typography>
      </Sidebar.Item>
      <Sidebar.Item value="Verifications">
        <VerificationIcon aria-hidden />
        <Typography variant="body">Verifications</Typography>
      </Sidebar.Item>
      <Sidebar.Item value="Advanced search">
        <AdvancedSearchIcon aria-hidden />
        <Typography variant="body">Advanced search</Typography>
      </Sidebar.Item>
    </Sidebar.Group>
    {rail && (
      <Sidebar.Footer>
        <Sidebar.Item
          aria-haspopup={notifications && "dialog"}
          aria-expanded={notifications?.open}
          onClick={notifications?.onToggle}
        >
          <NotificationsIcon aria-hidden />
          <Typography variant="body">Notifications</Typography>
        </Sidebar.Item>
        <Sidebar.Account>
          <Avatar>JP</Avatar>
          <Typography variant="body">Jesse Pereira</Typography>
          <Button size="icon" aria-label="Profile settings" data-neutral="">
            <SettingsIcon aria-hidden />
          </Button>
        </Sidebar.Account>
      </Sidebar.Footer>
    )}
  </Sidebar>
);

type Notice = { id: string; type: NoticeType; words: string; time: string; unread: boolean };

/** The dashboard's workers who haven't checked in, have left the job site or cancelled, newest first, at 11:03 PM. */
const NOTICES: Notice[] = [
  {
    id: "tashonda",
    type: "cancellation",
    words: "Tashonda Williams cancelled November 2 of their 12:00 PM–9:00 PM shift with Sweets from the Earth.",
    time: "Just now",
    unread: true,
  },
  {
    id: "jeff",
    type: "missingCheckIn",
    words: "Jeff Gwartzmann hasn't checked in for tonight's 10:30 PM–6:00 AM shift with Bristol Circle Oakville.",
    time: "18 minutes ago",
    unread: true,
  },
  {
    id: "sikander",
    type: "missingCheckIn",
    words: "Sikander Mazumdar left the job site after checking in for tonight's 9:00 PM–5:00 AM shift with Sweets from the Earth.",
    time: "32 minutes ago",
    unread: true,
  },
  {
    id: "brittany",
    type: "missingCheckIn",
    words: "Brittany Pilz left the job site after checking in for tonight's 6:15 PM–1:45 AM shift with CCLS First Gulf.",
    time: "48 minutes ago",
    unread: false,
  },
  {
    id: "disha",
    type: "missingCheckIn",
    words: "Disha Patil hasn't checked in for tonight's 9:00 PM–5:00 AM shift with Four Seasons Produce.",
    time: "1 hour ago",
    unread: false,
  },
  {
    id: "cristofer",
    type: "cancellation",
    words: "Cristofer Dorwart cancelled November 2 and two other days of their 10:30 PM–6:30 AM shift with Harbourfront Catering.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: "marilyn",
    type: "cancellation",
    words: "Marilyn Calzoni cancelled November 4 and one other day of their 10:00 PM–6:00 AM shift with Bristol Circle Oakville.",
    time: "Yesterday, 4:20 PM",
    unread: false,
  },
];

// Whoever's signed in, as the store holds them.
const USER = { face: placeholderFace };

/** The header, its face the signed-in user's. */
const header = () =>
  datum(USER, "user", (user) => (
    <Header>
      <Header.Menu />
      <Avatar src={user.face} />
    </Header>
  ));

const HEADER = defineStory({
  id: "Header",
  figma: "Molecules/Navigation/Header",
  examples: [
    {
      render: () => (
        <Div tw="w-[25.25rem]">{header()}</Div>
      ),
    },
  ],
});

const SIDEBAR = defineStory({
  id: "Sidebar",
  figma: "Molecules/Navigation/Sidebar",
  examples: [{ render: () => sidebar() }, { title: "Rail", render: () => sidebar({ open: false, rail: true }) }],
});

// Open as Figma draws it, without taking the focus until its trigger opens it.
export const POPOVER_MENU = defineStory({
  id: "Popover Menu",
  figma: "Molecules/Navigation/Context Menu",
  examples: [
    {
      render: () => (
        <PopoverMenu.Root defaultOpen>
          <PopoverMenu.Trigger aria-label="More actions">
            <KebabIcon aria-hidden />
          </PopoverMenu.Trigger>
          <PopoverMenu label="More actions">
            <PopoverMenu.Item>
              <MenuNotesIcon aria-hidden />
              <Typography variant="body">Add note</Typography>
            </PopoverMenu.Item>
            <PopoverMenu.Item>
              <MenuPinIcon aria-hidden />
              <Typography variant="body">View location</Typography>
            </PopoverMenu.Item>
          </PopoverMenu>
        </PopoverMenu.Root>
      ),
    },
  ],
});

/** Figma's Notification Pane, its notifications the dashboard's. */
export const NOTIFICATION_PANE = (
  <Notifications>
    <Notifications.Header>
      <Typography variant="heading">Notifications</Typography>
      <Notifications.Close />
    </Notifications.Header>
    <Notifications.Toolbar>
      <Notifications.Filter>
        <SegmentedControl.Segment value="all">
          All
          <Notifications.UnreadCount />
        </SegmentedControl.Segment>
        <SegmentedControl.Segment value="missingCheckIn">
          Missing check-ins
          <Notifications.UnreadCount type="missingCheckIn" />
        </SegmentedControl.Segment>
        <SegmentedControl.Segment value="cancellation">
          Cancellations
          <Notifications.UnreadCount type="cancellation" />
        </SegmentedControl.Segment>
      </Notifications.Filter>
      <Notifications.MarkAllAsRead>Mark all as read</Notifications.MarkAllAsRead>
    </Notifications.Toolbar>
    <Notifications.List>
      {NOTICES.map(({ id, type, words, time, unread }) => (
        <Notifications.Item key={id} type={type} unread={unread}>
          <Typography tag="p" variant="body">
            {words}
          </Typography>
          <Typography variant="metadata" color="subdued">
            {time}
          </Typography>
        </Notifications.Item>
      ))}
    </Notifications.List>
  </Notifications>
);

/** Its pane beside the rail, whose footer's Notifications opens and shuts it, as the app's sidebar does. */
function FromSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Notifications.Root open={open} onOpenChange={setOpen}>
      <Div tw="flex items-end gap-(--sw-gap-xl)">
        {sidebar({ open: false, rail: true }, { open, onToggle: () => setOpen(!open) })}
        {children}
      </Div>
    </Notifications.Root>
  );
}

// The code view shows the pane alone.
FromSidebar.unwrap = ({ children }: { children: ReactNode }) => children;

export const NOTIFICATIONS = defineStory({
  id: "Notifications",
  figma: "Organisms/Notification/Notification Pane",
  examples: [{ render: () => <FromSidebar>{NOTIFICATION_PANE}</FromSidebar> }],
});

const GLOBAL_NAVIGATION = defineStory({
  id: "Global Navigation",
  figma: "Global Navigation",
  examples: [
    {
      layout: "fill",
      render: () => (
        <Sidebar.Provider>
          <Div tw="flex flex-col overflow-hidden rounded-(--sw-radius-md) border border-(--sw-border-subdued) bg-(--sw-surface-subdued)">
            {header()}
            {sidebar()}
          </Div>
        </Sidebar.Provider>
      ),
    },
  ],
});

export const NAVIGATION_STORIES: Story[] = [
  HEADER,
  SIDEBAR,
  GLOBAL_NAVIGATION,
];
