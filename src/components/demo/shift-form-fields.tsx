import { css } from "../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Combobox } from "@/components/ui/input/combobox";
import { TextInput } from "@/components/ui/input/text-input";
import { Checkbox } from "@/components/ui/input/checkbox";

const ROLES = [
  { value: "barista", label: "Barista" },
  { value: "floor", label: "Floor Supervisor" },
  { value: "kitchen", label: "Kitchen Hand" },
];

// On the frame, not the field root: constraining the root wraps the label.
const breakInputStyle = css({ width: "70px" });

/** The old form's left-hand column. Render inside a {@link Wireframe}. */
export function ShiftFormFields() {
  return (
    <>
      <Field>
        <Field.Label>Shift Role</Field.Label>
        <Combobox placeholder="Select a shift role">
          {ROLES.map((role) => (
            <Combobox.Option key={role.value} value={role.value}>
              {role.label}
            </Combobox.Option>
          ))}
        </Combobox>
        <Field.Hint>Required</Field.Hint>
      </Field>

      <Field>
        <Field.Label>Break Duration (mins)</Field.Label>
        <Field.Frame className={breakInputStyle}>
          <Field.Control defaultValue="30 min" />
        </Field.Frame>
      </Field>

      <TextInput
        label="Additional Notes"
        defaultValue="Anything the team should know"
        hint="Visible to everyone rostered on this shift"
      />

      <Field>
        <Checkbox />
        <Field.Label>Notify the team when this shift is posted</Field.Label>
      </Field>
    </>
  );
}
