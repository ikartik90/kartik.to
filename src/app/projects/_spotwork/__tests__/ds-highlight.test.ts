import { describe, expect, it } from "vitest";
import { highlight } from "../ds-highlight";

const kinds = (line: string) =>
  highlight(line)[0]
    .filter((token) => token.text.trim())
    .map((token) => [token.kind, token.text.trim()]);

describe("an example's code, coloured", () => {
  it("splits the code into lines that read back as it", () => {
    const code = 'import { Button } from "@/components/ui/button"\n\nexport function A() {}';
    const lines = highlight(code);
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.map((token) => token.text).join("")).join("\n")).toBe(code);
  });

  it("marks keywords, strings and the function's name", () => {
    expect(kinds('import { Button } from "@/components/ui/button"')).toEqual([
      ["keyword", "import"],
      ["plain", "{ Button }"],
      ["keyword", "from"],
      ["string", '"@/components/ui/button"'],
    ]);
    expect(kinds("export function ButtonSize() {")).toEqual([
      ["keyword", "export"],
      ["keyword", "function"],
      ["name", "ButtonSize"],
      ["plain", "() {"],
    ]);
  });

  it("marks tags and their attributes, bare ones too, and leaves the words between tags plain", () => {
    expect(kinds('<TextInput.Field size="small" defaultChecked onClick={() => {}}>Save the day</TextInput.Field>')).toEqual([
      ["plain", "<"],
      ["tag", "TextInput.Field"],
      ["attribute", "size"],
      ["plain", "="],
      ["string", '"small"'],
      ["attribute", "defaultChecked"],
      ["attribute", "onClick"],
      ["plain", "={() => {}}>Save the day</"],
      ["tag", "TextInput.Field"],
      ["plain", ">"],
    ]);
  });

  it("marks a comment", () => {
    expect(kinds("  {/* … */}")).toEqual([["comment", "{/* … */}"]]);
  });
});
