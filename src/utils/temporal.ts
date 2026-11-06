import type { Temporal as Polyfill } from "@js-temporal/polyfill";

// The browser's own Temporal; the polyfill is fetched only where there is none.
export const Temporal: typeof Polyfill =
  (globalThis as { Temporal?: typeof Polyfill }).Temporal ?? (await import("@js-temporal/polyfill")).Temporal;

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Temporal {
  export type PlainDate = Polyfill.PlainDate;
  export type PlainTime = Polyfill.PlainTime;
  export type PlainDateTime = Polyfill.PlainDateTime;
  export type PlainYearMonth = Polyfill.PlainYearMonth;
  export type ZonedDateTime = Polyfill.ZonedDateTime;
  export type Instant = Polyfill.Instant;
  export type Duration = Polyfill.Duration;
}
