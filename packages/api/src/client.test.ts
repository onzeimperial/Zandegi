import { describe, expect, it } from "vitest";
import { STAGE_NAMES } from "@zandegi/ai";
import { DOMAINS, SAFETY_CLASSES, VERIFICATION_METHODS } from "@zandegi/core";
import {
  GENERATION_ERROR_CODES,
  GENERATION_ERROR_MESSAGES,
  GENERATION_STAGES,
  generationErrorBody,
  isGenerationStage,
} from "./client";
import { WIRE_ENUM_PARITY } from "./generation/mapping";

describe("generation client contract", () => {
  it("lists the seven content stages in pipeline order and nothing else", () => {
    expect([...GENERATION_STAGES]).toEqual([...STAGE_NAMES]);
    expect(GENERATION_STAGES as readonly string[]).not.toContain("score");
    expect(GENERATION_STAGES as readonly string[]).not.toContain("persist");
    expect(isGenerationStage("safety")).toBe(true);
    expect(isGenerationStage("score")).toBe(false);
  });

  it("keeps the wire enums in step with core", () => {
    expect([...WIRE_ENUM_PARITY.domains]).toEqual([...DOMAINS]);
    expect([...WIRE_ENUM_PARITY.verificationMethods]).toEqual([...VERIFICATION_METHODS]);
    expect([...WIRE_ENUM_PARITY.safetyClasses]).toEqual([...SAFETY_CLASSES]);
  });

  it("keeps the stable error codes and their published messages", () => {
    expect([...GENERATION_ERROR_CODES]).toEqual([
      "GENERATION_DISABLED",
      "UNSUPPORTED_MEDIA_TYPE",
      "PAYLOAD_TOO_LARGE",
      "INVALID_JSON",
      "INVALID_REQUEST",
      "GENERATION_TIMEOUT",
      "GENERATION_FAILED",
      "CROSS_SITE_REQUEST",
      "MISSION_NOT_FOUND",
      "STORE_UNAVAILABLE",
      // Appended for step completion. Codes are only ever appended: clients
      // branch on them, so a rename or reorder above must fail this test.
      "STEP_NOT_CURRENT",
      "EVIDENCE_REJECTED",
      "SIGN_IN_REQUIRED",
      "ACCOUNT_NOT_ALLOWED",
      "DAILY_LIMIT_REACHED",
      "PLAN_EDIT_CONFLICT",
    ]);
    for (const code of GENERATION_ERROR_CODES) {
      expect(GENERATION_ERROR_MESSAGES[code]).toBeTruthy();
    }
    expect(generationErrorBody("GENERATION_TIMEOUT", "r1")).toEqual({
      error: {
        code: "GENERATION_TIMEOUT",
        message: "Mission generation timed out. Try again.",
        requestId: "r1",
      },
    });
  });
});
