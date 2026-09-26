// Cloudflare Workers 环境绑定类型
export type Bindings = {
  DB: D1Database;
  CREDENTIAL_KEY: string;
  TEST_MODE: boolean;
  STORAGE: R2Bucket;
  EMAIL_QUEUE: Queue;
  SITE_MESSAGE_QUEUE: Queue;
  BROWSER: Fetcher;
  // Secrets
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  SES_ACCESS_KEY_ID: string;
  SES_SECRET_ACCESS_KEY: string;
  SES_REGION: string;
  DEEPSEEK_API_KEY: string;
  SERP_API_KEY: string;
};

// Hono 应用变量类型
export type Variables = {
  user: {
    actorId?: string;
    teamRead?: boolean;
    id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "member" | "viewer";
  } | null;
};

// 分页参数
export type PaginationParams = {
  page: number;
  pageSize: number;
};

// API 响应格式
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

// 用户角色
export const UserRoles = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

// 角色权限映射
export const RolePermissions: Record<UserRole, string[]> = {
  owner: [
    "users:manage",
    "contacts:read",
    "contacts:write",
    "contacts:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "campaigns:read",
    "campaigns:write",
    "campaigns:delete",
    "campaigns:send",
    "crm:read",
    "crm:write",
    "settings:manage",
    "site-messages:read",
    "site-messages:write",
    "site-messages:delete",
    "site-messages:send",
  ],
  admin: [
    "settings:manage",
    "users:manage",
    "contacts:read",
    "contacts:write",
    "contacts:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "campaigns:read",
    "campaigns:write",
    "campaigns:delete",
    "campaigns:send",
    "crm:read",
    "crm:write",
    "site-messages:read",
    "site-messages:write",
    "site-messages:delete",
    "site-messages:send",
  ],
  member: [
    "contacts:read",
    "contacts:write",
    "templates:read",
    "templates:write",
    "campaigns:read",
    "campaigns:write",
    "campaigns:send",
    "crm:read",
    "crm:write",
    "site-messages:read",
    "site-messages:write",
    "site-messages:send",
  ],
  viewer: [
    "contacts:read",
    "templates:read",
    "campaigns:read",
    "crm:read",
    "site-messages:read",
  ],
};
