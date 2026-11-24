import { ApiError } from "@/lib/api/errors";

/**
 * A message table's own text for a key that came from a request or the server, or undefined. A
 * plain lookup does not do: for a key such as "constructor" it answers with a function the table
 * inherits, and rendering that breaks the page.
 */
export function ownMessage(
  table: Readonly<Record<string, string>>,
  key: string | undefined,
): string | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** Messages for failures reported by the plain form POST (`?error=`). */
export const SIGN_IN_ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  forbidden: "This account cannot use the dashboard.",
  rate: "Too many attempts. Wait a minute and try again.",
  unavailable: "The API could not be reached. Try again shortly.",
  origin: "The request was blocked. Reload the page and try again.",
};

/** The notice for a failed plain form POST (`?error=`); a code that is not ours reads as an outage. */
export function signInError(code: string): string {
  return ownMessage(SIGN_IN_ERRORS, code) ?? SIGN_IN_ERRORS.unavailable;
}

/** Messages for why a session ended (`?reason=`). */
const END_NOTES: Record<string, string> = {
  inactive: "Signed out after a period of inactivity.",
  expired: "The session expired. Sign in again.",
  elsewhere: "Signed out in another tab.",
  "signed-out": "Signed out.",
};

/** The note for why a session ended (`?reason=`), or undefined for a reason that is not ours. */
export function endNote(reason: string): string | undefined {
  return ownMessage(END_NOTES, reason);
}

/** What the dashboard says for an API error code, where the server's own message is not enough. */
const API_MESSAGES: Record<string, string> = {
  NOT_EMPTY: "It still contains items. Move them out first.",
  DRAFT_EXISTS: "A draft already exists. Open it or discard it first.",
  SLUG_TAKEN: "That slug is taken.",
};

/** One sentence for any failure of an admin API call: the API's reason, or the connection. */
export function apiMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "The server could not be reached.";
  return ownMessage(API_MESSAGES, err.code) ?? err.message;
}
