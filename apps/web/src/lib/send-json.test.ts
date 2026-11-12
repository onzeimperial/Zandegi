import { describe, expect, it } from "vitest";
import { sendJson, type JsonFetch } from "./send-json";

const answer =
  (status: number, body: unknown): JsonFetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe("sending a JSON mutation", () => {
  it("returns the body when it saved", async () => {
    const outcome = await sendJson("/x", "POST", {}, answer(200, { log: { logId: "l" } }));
    expect(outcome).toEqual({ kind: "ok", data: { log: { logId: "l" } } });
  });

  it("sends a signed-out or uninvited person home", async () => {
    for (const code of ["SIGN_IN_REQUIRED", "ACCOUNT_NOT_ALLOWED"]) {
      const outcome = await sendJson("/x", "PATCH", {}, answer(401, { error: { code } }));
      expect(outcome).toEqual({ kind: "go-home" });
    }
  });

  it("reports a stale edit as a conflict with the server's message", async () => {
    const outcome = await sendJson(
      "/x",
      "PATCH",
      {},
      answer(409, { error: { code: "PLAN_EDIT_CONFLICT", message: "Reload." } }),
    );
    expect(outcome).toEqual({ kind: "conflict", message: "Reload." });
  });

  it("passes on the published message for any other failure", async () => {
    const outcome = await sendJson(
      "/x",
      "POST",
      {},
      answer(400, {
        error: { code: "INVALID_REQUEST", message: "The request fields are invalid." },
      }),
    );
    expect(outcome).toEqual({ kind: "error", message: "The request fields are invalid." });
  });

  it("says offline when nothing comes back, and never claims success on junk", async () => {
    const offline = await sendJson("/x", "POST", {}, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(offline).toEqual({ kind: "error", message: expect.stringContaining("offline") });
    const junk = await sendJson(
      "/x",
      "POST",
      {},
      async () => new Response("<html>", { status: 502 }),
    );
    expect(junk.kind).toBe("error");
  });
});
