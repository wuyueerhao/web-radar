import type { Principal } from '../shared/model';
export interface Secrets {
  SERVER_SITE_SUFFIX?: string; // Server adapter only; unset in Cloudflare deployments.
  TEMPLATE_GUIDES_API_KEY?: string; // Read-only internal template specifications; not a project/session credential.
  PRODUCT_RADAR_BASE_URL?: string;
  PRODUCT_RADAR_INTEGRATION_SECRET?: string;
  PRODUCT_RADAR_PARENT_ORIGINS?: string;
  APP_ORIGIN?: string;
  ENVIRONMENT?: string;
  TEST_PROVIDERS?: string;
  CONNECTIONS_TEST_NETWORK?: string; // Only enabled by the isolated browser harness with mocked outbound fetch.
  CLONE_TEST_FIXTURE?: string;
  TEXT_API_BASE_URL?: string;
  TEXT_API_KEY?: string;
  TEXT_MODEL?: string;
  IMAGE_API_BASE_URL?: string;
  IMAGE_API_KEY?: string;
  IMAGE_MODEL?: string;
  SITE_BUILDER_URL?: string;
  SITE_BUILDER_KEY?: string;
  AGNES_API_BASE_URL?: string;
  AGNES_API_KEY?: string;
  AGNES_MODEL?: string;
  AGNES_CONTRACT?: string;
  AGNES_SUBMIT_PATH?: string;
  AGNES_STATUS_PATH?: string;
  PROVIDER_MEDIA_ORIGINS?: string;
  CLOUDFLARE_HOSTING_ACCOUNTS?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  ASSET_SIGNING_KEY?: string;
  OPENAI_API_KEY?: string;
}
export type AppEnv = Secrets & { EDM_EMAIL_QUEUE?: Queue; EDM_SITE_QUEUE?: Queue; BROWSER?: Fetcher } & Pick<Cloudflare.Env, 'DB' | 'MEDIA' | 'COORDINATOR' | 'ASSETS'>;
export type HonoEnv = {
  Bindings: AppEnv;
  Variables: { principal: Principal; sessionHash: string };
};
export function testMode(env: Secrets): boolean {
  return env.ENVIRONMENT === 'test' && env.TEST_PROVIDERS === 'true';
}
