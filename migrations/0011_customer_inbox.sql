CREATE TABLE wr_inbox_configs (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, domain TEXT NOT NULL UNIQUE,
 forward_to TEXT NOT NULL, secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 track_edm INTEGER NOT NULL DEFAULT 1, track_sites INTEGER NOT NULL DEFAULT 1,
 team_body INTEGER NOT NULL DEFAULT 0, verified_at TEXT, last_received_at TEXT,
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX wr_inbox_active ON wr_inbox_configs(workspace_id) WHERE enabled=1;
CREATE TABLE wr_inbox_routes (
 id TEXT PRIMARY KEY, config_id TEXT NOT NULL, workspace_id TEXT NOT NULL, owner_id TEXT,
 source TEXT NOT NULL CHECK(source IN ('edm','site')), business_id TEXT NOT NULL,
 target_id TEXT NOT NULL, address TEXT NOT NULL UNIQUE, original_email TEXT,
 website_url TEXT, subject TEXT, snapshot TEXT, provider_message_id TEXT, rfc_message_id TEXT,
 created_at TEXT NOT NULL, UNIQUE(source,target_id)
);
CREATE INDEX wr_inbox_routes_business ON wr_inbox_routes(workspace_id,source,business_id);
CREATE INDEX wr_inbox_routes_message ON wr_inbox_routes(config_id,rfc_message_id);
CREATE TABLE wr_inbox_threads (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, config_id TEXT NOT NULL,
 route_id TEXT, owner_id TEXT, assignee_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
 subject TEXT NOT NULL, last_received_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX wr_inbox_route_thread ON wr_inbox_threads(route_id) WHERE route_id IS NOT NULL;
CREATE INDEX wr_inbox_thread_scope ON wr_inbox_threads(workspace_id,owner_id,last_received_at);
CREATE TABLE wr_inbox_messages (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, config_id TEXT NOT NULL, thread_id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL, message_id TEXT, in_reply_to TEXT, references_header TEXT,
 sender TEXT NOT NULL, envelope_from TEXT, recipient TEXT NOT NULL, to_header TEXT,
 subject TEXT NOT NULL, text_body TEXT NOT NULL, raw_key TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]',
 kind TEXT NOT NULL DEFAULT 'unknown', match_method TEXT NOT NULL DEFAULT 'unmatched',
 forward_to TEXT, forward_status TEXT, received_at TEXT NOT NULL,
 UNIQUE(config_id,dedupe_key)
);
CREATE INDEX wr_inbox_message_thread ON wr_inbox_messages(thread_id,received_at);
CREATE INDEX wr_inbox_message_header ON wr_inbox_messages(config_id,message_id);
CREATE TABLE wr_inbox_reads (
 thread_id TEXT NOT NULL,user_id TEXT NOT NULL,last_read_at TEXT NOT NULL,PRIMARY KEY(thread_id,user_id)
);
CREATE TABLE wr_inbox_audit (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,thread_id TEXT,actor_id TEXT NOT NULL,
 action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL
);
ALTER TABLE edm_campaigns ADD COLUMN reply_tracking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE edm_site_message_jobs ADD COLUMN reply_tracking INTEGER NOT NULL DEFAULT 0;
