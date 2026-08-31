import { css } from "../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Combobox } from "@/components/ui/input/combobox";
import { TextInput } from "@/components/ui/input/text-input";
import { Checkbox } from "@/components/ui/input/checkbox";

// ---------------------------------------------------------------------------
// The old "Post a Shift" form's field column, as a shape — the Figma's
// "Non-Interactive Wireframe Block" (745:4383 in Shift Scheduling v0,
// 1137:5978 in the Scheduling Layout Redesign). One design component, so one
// module: the two demos are arguing about the SAME screen, and a second copy of
// these four fields would be a second place for that screen to drift.
//
// They are real components — Combobox, TextInput, Checkbox — rather than a
// drawing of them, so inside a `<Wireframe>` they keep their true frames,
// chevron, checkbox box and vertical rhythm while only their text reads as
// bars. The layout is the subject; specific copy would only invite you to read
// it instead.
//
// It brings NO `Wireframe` scope and NO column layout of its own, because both
// are the consumer's argument to make. v0 sinks the block to 25% beside a live
// calendar, leaving that calendar as the one thing in focus; the layout
// redesign holds it at 50% beside an equally wireframed calendar, because there
// neither column outranks the other — the ARRANGEMENT is the point.
// ---------------------------------------------------------------------------

/** A role or two, so the Combobox is the real control rather than a lookalike. */
const ROLES = [
  { value: "barista", label: "Barista" },
  { value: "floor", label: "Floor Supervisor" },
  { value: "kitchen", label: "Kitchen Hand" },
];

// The old form's "how long is the break" box. Per Figma 745:4395 the FIELD is
// 140.8px — the width of its label — while only the `Input+Hint Wrapper` inside
// it is 70px. So this lands on the frame, not on the field root: constraining
// the root instead wraps the long label to a second line, which pushes the
// label's bar off the input it belongs to.
const breakInputStyle = css({ width: "70px" });

/**
 * The four fields of the old form's left-hand column, in order. Render inside a
 * {@link Wireframe} — on its own the block is live, which is never what either
 * demo wants.
 */
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

      {/* Composed from the Field primitives rather than the flat-prop
        TextInput, because this is the one bespoke field here: its label
        and its input want different widths, and the assembly's single
        `className` can only reach the root. */}
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
