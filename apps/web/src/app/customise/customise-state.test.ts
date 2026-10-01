import { describe, expect, it } from "vitest";
import { characterLook, customiseReducer, initialCustomiseState } from "./customise-state";

describe("local character customiser", () => {
  it("switches tabs and selects an available swatch", () => {
    const onPants = customiseReducer(initialCustomiseState, { type: "tab", tab: "pants" });
    const picked = customiseReducer(onPants, { type: "select", tab: "pants", index: 2 });
    expect(picked.tab).toBe("pants");
    expect(picked.selected).toMatchObject({ pants: 2, hoodie: 0, skin: 1 });
  });

  it("refuses locked swatches and out-of-range indexes", () => {
    expect(customiseReducer(initialCustomiseState, { type: "select", tab: "hoodie", index: 5 })).toBe(initialCustomiseState);
    expect(customiseReducer(initialCustomiseState, { type: "select", tab: "shoes", index: 3 })).toBe(initialCustomiseState);
    expect(customiseReducer(initialCustomiseState, { type: "select", tab: "skin", index: 99 })).toBe(initialCustomiseState);
  });

  it("toggles an unlocked extra on and off, and never a locked one", () => {
    const on = customiseReducer(initialCustomiseState, { type: "toggle-extra", key: "glasses" });
    expect(on.extras.glasses).toBe(true);
    expect(customiseReducer(on, { type: "toggle-extra", key: "glasses" }).extras.glasses).toBe(false);
    expect(customiseReducer(initialCustomiseState, { type: "toggle-extra", key: "crown" })).toBe(initialCustomiseState);
  });

  it("lets a cap replace the hair silhouette and hide the sweatband", () => {
    const banded = customiseReducer(initialCustomiseState, { type: "toggle-extra", key: "band" });
    expect(characterLook(banded).band).toBe(true);
    expect(characterLook(banded).hairStyle).toBe("buzz");
    const capped = customiseReducer(banded, { type: "toggle-extra", key: "cap" });
    expect(characterLook(capped).cap).toBe(true);
    expect(characterLook(capped).band).toBe(false);
    expect(characterLook(capped).hairStyle).toBeNull();
  });

  it("resets every local selection", () => {
    const changed = customiseReducer(initialCustomiseState, { type: "select", tab: "hoodie", index: 2 });
    expect(customiseReducer(changed, { type: "reset" })).toBe(initialCustomiseState);
  });
});
