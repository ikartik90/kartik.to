import type { FC, SVGProps } from "react";
import type { Standing } from "./activations";
import { Pill, type ChipState } from "./ui";
import AbsentIcon from "./assets/absent.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import InProgressIcon from "./assets/in-progress.svg";

type Look = { label: string; state: ChipState; Icon: FC<SVGProps<SVGSVGElement>> };

const STATUS: Record<Standing, Look> = {
  pending: { label: "Pending review", state: "warning", Icon: InProgressIcon },
  approved: { label: "Onboarding", state: "affirmative", Icon: ConfirmedIcon },
  rejected: { label: "Rejected", state: "alert", Icon: AbsentIcon },
  onboarded: { label: "Active", state: "success", Icon: ConfirmedIcon },
  deactivated: { label: "Deactivated", state: "alert", Icon: AbsentIcon },
};

export const statusLabel = (status: Standing) => STATUS[status].label;

/** A company's status, as the Companies table's last column, its Activation card's title and its history show it. */
export function StatusPill({ status }: { status: Standing }) {
  const { label, state, Icon } = STATUS[status];
  return (
    <Pill state={state}>
      <Icon aria-hidden />
      {label}
    </Pill>
  );
}
