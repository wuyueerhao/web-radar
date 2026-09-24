import { randomUUID } from 'node:crypto';

// A single-server durable queue. The business send-attempt/idempotency tables
// remain authoritative when a process dies after an external provider accepted.
export class DurableQueue {
  constructor(db,name,{maxAttempts=3,leaseMs=1800000}={}) {
    Object.assign(this,{db,name,maxAttempts,leaseMs});this.active=false;
    db.sqlite.exec(`CREATE TABLE IF NOT EXISTS server_queue (
      id TEXT PRIMARY KEY,queue TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,
      available INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'waiting');
      CREATE INDEX IF NOT EXISTS server_queue_ready ON server_queue(queue,state,available,lease);`);
  }
  async send(body,options={}) {
    const now=Date.now();
    this.db.sqlite.prepare('INSERT INTO server_queue(id,queue,body,created,available) VALUES(?,?,?,?,?)').run(randomUUID(),this.name,JSON.stringify(body),now,now+Math.max(0,Number(options.delaySeconds)||0)*1000);
  }
  async sendBatch(entries) {
    this.db.sqlite.exec('BEGIN IMMEDIATE');
    try {
      for(const item of entries) {
        const now=Date.now();
        this.db.sqlite.prepare('INSERT INTO server_queue(id,queue,body,created,available) VALUES(?,?,?,?,?)').run(randomUUID(),this.name,JSON.stringify(item.body),now,now+Math.max(0,Number(item.delaySeconds)||0)*1000);
      }
      this.db.sqlite.exec('COMMIT');
    }catch(error){this.db.sqlite.exec('ROLLBACK');throw error;}
  }
  async process(handler,now=Date.now()) {
    if(this.active)return false;
    const row=this.db.sqlite.prepare(`UPDATE server_queue SET lease=?,attempts=attempts+1 WHERE id=(
      SELECT id FROM server_queue WHERE queue=? AND state='waiting' AND available<=? AND lease<=? ORDER BY available,created LIMIT 1) RETURNING *`).get(now+this.leaseMs,this.name,now,now);
    if(!row)return false;
    this.active=true;
    const keepAlive=setInterval(()=>this.db.sqlite.prepare('UPDATE server_queue SET lease=? WHERE id=?').run(Date.now()+this.leaseMs,row.id),Math.max(1000,this.leaseMs/3));
    let disposition='ack',delay=30;
    const message={id:row.id,timestamp:new Date(row.created),body:JSON.parse(row.body),attempts:row.attempts,
      ack(){disposition='ack';},retry(options={}){disposition='retry';delay=Math.max(1,Number(options.delaySeconds)||30);}};
    try {
      await handler({queue:this.name,messages:[message],ackAll:()=>message.ack(),retryAll:options=>message.retry(options)});
    }catch{disposition='retry';}
    finally {
      clearInterval(keepAlive);
      if(disposition==='ack')this.db.sqlite.prepare('DELETE FROM server_queue WHERE id=?').run(row.id);
      else if(row.attempts>=this.maxAttempts) {
        if(this.name==='web-radar-edm-email')this.db.sqlite.prepare("UPDATE server_queue SET queue='web-radar-edm-email-dlq',attempts=0,available=?,lease=0 WHERE id=?").run(Date.now()+delay*1000,row.id);
        else this.db.sqlite.prepare("UPDATE server_queue SET state='dead',lease=0 WHERE id=?").run(row.id);
      } else this.db.sqlite.prepare('UPDATE server_queue SET available=?,lease=0 WHERE id=?').run(Date.now()+delay*1000,row.id);
      this.active=false;
    }
    return true;
  }
}
