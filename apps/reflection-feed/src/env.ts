import type { AccessTokenEnv } from "@recallfeed/api/access";
import type { Env as ApiEnv } from "@recallfeed/api";

/** The ReflectionFeed Worker's environment: the shared API's settings plus the Access token settings. */
export type ReflectionFeedEnv = ApiEnv &
  AccessTokenEnv & {
    /** Shown in the page title. */
    APP_NAME?: string;
    /** Static assets, served by Cloudflare. */
    ASSETS: Fetcher;
  };
