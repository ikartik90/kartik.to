import Image from "next/image";
import { Fragment, forwardRef, memo, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { datum, each, exampleName, fileOf, jsxOf } from "../ds-code";
import { Div } from "../ds-tailwind";

function Button(props: { size?: string; disabled?: boolean; count?: number; onPress?: () => void; children?: ReactNode }) {
  return <button>{props.children}</button>;
}
const Card = Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
  displayName: "Card",
  Header: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, { displayName: "Card.Header" }),
  Body: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, { displayName: "Card.Body" }),
});
const SvgPlaceholderIcon = () => <svg />;
const SvgSend = () => <svg />;
function Holder({ initial, children }: { initial: string; children: (value: string, set: () => void) => ReactNode }) {
  return children(initial, () => {});
}
Holder.unwrap = ({ initial, children }: { initial: string; children: (value: string, set: () => void) => ReactNode }) =>
  children(initial, () => {});

describe("the code a specimen shows", () => {
  it("writes an element with text inside on one line", () => {
    expect(jsxOf(<Button size="large">Save</Button>)).toBe('<Button size="large">Save</Button>');
  });

  it("writes a record's fields and the words between them as one run, as JSX does", () => {
    const shift = { filled: 7, total: 30 };
    expect(jsxOf(datum(shift, "shift", (of) => <Button>{of.filled}/{of.total}</Button>))).toBe(
      "<Button>{shift.filled}/{shift.total}</Button>",
    );
    const size = "a-size-long-enough-to-break-the-line-of-the-element";
    const long = datum(shift, "shift", (of) => (
      <Button size={size}>
        {of.filled}/{of.total}
      </Button>
    ));
    expect(jsxOf(long)).toBe([`<Button size="${size}">`, "  {shift.filled}/{shift.total}", "</Button>"].join("\n"));
  });

  it("closes an element without children on itself", () => {
    expect(jsxOf(<Button size="small" />)).toBe('<Button size="small" />');
  });

  it("writes true as the bare prop, numbers and handlers in braces, and leaves out what's off", () => {
    expect(jsxOf(<Button disabled count={3} onPress={() => {}} size={undefined} />)).toBe(
      "<Button disabled count={3} onPress={() => {}} />",
    );
    expect(jsxOf(<Button disabled={false} />)).toBe("<Button />");
  });

  it("leaves out styling", () => {
    expect(jsxOf(<button className="x" style={{ color: "red" }} type="button" />)).toBe('<button type="button" />');
  });

  it("names a compound component's parts, nested one level in per part", () => {
    expect(
      jsxOf(
        <Card>
          <Card.Header>Title</Card.Header>
          <Card.Body>
            <Button>Go</Button>
          </Card.Body>
        </Card>,
      ),
    ).toBe(["<Card>", "  <Card.Header>Title</Card.Header>", "  <Card.Body>", "    <Button>Go</Button>", "  </Card.Body>", "</Card>"].join("\n"));
  });

  it("drops the layout boxes a story wraps its specimen in, and fragments", () => {
    expect(
      jsxOf(
        <div className="width">
          <>
            <Button>One</Button>
            {false}
            {null}
            <Button>Two</Button>
          </>
        </div>,
      ),
    ).toBe("<Button>One</Button>\n<Button>Two</Button>");
  });

  it("names icons for what they are", () => {
    expect(jsxOf(<SvgPlaceholderIcon />)).toBe("<PlaceholderIcon />");
    expect(jsxOf(<SvgSend />)).toBe("<SendIcon />");
  });

  it("writes lists, objects and elements given as props", () => {
    expect(jsxOf(<Button {...({ items: ["A", "B"], range: { from: 1, to: "b" }, icon: <SvgSend /> } as object)} />)).toBe(
      '<Button items={["A", "B"]} range={{ from: 1, to: "b" }} icon={<SendIcon />} />',
    );
  });

  it("quotes text that JSX would read as code, and strings with quotes", () => {
    expect(jsxOf(<Button size={'say "hi"'}>{"{a}"}</Button>)).toBe('<Button size={"say \\"hi\\""}>{"{a}"}</Button>');
  });

  it("writes a long element's props one to a line", () => {
    const long = "A label long enough to push the element past the line";
    expect(jsxOf(<Button size={long} count={12} onPress={() => {}} />)).toBe(
      ["<Button", `  size="${long}"`, "  count={12}", "  onPress={() => {}}", "/>"].join("\n"),
    );
  });

  it("writes what a holder of state renders, as it starts", () => {
    expect(jsxOf(<Holder initial="On">{(value) => <Button size={value} />}</Holder>)).toBe('<Button size="On" />');
  });

  it("keeps markup that carries meaning, though it has no props", () => {
    expect(jsxOf(<p className="line"><strong>John Smith</strong> cancelled</p>)).toBe("<strong>John Smith</strong>\ncancelled");
  });

  it("names an imported image for its file", () => {
    const face = { src: "/_next/static/media/placeholder-female-monk-02.4f3a9c1e.png", width: 80, height: 80, blurDataURL: "data:…" };
    expect(jsxOf(<Button {...({ face } as object)} />)).toBe("<Button face={placeholderFemaleMonk02} />");
  });

  it("shortens a long run of the same part to its first three and its last", () => {
    const dots = Array.from({ length: 10 }, (_, i) => <Card.Body key={i}>{String(i)}</Card.Body>);
    expect(jsxOf(<Card>{dots}</Card>)).toBe(
      [
        "<Card>",
        "  <Card.Body>0</Card.Body>",
        "  <Card.Body>1</Card.Body>",
        "  <Card.Body>2</Card.Body>",
        "  {/* … */}",
        "  <Card.Body>9</Card.Body>",
        "</Card>",
      ].join("\n"),
    );
  });

  it("names Next's image, and gets by a component that has no name", () => {
    // eslint-disable-next-line react/display-name -- nameless on purpose
    const Nameless = forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
    expect(jsxOf(<Image src="/face.png" alt="" width={30} height={30} />)).toBe('<Image src="/face.png" alt="" width={30} height={30} />');
    expect(jsxOf(<Nameless />)).toBe("<Component />");
  });

  it("names wrapped components by what they wrap", () => {
    const Wrapped = memo(function Pill() {
      return null;
    });
    const Forwarded = forwardRef<HTMLDivElement>(function Tag(_, ref) {
      return <div ref={ref} />;
    });
    expect(jsxOf(<Fragment><Wrapped /><Forwarded /></Fragment>)).toBe("<Pill />\n<Tag />");
  });
});

describe("an example's code, as a file of its own", () => {
  it("imports each component it uses from its own module, a compound one by its root, and returns it on one line", () => {
    expect(
      fileOf(
        "CheckboxDemo",
        <Card>
          <Card.Header>Title</Card.Header>
        </Card>,
      ),
    ).toBe(
      [
        'import { Card } from "@/components/ui/card"',
        "",
        "export function CheckboxDemo() {",
        "  return (",
        "    <Card>",
        "      <Card.Header>Title</Card.Header>",
        "    </Card>",
        "  )",
        "}",
      ].join("\n"),
    );
    expect(fileOf("ButtonDemo", <Button size="small">Save</Button>)).toBe(
      ['import { Button } from "@/components/ui/button"', "", "export function ButtonDemo() {", '  return <Button size="small">Save</Button>', "}"].join("\n"),
    );
  });

  it("breaks its lines at a narrower width when given one", () => {
    expect(fileOf("ButtonDemo", <Button size="small">Save to my drafts</Button>, 48)).toBe(
      [
        'import { Button } from "@/components/ui/button"',
        "",
        "export function ButtonDemo() {",
        "  return (",
        '    <Button size="small">',
        "      Save to my drafts",
        "    </Button>",
        "  )",
        "}",
      ].join("\n"),
    );
  });

  it("writes its layout as a div with Tailwind's classes, and wraps parts side by side in a fragment", () => {
    expect(
      fileOf(
        "ButtonSize",
        <Div tw="flex items-center gap-(--sw-gap-xl)">
          <Button size="large">Save</Button>
        </Div>,
      ),
    ).toContain(['    <div className="flex items-center gap-(--sw-gap-xl)">', '      <Button size="large">Save</Button>', "    </div>"].join("\n"));
    expect(fileOf("ButtonPair", [<Button key="a">A</Button>, <Button key="b">B</Button>])).toContain(
      ["  return (", "    <>", "      <Button>A</Button>", "      <Button>B</Button>", "    </>", "  )"].join("\n"),
    );
  });

  it("imports icons, Next's image and pictures from where they live, packages first", () => {
    const face = { src: "/_next/static/media/placeholder-female.4f3a9c1e.png", width: 80, height: 80 };
    const file = fileOf(
      "ButtonIcons",
      <Div tw="flex">
        <Button {...({ face } as object)}>
          <SvgPlaceholderIcon />
          <SvgSend />
        </Button>
        <Image src="/face.png" alt="" width={30} height={30} />
      </Div>,
    );
    expect(file.split("\n\nexport")[0]).toBe(
      [
        'import Image from "next/image"',
        "",
        'import placeholderFemale from "@/assets/placeholder-female.png"',
        'import { PlaceholderIcon, SendIcon } from "@/components/icons"',
        'import { Button } from "@/components/ui/button"',
      ].join("\n"),
    );
  });

  it("breaks an import too long for a line into one name a line", () => {
    const SvgCalendarClock = () => <svg />;
    const SvgCheckInLate = () => <svg />;
    const SvgPersonWalking = () => <svg />;
    const SvgTimesheetPending = () => <svg />;
    const file = fileOf(
      "Metrics",
      <Div tw="flex">
        <SvgCalendarClock />
        <SvgCheckInLate />
        <SvgPersonWalking />
        <SvgTimesheetPending />
      </Div>,
    );
    expect(file.split("\n\nexport")[0]).toBe(
      ["import {", "  CalendarClockIcon,", "  CheckInLateIcon,", "  PersonWalkingIcon,", "  TimesheetPendingIcon,", '} from "@/components/icons"'].join("\n"),
    );
  });

  it("writes a list drawn from data as a map over it, the data a prop of the file", () => {
    const face = { src: "/_next/static/media/ann.4f3a9c1e.jpg", width: 80, height: 80 };
    const people = [
      { id: "a", name: "Ann", face },
      { id: "b", name: "Bo", face },
    ];
    const items = each(people, "workers", (worker) => (
      <Card.Body key={worker.id} {...({ face: worker.face } as object)}>
        {worker.name}
      </Card.Body>
    ));
    expect(items.map((item) => (item.props as { children: string }).children)).toEqual(["Ann", "Bo"]);
    expect(fileOf("ListDemo", <Card>{items}</Card>)).toBe(
      [
        'import { Card } from "@/components/ui/card"',
        'import type { Worker } from "@/domain/worker"',
        "",
        "export function ListDemo({ workers }: { workers: Worker[] }) {",
        "  return (",
        "    <Card>",
        "      {workers.map((worker) => (",
        "        <Card.Body key={worker.id} face={worker.face}>{worker.name}</Card.Body>",
        "      ))}",
        "    </Card>",
        "  )",
        "}",
      ].join("\n"),
    );
  });

  it("writes one record drawn from data by its fields, the record a prop of the file", () => {
    const face = { src: "/_next/static/media/ann.4f3a9c1e.jpg", width: 80, height: 80 };
    const ann = { id: "a", name: "Ann", face, profile: { phone: "(647) 555-0142" } };
    const avatar = () =>
      datum(ann, "worker", (worker) => (
        <Button {...({ face: worker.face } as object)} size={worker.name.toLowerCase()}>
          {worker.profile.phone}
        </Button>
      ));
    expect((avatar().props as { children: string; size: string })).toMatchObject({ children: "(647) 555-0142", size: "ann" });
    expect(fileOf("AvatarDemo", <Div tw="flex">{avatar()}{avatar()}</Div>)).toBe(
      [
        'import { Button } from "@/components/ui/button"',
        'import type { Worker } from "@/domain/worker"',
        "",
        "export function AvatarDemo({ worker }: { worker: Worker }) {",
        "  return (",
        '    <div className="flex">',
        "      <Button face={worker.face} size={worker.name.toLowerCase()}>",
        "        {worker.profile.phone}",
        "      </Button>",
        "      <Button face={worker.face} size={worker.name.toLowerCase()}>",
        "        {worker.profile.phone}",
        "      </Button>",
        "    </div>",
        "  )",
        "}",
      ].join("\n"),
    );
  });

  it("maps a record's own list by its path", () => {
    const groups = [{ title: "Unread", contacts: [{ name: "Ann" }] }];
    const list = each(groups, "groups", (group) => (
      <Card.Header key={group.title}>
        {each(group.contacts, "contacts", (contact) => (
          <Card.Body key={contact.name}>{contact.name}</Card.Body>
        ))}
      </Card.Header>
    ));
    expect(fileOf("GroupsDemo", <Card>{list}</Card>)).toContain(
      [
        "      {groups.map((group) => (",
        "        <Card.Header key={group.title}>",
        "          {group.contacts.map((contact) => (",
        "            <Card.Body key={contact.name}>{contact.name}</Card.Body>",
        "          ))}",
        "        </Card.Header>",
        "      ))}",
      ].join("\n"),
    );
    expect(fileOf("GroupsDemo", <Card>{list}</Card>)).toContain("export function GroupsDemo({ groups }: { groups: Group[] }) {");
  });

  it("names an example for its component and its title", () => {
    expect(exampleName("Button", "Size")).toBe("ButtonSize");
    expect(exampleName("Button/Icon Button", undefined)).toBe("IconButtonDemo");
    expect(exampleName("Badge/Large", "Has Icon")).toBe("BadgeLargeHasIcon");
    expect(exampleName("Face/No Picture", "State")).toBe("FaceNoPictureState");
    expect(exampleName("Chip/Read-only", "Size")).toBe("ChipReadOnlySize");
  });
});
