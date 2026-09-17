import { beforeEach, describe, expect, it } from "vitest";
import { useMetadataPanelStore } from "../metadata-panel";

describe("useMetadataPanelStore", () => {
  beforeEach(() => useMetadataPanelStore.setState({ open: false }));

  it("starts closed", () => {
    expect(useMetadataPanelStore.getState().open).toBe(false);
  });

  it("opens and closes", () => {
    useMetadataPanelStore.getState().setOpen(true);
    expect(useMetadataPanelStore.getState().open).toBe(true);
    useMetadataPanelStore.getState().setOpen(false);
    expect(useMetadataPanelStore.getState().open).toBe(false);
  });
});
