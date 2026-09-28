import { describe,expect,it } from "vitest";
import { customiseReducer,initialCustomiseState } from "./customise-state";

describe("local character customiser",()=>{
  it("switches categories and independently selects available items",()=>{const outfit=customiseReducer(initialCustomiseState,{type:"category",category:"outfit"});const selected=customiseReducer(outfit,{type:"select",itemId:"trail"});expect(selected.category).toBe("outfit");expect(selected.selected).toMatchObject({colour:"violet",outfit:"trail",extras:"none"})});
  it("does not select locked or unknown items",()=>{expect(customiseReducer(initialCustomiseState,{type:"select",itemId:"mythic"})).toBe(initialCustomiseState);expect(customiseReducer(initialCustomiseState,{type:"select",itemId:"missing"})).toBe(initialCustomiseState)});
  it("resets all local selections explicitly",()=>{const selected=customiseReducer(initialCustomiseState,{type:"select",itemId:"teal"});expect(customiseReducer(selected,{type:"reset"})).toBe(initialCustomiseState)});
});
