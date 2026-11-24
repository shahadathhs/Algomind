import type { ApiErrorBody } from "@/lib/api/types";

/**
 * An error answer in the API's error shape, never cached. `retryAfter` (seconds) adds the
 * Retry-After header for a 429.
 */
export function problem(
  status: number,
  code: string,
  message: string,
  retryAfter?: number,
): Response {
  const body: ApiErrorBody = { statusCode: status, code, message };
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = String(retryAfter);
  return Response.json(body, { status, headers });
}
