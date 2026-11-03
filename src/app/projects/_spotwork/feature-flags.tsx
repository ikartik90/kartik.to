"use client";

import { Fragment } from "react";
import { FLAGS, flagsText, type Flag } from "./activations";
import { switchRecord } from "./cards";
import { FEATURE_FLAGS } from "./copy";
import { sheetBodyStyle } from "./dashboard-sheet";
import { Card, SideSheet, Switch, Typography } from "./ui";

/** Manage feature flags' header and a switch for each feature, turning it on or off at once, in a small side sheet. */
export function FeatureFlags({
  company,
  flags,
  onChange,
}: {
  company: string;
  flags: Flag[];
  onChange: (flag: Flag, on: boolean) => void;
}) {
  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Manage feature flags</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{`${company} • ${flagsText(flags.length)}`}</Typography>
      </SideSheet.Header>
      <div className={sheetBodyStyle}>
        <Card>
          <Card.Records>
            {FLAGS.map((flag) => (
              <Fragment key={flag}>
                {switchRecord(
                  FEATURE_FLAGS[flag].label,
                  <Switch size="small" checked={flags.includes(flag)} onChange={(on) => onChange(flag, on)} />,
                  FEATURE_FLAGS[flag].description,
                )}
              </Fragment>
            ))}
          </Card.Records>
        </Card>
      </div>
    </>
  );
}
