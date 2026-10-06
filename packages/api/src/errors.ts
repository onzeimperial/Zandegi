/**
 * Server-side error carrier for use cases.
 *
 * The split matters: `code` and its published message are the only things a
 * client ever sees, while `diagnostic` — the failing stage, the underlying
 * message — stays on this object for the adapter to log. Personal content is
 * redacted before it is ever written into a diagnostic.
 */

import { GENERATION_ERROR_MESSAGES, type GenerationErrorCode } from "./client";

export class GenerationError extends Error {
  readonly code: GenerationErrorCode;
  /** Server-only. Never put this in a response body. */
  readonly diagnostic: string;

  constructor(code: GenerationErrorCode, diagnostic = "", options?: { cause?: unknown }) {
    super(GENERATION_ERROR_MESSAGES[code], options);
    this.name = "GenerationError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

export function isGenerationError(value: unknown): value is GenerationError {
  return value instanceof GenerationError;
}

/**
 * Strip personal content out of a diagnostic string. The user's goal text is
 * the obvious carrier — an API-key-shaped token is the other one, because a
 * provider SDK happily puts it in an error message.
 */
export function redactDiagnostic(text: string, personalContent: readonly string[] = []): string {
  let redacted = text;
  for (const secret of personalContent) {
    const trimmed = secret.trim();
    if (trimmed.length < 3) continue;
    redacted = redacted.split(trimmed).join("[redacted]");
  }
  return redacted.replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}/g, "[redacted]");
}

/** A safe, bounded description of a thrown value. */
export function describeFailure(error: unknown, personalContent: readonly string[] = []): string {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `Non-error thrown: ${typeof error}`;
  return redactDiagnostic(raw, personalContent).slice(0, 500);
}
