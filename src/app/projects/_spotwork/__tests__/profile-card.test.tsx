import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "../data-table";
import { ProfileCard } from "../profile-card";
import { Chip, LabelValuePair, Spotscore, Typography, glyph } from "../ui";
import face from "../assets/faces/placeholder-female-monk-02.png";

afterEach(cleanup);

describe("Molecules/Overlay/Profile Overview Card", () => {
  it("heads the worker's details with their face, name and pills", () => {
    render(
      <ProfileCard>
        <ProfileCard.Header>
          <Avatar src={face} />
          <Typography variant="heading">Samantha Stevens</Typography>
          <Spotscore tier="elite">98</Spotscore>
          <Chip size="small" state="affirmative">Genumark Pool</Chip>
        </ProfileCard.Header>
        <ProfileCard.Details>
          <LabelValuePair>
            <Typography variant="metadata" className={glyph.subdued}>Phone Number</Typography>
            <Typography variant="body">(647) 467-2648</Typography>
          </LabelValuePair>
          <LabelValuePair>
            <Typography variant="metadata" className={glyph.subdued}>Location</Typography>
            <Typography variant="body">Mississauga</Typography>
          </LabelValuePair>
        </ProfileCard.Details>
      </ProfileCard>,
    );
    const head = screen.getByText("Samantha Stevens").parentElement!.parentElement!;
    // The avatar leads, wherever it's written; the name heads the pills.
    expect(head.firstElementChild!.querySelector("[data-avatar] img")).toBeTruthy();
    expect(screen.getByText("Samantha Stevens").nextElementSibling!.textContent).toBe("Elite98Genumark Pool");
    expect(within(head).getByText("Genumark Pool")).toBeTruthy();
    expect(head.querySelector("[data-tier=Elite]")!.textContent).toBe("Elite98");
    const details = screen.getByText("Phone Number").parentElement!.parentElement!;
    expect([...details.children].map((pair) => pair.textContent)).toEqual([
      "Phone Number(647) 467-2648",
      "LocationMississauga",
    ]);
  });
});
