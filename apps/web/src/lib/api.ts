const DEFAULT_API_BASE_URL = "http://localhost:8000/v1";

/** Server-side API base URL (never exposed to the browser). */
export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export type ApiStatus = { reachable: boolean; database: boolean };

/** Reads the API readiness endpoint from server code. Never throws. */
export async function readApiStatus(): Promise<ApiStatus> {
  try {
    const res = await fetch(`${apiBaseUrl()}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    return { reachable: true, database: res.ok };
  } catch {
    return { reachable: false, database: false };
  }
}
