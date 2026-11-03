"use client";

import { css } from "../../../../styled-system/css";
import { BarChart, StackedBarChart } from "./data-viz";
import { addDays, recentSpend, weekLabel, weekOf, weekSpots, type Iso, type Series } from "./shifts";
import { Card, Chip, Tooltip, Typography } from "./ui";

const halvesStyle = css({ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--sw-gap-xl)" });

/** An amount to the cent, as "58,490.98". */
const cad = (amount: number) => amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Minutes into the visitor's day. */
const minutesNow = () => new Date().getHours() * 60 + new Date().getMinutes();

/** The Check-ins page's cards, half the row each: this week's shifts, and the last six weeks' spending. */
export function SummaryCards({ today, series }: { today: Iso; series: Series[] }) {
  const { checkedIn, absent, filled, vacant } = weekSpots(series, today, minutesNow());
  const { total, first, last, weeks } = recentSpend(today, minutesNow());
  const [dollars, cents] = cad(total).split(".");
  const spots: [string, number][] = [
    ["Completed", checkedIn],
    ["Absent", absent],
    ["Filled", filled],
    ["Vacant", vacant],
  ];
  return (
    <div className={halvesStyle}>
      <Card>
        <Card.Header>
          <Typography tag="h3" variant="subheading">Shifts this week</Typography>
        </Card.Header>
        <StackedBarChart type="status" legend="beside">
          <StackedBarChart.Metric>
            <StackedBarChart.Value>
              <Typography variant="title">{checkedIn + absent + filled + vacant}</Typography>
              <Typography variant="metadata" color="subdued">spots</Typography>
            </StackedBarChart.Value>
            <StackedBarChart.Bar>
              {spots.map(([label, count]) => (
                <StackedBarChart.Segment key={label} count={count} />
              ))}
            </StackedBarChart.Bar>
          </StackedBarChart.Metric>
          <StackedBarChart.Legend>
            {spots.map(([label, count]) => (
              <StackedBarChart.LegendUnit key={label}>
                <Typography variant="metadata" color="subdued">{label}</Typography>
                <Chip size="small" state="affirmative">{count}</Chip>
              </StackedBarChart.LegendUnit>
            ))}
          </StackedBarChart.Legend>
        </StackedBarChart>
      </Card>
      <Card>
        <Card.Header>
          <Typography tag="h3" variant="subheading">Spending</Typography>
        </Card.Header>
        <BarChart scale unit="Week">
          <BarChart.Metric>
            <BarChart.Value>
              {/* The cents meet the dollars, with no gap between. */}
              <Typography variant="title">
                {dollars}
                <Typography variant="metadata" color="subdued">{`.${cents} CAD`}</Typography>
              </Typography>
              <Typography variant="metadata" color="subdued">{weekLabel([first, last])}</Typography>
            </BarChart.Value>
            <BarChart.Bar>
              {weeks.map(({ week, amount }, i) => (
                <BarChart.Segment key={week} value={amount} label={`${week}`} subdued={i === weeks.length - 1}>
                  <Tooltip above>
                    <span>{weekLabel(weekOf(addDays(first, i * 7)))}</span>
                    <span>{`${cad(amount)} CAD`}</span>
                  </Tooltip>
                </BarChart.Segment>
              ))}
            </BarChart.Bar>
          </BarChart.Metric>
        </BarChart>
      </Card>
    </div>
  );
}
