export interface ProviderAccount {
  id: string;
  kind: 'cloudflare' | 'resend';
  scope: string;
  label: string;
  mailFrom?: string;
  isDefault: boolean;
  createdAt: string;
}
export interface CloudflareZone {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  status: string;
}
export interface DomainBinding {
  hostname: string;
  status: string;
  credentialId: string;
  zoneName: string;
  createdAt: string;
}
export interface SiteConnections {
  accounts: ProviderAccount[];
  defaultCloudflareAccountId: string | null;
  domains: DomainBinding[];
  resendAccountId: string | null;
  environmentEmail: boolean;
  published: boolean;
  hostingProvider?: 'cloudflare' | 'server';
  serverAddress?: string;
}

export interface DeploymentOptions {
  enabled: boolean;
  selection: import('./model').DeploymentSelection;
  currentProvider: 'cloudflare' | 'server' | null;
  currentUrl: string | null;
  pendingChange: boolean;
  accounts: { credentialId: string; accountId: string; label: string }[];
  warnings: string[];
  publicOrigin?: string;
}
