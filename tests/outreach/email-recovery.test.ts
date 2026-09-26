import {d1} from './sqlite';
import { seal } from "../../src/outreach/server/lib/credentials";
vi.mock("../../src/outreach/server/lib/network",()=>({publicFetch:(...args:any[])=>globalThis.fetch(args[0],args[1])}));
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleEmailQueue, type EmailSendMessage } from "../../src/outreach/server/queues/email-send.queue";

test("recovery skips sent mail, reconciles provider records, quarantines unknown outcomes, sends untouched only once", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0007_outreach.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0011_customer_inbox.sql","utf8"));
  for(const file of ['0008_resend_tracking.sql','0009_email_scheduling.sql']) sqlite.exec(readFileSync('migrations/'+file,'utf8'));
  sqlite.exec(`INSERT INTO edm_users(id,name,email,created_at,updated_at) VALUES ('u','test','u@example.com',0,0);
    INSERT INTO edm_providers(id,user_id,provider,name,api_key,is_default,created_at,updated_at) VALUES ('p','u','mailchimp','test','fake-key',1,0,0);
    INSERT INTO edm_campaigns(id,user_id,name,sender_email,sender_name,status,created_at,updated_at) VALUES ('campaign','u','test','from@example.com','test','sending',0,0);`);
  const env:any={CREDENTIAL_KEY:"test-key",BETTER_AUTH_SECRET:"test-secret",BETTER_AUTH_URL:"https://example.com"};
  sqlite.prepare("UPDATE edm_providers SET api_key=?").run(await seal("fake-key","p",env));
  const ids = ["sent", "found", "unknown", "untouched"];
  for (const id of ids) {
    sqlite.prepare("INSERT INTO edm_contacts(id,user_id,email,created_at,updated_at) VALUES (?,'u',?,0,0)").run(id, `${id}@example.com`);
    sqlite.prepare("INSERT INTO edm_campaign_recipients(id,campaign_id,contact_id,status,error_message,created_at) VALUES (?,'campaign',?,?,?,0)")
      .run(id, id, id === "sent" ? "sent" : "sending", ["found", "unknown"].includes(id) ? "Mailchimp response status=200" : null);
  }
  const db = d1(sqlite);
  const oldFetch = globalThis.fetch;
  const sent: string[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    if (String(url).endsWith("/messages/search")) return Response.json([{ email: "found@example.com", _id: "reconciled", state: "sent", ts: 1789092000 }]);
    assert.ok(String(url).endsWith("/messages/send"));
    sent.push(JSON.parse(init.body).message.to[0].email);
    return Response.json([{ _id: "new-message", status: "sent" }]);
  };
  const messages = ids.map((id) => ({ body: { recipientId: id, campaignId: "campaign", providerId: "p", toEmail: `${id}@example.com`, toName: "test", fromEmail: "from@example.com", fromName: "test", replyTo: null, subject: "Hello", bodyHtml: "<p>Hello</p>", bodyText: "Hello", variables: {} } satisfies EmailSendMessage, ack() {}, retry() { throw new Error("Unexpected retry"); } }));
  try {
    await handleEmailQueue({ messages, recovery: true }, { ...env, DB: db, BETTER_AUTH_URL: "https://example.com", BETTER_AUTH_SECRET: "test-secret" });
    assert.deepEqual(sent, ["untouched@example.com"]);
    assert.equal(sqlite.prepare("SELECT status FROM edm_campaign_recipients WHERE id='found'").get()!.status, "sent");
    assert.match(String(sqlite.prepare("SELECT error_message FROM edm_campaign_recipients WHERE id='unknown'").get()!.error_message), /待核实/);
    await handleEmailQueue({ messages: [messages[3]], recovery: true }, { ...env, DB: db });
    assert.equal(sent.length, 1);
    sqlite.exec("UPDATE edm_campaigns SET status='sending'; INSERT INTO edm_contacts(id,user_id,email,created_at,updated_at) VALUES ('auth','u','auth@example.com',0,0); INSERT INTO edm_campaign_recipients(id,campaign_id,contact_id,status,created_at) VALUES ('auth','campaign','auth','sending',0)");
    globalThis.fetch = async () => Response.json({ name: "Invalid_Key", message: "Invalid API key" }, { status: 401 });
    sqlite.exec('UPDATE edm_email_clocks SET next_at=0');
    let retries = 0;
    await handleEmailQueue({ messages: [{ body: { ...messages[3].body, recipientId: "auth", toEmail: "auth@example.com" }, ack() {}, retry() { retries++; } }], recovery: true }, { ...env, DB: db, BETTER_AUTH_URL: "https://example.com", BETTER_AUTH_SECRET: "test-secret" });
    assert.equal(retries, 1);
    assert.equal(sqlite.prepare("SELECT status FROM edm_campaigns").get()!.status, "paused");
    assert.equal(sqlite.prepare("SELECT status FROM edm_campaign_recipients WHERE id='auth'").get()!.status, "queued");
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM edm_email_send_attempts WHERE recipient_id='auth'").get()!.n, 0);
  } finally { globalThis.fetch = oldFetch; sqlite.close(); }
});
