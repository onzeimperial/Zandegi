/**
 * One JSON mutation from the browser, reduced to what a screen needs to say.
 *
 * Every plan edit and log goes through here so the four outcomes are worded the
 * same everywhere: it saved; the person must go home (signed out or not
 * invited); the plan changed elsewhere; or something else went wrong, with the
 * server's published message, or an offline message when nothing came back.
 */

export type SendOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "go-home" }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export type JsonFetch = (input: string, init: RequestInit) => Promise<Response>;

const OFFLINE = "You seem to be offline. Try again when connected.";
const FAILED = "That didn't save. Try again.";

export async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  fetcher: JsonFetch = (input, init) => fetch(input, init),
): Promise<SendOutcome<T>> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", message: OFFLINE };
  }

  const parsed = (await response.json().catch(() => null)) as
    (T & { error?: { code?: string; message?: string } }) | null;
  const code = parsed?.error?.code;
  if (code === "SIGN_IN_REQUIRED" || code === "ACCOUNT_NOT_ALLOWED") return { kind: "go-home" };
  if (code === "PLAN_EDIT_CONFLICT") {
    return { kind: "conflict", message: parsed?.error?.message ?? FAILED };
  }
  if (!response.ok || parsed === null || parsed.error !== undefined) {
    return { kind: "error", message: parsed?.error?.message ?? FAILED };
  }
  return { kind: "ok", data: parsed };
}
