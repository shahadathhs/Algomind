/** Messages for failures reported by the plain form POST (`?error=`). */
export const SIGN_IN_ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  forbidden: "This account cannot use the dashboard.",
  rate: "Too many attempts. Wait a minute and try again.",
  unavailable: "The API could not be reached. Try again shortly.",
  origin: "The request was blocked. Reload the page and try again.",
};

/** Messages for why a session ended (`?reason=`). */
export const END_NOTES: Record<string, string> = {
  inactive: "Signed out after a period of inactivity.",
  expired: "The session expired. Sign in again.",
  elsewhere: "Signed out in another tab.",
  "signed-out": "Signed out.",
};
