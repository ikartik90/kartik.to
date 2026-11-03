import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FileUpload, PasswordInput, VerificationCodeInput, conditionOf, type Rule } from "../form-parts";
import { Field, Typography } from "../ui";

afterEach(cleanup);

const RULES: Rule[] = ["length", "uppercase", "lowercase", "number", "special"];
const conditionsOf = (password: string) => RULES.map((rule) => conditionOf(rule, password));

describe("the password's conditions", () => {
  it("check what's typed", () => {
    expect(conditionsOf("abc")).toEqual([
      "condition unmet",
      "condition unmet",
      "condition met",
      "condition unmet",
      "condition unmet",
    ]);
    expect(conditionsOf("Abcdefg1!").every((state) => state === "condition met")).toBe(true);
  });

  it("don't count a space as a special character", () => {
    expect(conditionOf("special", "a b")).toBe("condition unmet");
  });

  it("are all unmet by a blank password", () => {
    expect(conditionsOf("").every((state) => state === "condition unmet")).toBe(true);
  });
});

const UPLOAD = (
  <FileUpload>
    <FileUpload.Idle>
      <Typography variant="subheading">Drag and drop a file from your desktop or</Typography>
      <FileUpload.Browse>Browse files...</FileUpload.Browse>
      <Typography variant="metadata">
        Supported formats: CSV, XLS, XLSX. Maximum file size: 5 MB.
      </Typography>
    </FileUpload.Idle>
    <FileUpload.Dragging>
      <Typography variant="subheading">Drop file here to upload</Typography>
      <Typography variant="metadata">
        Supported formats: CSV, XLS, XLSX. Maximum file size: 5 MB.
      </Typography>
    </FileUpload.Dragging>
  </FileUpload>
);

const CONDITIONS = (
  <PasswordInput.Conditions>
    <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
    <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
    <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
    <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
    <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
  </PasswordInput.Conditions>
);

/** A password field as the Form page draws it: its label over the box, its conditions under it. */
function Password({ tone, value = "String value" }: { tone?: "alert"; value?: string }) {
  return (
    <Field tone={tone}>
      <Field.Label>Password</Field.Label>
      <PasswordInput defaultValue={value} defaultMasked>
        {CONDITIONS}
      </PasswordInput>
    </Field>
  );
}

describe("Molecules/Form/Password Input", () => {
  const condition = (label: string) => screen.getByText(label).closest("li")!.dataset.state;

  it("is labelled by its Label part, its conditions only while it has them", () => {
    render(
      <Field>
        <Field.Label>New Password</Field.Label>
        <PasswordInput defaultValue="abc" />
      </Field>,
    );
    expect(screen.getByLabelText<HTMLInputElement>("New Password").value).toBe("abc");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("reveals the password with Show and masks it again with Hide", async () => {
    const user = userEvent.setup();
    render(<Password tone="alert" />);
    const field = screen.getByLabelText<HTMLInputElement>("Password");
    expect(field.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(field.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(field.type).toBe("password");
  });

  it("shows no Show button until it's in use", async () => {
    const user = userEvent.setup();
    render(<Password value="" />);
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
    await user.click(screen.getByLabelText("Password"));
    expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();
  });

  it("masks the password again when the field is left", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Password />
        <button type="button">Elsewhere</button>
      </>,
    );
    const field = screen.getByLabelText<HTMLInputElement>("Password");
    await user.click(field);
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(field.type).toBe("text");
    expect(document.activeElement).toBe(field);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(field.type).toBe("password");
  });

  it("shows its conditions once it's focused, plain only while it's focused empty and nothing's been typed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Field>
          <Field.Label>Password</Field.Label>
          <PasswordInput>
            {CONDITIONS}
          </PasswordInput>
        </Field>
        <button type="button">Elsewhere</button>
      </>,
    );
    expect(screen.queryByRole("list")).toBeNull();
    await user.click(screen.getByLabelText("Password"));
    expect(condition("At least 1 number")).toBeUndefined();
    // Left blank, every condition is unmet.
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(condition("At least 1 number")).toBe("unmet");
    expect(condition("At least 8 characters")).toBe("unmet");
  });

  it("is an Alert from the start while what's in it misses a condition, its conditions checked", async () => {
    const user = userEvent.setup();
    render(<Password />);
    const field = screen.getByLabelText("Password");
    expect(field.closest("[data-field]")!.getAttribute("data-state")).toBe("alert");
    expect(condition("At least 1 uppercase character")).toBe("met");
    expect(condition("At least 1 number")).toBe("unmet");
    await user.clear(field);
    await user.type(field, "abc");
    expect(condition("At least 8 characters")).toBe("unmet");
    expect(condition("At least 1 lowercase character")).toBe("met");
    await user.type(field, "defG1!");
    expect(condition("At least 8 characters")).toBe("met");
    expect(condition("At least 1 uppercase character")).toBe("met");
    expect(condition("At least 1 number")).toBe("met");
    expect(condition("At least 1 special character")).toBe("met");
    cleanup();
    render(<Password tone="alert" value="" />);
    expect(condition("At least 1 number")).toBe("unmet");
  });

  it("holds its Active look, its conditions checked, while its field holds it, unless what's in it misses a condition", () => {
    const held = (value: string) => (
      <Field data-active="">
        <Field.Label>Password</Field.Label>
        <PasswordInput defaultValue={value} defaultMasked>
          {CONDITIONS}
        </PasswordInput>
      </Field>
    );
    render(held("Forkliftyard7!"));
    const state = () => screen.getByLabelText("Password").closest("[data-field]")!.getAttribute("data-state");
    expect(state()).toBe("active");
    expect(condition("At least 8 characters")).toBe("met");
    expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();
    cleanup();
    render(held("forkliftyard"));
    expect(state()).toBe("alert");
    expect(condition("At least 1 uppercase character")).toBe("unmet");
  });

  it("turns to Alert as soon as what's typed misses a condition, in use or not", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Password />
        <button type="button">Elsewhere</button>
      </>,
    );
    const field = screen.getByLabelText("Password");
    const root = () => field.closest("[data-field]")!.getAttribute("data-state");
    await user.clear(field);
    expect(root()).toBe("active");
    await user.type(field, "abc");
    expect(root()).toBe("alert");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(root()).toBe("alert");
    await user.type(field, "defG1!");
    expect(root()).toBe("active");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(root()).toBeNull();
  });

  it("hides its conditions when it's left with every one met, and shows them again once it's back in use", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Password />
        <button type="button">Elsewhere</button>
      </>,
    );
    const field = screen.getByLabelText("Password");
    await user.clear(field);
    await user.type(field, "Abcdefg1!");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("list")).toBeNull();
    await user.click(field);
    expect(condition("At least 8 characters")).toBe("met");
  });
});

/** A six-digit code, as the Form page draws it. */
function Code({ tone }: { tone?: "alert" }) {
  return (
    <Field tone={tone}>
      <Field.Label>Verification Code</Field.Label>
      <VerificationCodeInput>
        {Array.from({ length: 6 }, (_, i) => (
          <VerificationCodeInput.Digit key={i} />
        ))}
      </VerificationCodeInput>
      {tone && <Field.HintText>This verification code has expired</Field.HintText>}
    </Field>
  );
}

describe("Molecules/Form/Verification Code Input", () => {
  const digits = () => screen.getAllByRole<HTMLInputElement>("textbox", { name: "Verification Code" });

  it("has as many digits as it's given, each 0 to start, each named by its field's label", () => {
    render(
      <Field>
        <Field.Label>Verification Code</Field.Label>
        <VerificationCodeInput>
          <VerificationCodeInput.Digit />
          <VerificationCodeInput.Digit />
          <VerificationCodeInput.Digit />
          <VerificationCodeInput.Digit />
        </VerificationCodeInput>
      </Field>,
    );
    expect(digits().map((digit) => digit.value)).toEqual(["0", "0", "0", "0"]);
  });

  it("moves to the next digit as each is typed", async () => {
    const user = userEvent.setup();
    render(<Code />);
    await user.click(digits()[0]);
    await user.keyboard("4");
    expect(digits()[0].value).toBe("4");
    expect(document.activeElement).toBe(digits()[1]);
    await user.keyboard("2");
    expect(digits()[1].value).toBe("2");
    expect(document.activeElement).toBe(digits()[2]);
  });

  it("takes only digits", async () => {
    const user = userEvent.setup();
    render(<Code />);
    await user.click(digits()[0]);
    await user.keyboard("a");
    expect(digits()[0].value).toBe("0");
    expect(document.activeElement).toBe(digits()[0]);
  });

  it("fills every digit from a pasted code", async () => {
    const user = userEvent.setup();
    render(<Code />);
    await user.click(digits()[0]);
    await user.paste("482 913");
    expect(digits().map((digit) => digit.value)).toEqual(["4", "8", "2", "9", "1", "3"]);
    expect(document.activeElement).toBe(digits()[5]);
  });

  it("goes back a digit on Backspace in an empty one", async () => {
    const user = userEvent.setup();
    render(<Code />);
    await user.click(digits()[1]);
    await user.keyboard("{Backspace}");
    expect(digits()[1].value).toBe("");
    await user.keyboard("{Backspace}");
    expect(document.activeElement).toBe(digits()[0]);
    expect(digits()[0].value).toBe("");
  });

  it("is an alert, every digit with it, and hints under them", () => {
    render(<Code tone="alert" />);
    expect(digits().every((digit) => digit.closest("[data-state]")!.getAttribute("data-state") === "alert")).toBe(true);
    expect(screen.getByText("This verification code has expired")).toBeTruthy();
  });
});

describe("Molecules/Form/File Upload", () => {
  const sheet = (name: string) => new File(["name,phone"], name, { type: "text/csv" });
  const idle = "Drag and drop a file from your desktop or";

  it("shows a chosen spreadsheet's name in place of what it says", async () => {
    const user = userEvent.setup();
    render(UPLOAD);
    await user.upload(screen.getByLabelText("Browse files..."), sheet("roster.csv"));
    expect(screen.getByText("roster.csv")).toBeTruthy();
    expect(screen.queryByText(idle)).toBeNull();
  });

  it("offers only CSV, XLS and XLSX files, and takes no other dropped on it", () => {
    render(UPLOAD);
    const picker = screen.getByLabelText("Browse files...");
    expect(picker.getAttribute("accept")).toBe(".csv,.xls,.xlsx");
    const picture = new File(["picture"], "face.png", { type: "image/png" });
    fireEvent.drop(picker.closest("[data-upload]")!, { dataTransfer: { types: ["Files"], files: [picture] } });
    expect(screen.queryByText("face.png")).toBeNull();
    expect(screen.getByText(idle)).toBeTruthy();
  });

  it("turns Active while a file is dragged over it, and shows the dropped one's name", async () => {
    render(UPLOAD);
    const zone = screen.getByLabelText("Browse files...").closest("[data-upload]")!;
    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText("Drop file here to upload")).toBeTruthy();
    fireEvent.dragLeave(zone, { dataTransfer: { types: ["Files"] } });
    expect(screen.queryByText("Drop file here to upload")).toBeNull();
    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } });
    fireEvent.drop(zone, { dataTransfer: { types: ["Files"], files: [sheet("roster.xlsx")] } });
    await waitFor(() => expect(screen.getByText("roster.xlsx")).toBeTruthy());
    expect(screen.queryByText("Drop file here to upload")).toBeNull();
  });
});
