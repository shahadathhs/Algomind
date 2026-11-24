/**
 * What the error filter would send for the error `run` throws: its status and response body.
 * Fails the test when nothing is thrown.
 */
export async function failure(run: () => unknown): Promise<Record<string, unknown>> {
  try {
    await run();
  } catch (error) {
    const e = error as { getStatus(): number; getResponse(): Record<string, unknown> };
    return { status: e.getStatus(), ...e.getResponse() };
  }
  throw new Error("expected a failure");
}
