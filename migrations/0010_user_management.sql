CREATE TABLE IF NOT EXISTS wr_members (
 workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 display_name TEXT NOT NULL DEFAULT '', workspace_name TEXT NOT NULL DEFAULT '',
 upstream_role TEXT NOT NULL DEFAULT 'member', is_super INTEGER NOT NULL DEFAULT 0,
 role TEXT CHECK(role IN ('admin','analyst','member','viewer')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_seen_at TEXT,
 PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS wr_members_email ON wr_members(email);
INSERT OR IGNORE INTO wr_members(workspace_id,user_id,created_at)
 SELECT workspace_id,owner_id,MIN(COALESCE(json_extract(data,'$.createdAt'),datetime('now'))) FROM projects GROUP BY workspace_id,owner_id;
CREATE TABLE IF NOT EXISTS wr_access_audit (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL, target_id TEXT NOT NULL,
 action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wr_access_audit_scope ON wr_access_audit(workspace_id,created_at);
ALTER TABLE edm_campaigns ADD COLUMN created_by TEXT;
ALTER TABLE edm_site_message_jobs ADD COLUMN created_by TEXT;
CREATE INDEX edm_campaigns_creator ON edm_campaigns(user_id,created_by,created_at);
CREATE INDEX edm_site_jobs_creator ON edm_site_message_jobs(user_id,created_by,created_at);
