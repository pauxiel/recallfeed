import { neonConfig } from "@neondatabase/serverless";

/**
 * Counts the HTTP requests the Neon driver makes while `run` executes.
 *
 * In a Worker each one is a subrequest, and the free tier allows 50 per request, so this is how
 * tests show an operation stays within that limit. It is a test aid: it briefly replaces the
 * driver's process-wide `fetchFunction` and always restores it, so run it on one operation at a
 * time. Spec 02 keeps `@neondatabase/serverless` inside this package, which is why other packages
 * call this helper instead of importing the driver.
 *
 * @param run - The operation to measure.
 * @returns The operation's result and how many HTTP requests it made.
 */
export async function countHttpRequests<T>(run: () => Promise<T>): Promise<{ result: T; requests: number }> {
  const original: unknown = neonConfig.fetchFunction;
  const real = typeof original === "function" ? (original as typeof fetch) : fetch;
  let requests = 0;
  neonConfig.fetchFunction = (...args: Parameters<typeof fetch>): Promise<Response> => {
    requests += 1;
    return real(...args);
  };
  try {
    const result = await run();
    return { result, requests };
  } finally {
    neonConfig.fetchFunction = original;
  }
}
