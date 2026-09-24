import type { DeploymentSelection, Project, HostingTarget } from './model';
export function hostingProvider(
  target: HostingTarget | undefined,
  server: boolean,
): 'cloudflare' | 'server' {
  return target?.provider ?? (server ? 'server' : 'cloudflare');
}
export function deploymentSelection(project: Project, server: boolean): DeploymentSelection {
  if (project.deployment) return project.deployment;
  if (project.hostingTarget)
    return {
      provider: hostingProvider(project.hostingTarget, server),
      ...(project.hostingTarget.provider === 'cloudflare'
        ? {
            credentialId: project.hostingTarget.credentialId,
            accountId: project.hostingTarget.accountId,
          }
        : {}),
    };
  return { provider: 'cloudflare' };
}
export function matchesDeployment(
  target: HostingTarget | undefined,
  selection: DeploymentSelection,
  server: boolean,
) {
  return (
    !!target &&
    hostingProvider(target, server) === selection.provider &&
    (selection.provider === 'server' ||
      !selection.accountId ||
      target.accountId === selection.accountId)
  );
}
