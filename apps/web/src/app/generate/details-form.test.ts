import { describe, expect, it } from "vitest";
import {
  browserToday,
  emptyDetailsForm,
  toGenerationRequest,
  validateDetailsForm,
} from "./details-form";

const TODAY = "2026-11-04";

describe("the detail fields", () => {
  it("are all skippable: a blank form sends only the goal and timezone", () => {
    expect(validateDetailsForm(emptyDetailsForm, TODAY)).toEqual({});
    expect(toGenerationRequest(" Learn Farsi ", emptyDetailsForm, "Australia/Melbourne")).toEqual({
      rawText: "Learn Farsi",
      timezone: "Australia/Melbourne",
    });
  });

  it("turns hours into minutes and leaves blank fields out", () => {
    const request = toGenerationRequest(
      "Bench 100 kg",
      {
        ...emptyDetailsForm,
        hoursPerWeek: "2.5",
        startingPoint: "  I bench 60 kg  ",
        targetDate: "2027-03-01",
        location: "Melbourne",
      },
      undefined,
    );
    expect(request).toEqual({
      rawText: "Bench 100 kg",
      location: "Melbourne",
      weeklyTimeBudgetMinutes: 150,
      details: { startingPoint: "I bench 60 kg", targetDate: "2027-03-01" },
    });
  });

  it("accepts the smallest stated budget the error message promises", () => {
    expect(validateDetailsForm({ ...emptyDetailsForm, hoursPerWeek: "0.5" }, TODAY)).toEqual({});
    const request = toGenerationRequest("x", { ...emptyDetailsForm, hoursPerWeek: "0.5" }, "UTC");
    expect(request.weeklyTimeBudgetMinutes).toBe(30);
  });

  it("flags a past date but allows today", () => {
    expect(validateDetailsForm({ ...emptyDetailsForm, targetDate: "2026-11-03" }, TODAY)).toEqual({
      targetDate: "Pick today or a later date.",
    });
    expect(validateDetailsForm({ ...emptyDetailsForm, targetDate: TODAY }, TODAY)).toEqual({});
  });

  it.each(["0", "0.001", "0.49", "-1", "169", "lots"])("flags %s hours", (hoursPerWeek) => {
    expect(validateDetailsForm({ ...emptyDetailsForm, hoursPerWeek }, TODAY)).toHaveProperty(
      "hoursPerWeek",
    );
  });

  it("flags text over the limit", () => {
    const errors = validateDetailsForm(
      { ...emptyDetailsForm, why: "x".repeat(501), location: "x".repeat(201) },
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(["location", "why"]);
  });

  it("formats the local date as the date input expects", () => {
    expect(browserToday(new Date(2026, 10, 4, 12))).toBe(TODAY);
  });
});
