import type { AppEnv } from './env';
import type { Project, DeploymentSelection, Release } from '../shared/model';
import type { DeploymentOptions } from '../shared/provider-settings';
import { deploymentSelection, hostingProvider, matchesDeployment } from '../shared/deployment';
import { ProviderSettings } from './provider-settings';
import { requireCondition } from './domain';
export async function deploymentOptions(env: AppEnv, project: Project): Promise<DeploymentOptions> {
  const selection = deploymentSelection(project, !!env.SERVER_SITE_SUFFIX);
  let current = project.hostingTarget;
  if (project.publishedReleaseId) {
    const row = await env.DB.prepare('SELECT data FROM releases WHERE id=? AND project_id=?')
      .bind(project.publishedReleaseId, project.id)
      .first<{ data: string }>();
    if (row) current = (JSON.parse(row.data) as Release).hostingTarget;
  }
  const { accounts, warnings } = await new ProviderSettings(env).hostingOptions(project.id);
  return {
    enabled: !!env.SERVER_SITE_SUFFIX,
    selection,
    currentProvider: project.publishedReleaseId
      ? hostingProvider(current, !!env.SERVER_SITE_SUFFIX)
      : null,
    currentUrl: project.siteUrl ?? null,
    pendingChange:
      !!project.publishedReleaseId &&
      !matchesDeployment(current, selection, !!env.SERVER_SITE_SUFFIX),
    accounts,
    warnings,
    publicOrigin: env.PUBLIC_SITE_ORIGIN,
  };
}
export async function validateDeployment(
  env: AppEnv,
  project: Project,
  body: Record<string, unknown>,
): Promise<DeploymentSelection> {
  requireCondition(
    env.SERVER_SITE_SUFFIX,
    409,
    'deployment_unavailable',
    '部署位置选择仅在服务器后台提供。',
  );
  requireCondition(
    body.provider === 'server' || body.provider === 'cloudflare',
    400,
    'invalid_deployment',
    '请选择发布位置。',
  );
  const active = await env.DB.prepare(
    "SELECT count(*) AS n FROM jobs WHERE project_id=? AND status IN ('queued','running','unknown') AND kind='publish'",
  )
    .bind(project.id)
    .first<{ n: number }>();
  requireCondition(!active?.n, 409, 'publish_pending', '发布进行中，请等待完成后修改部署位置。');
  const selection: DeploymentSelection = { provider: body.provider as 'server' | 'cloudflare' };
  if (selection.provider === 'cloudflare') {
    requireCondition(
      typeof body.credentialId === 'string' && typeof body.accountId === 'string',
      400,
      'hosting_account_required',
      '请选择 Cloudflare 发布账号。',
    );
    await new ProviderSettings(env).hostingCredential(
      project.id,
      body.credentialId as string,
      body.accountId as string,
    );
    selection.credentialId = body.credentialId as string;
    selection.accountId = body.accountId as string;
  }
  const old = deploymentSelection(project, true);
  const changed = old.provider !== selection.provider || old.accountId !== selection.accountId;
  if (project.publishedReleaseId && changed) {
    requireCondition(
      body.confirmMigration === true,
      409,
      'migration_confirmation_required',
      '更改发布位置将在下次发布后更换网站地址，请确认迁移。',
    );
    const bound = await env.DB.prepare(
      'SELECT count(*) AS n FROM project_domains WHERE project_id=?',
    )
      .bind(project.id)
      .first<{ n: number }>();
    requireCondition(!bound?.n, 409, 'domains_bound', '请先解除自定义域名绑定，再迁移发布位置。');
  }
  return selection;
}
