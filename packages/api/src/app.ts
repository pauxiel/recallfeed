import { Hono } from "hono";
import { cacheControl } from "./middleware/cache";
import { errorResponse, handleError } from "./middleware/errors";
import { requestId } from "./middleware/request-id";
import { injectPublicRequestFlag } from "./middleware/visibility";
import { feedRoutes } from "./routes/feed";
import { importRoutes } from "./routes/import";
import type { AppEnv } from "./types";

/**
 * The RecallFeed HTTP application.
 *
 * Both demonstration deployments run exactly this code. They differ only in environment variables
 * (`FEED_VISIBILITY`, `OWNER_EMAIL`, `API_SECRET_KEY`, `DATABASE_URL`), and nothing here branches on an
 * application name.
 *
 * Middleware order matters. The request ID and the cache headers come first so that every response,
 * including the early 401, 403, and 404 ones, carries them.
 */
export const app = new Hono<AppEnv>();

app.use("*", requestId);
app.use("*", cacheControl);
app.use("*", injectPublicRequestFlag);

app.route("/", importRoutes);
app.route("/", feedRoutes);

app.notFound((c) => errorResponse(c, 404, "Not found", "NOT_FOUND_ROUTE"));
app.onError(handleError);

export default app;
