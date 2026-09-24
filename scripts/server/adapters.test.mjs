import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDatabase } from '../../src/server/sqlite.mjs';
import { LocalBucket } from '../../src/server/storage.mjs';
import { DurableQueue } from '../../src/server/queue.mjs';

test('SQLite preserves D1 returning, positional raw columns and atomic rollback',async()=>{
  const db=new LocalDatabase(':memory:');
  await db.exec('CREATE TABLE items(id INTEGER PRIMARY KEY,value TEXT UNIQUE)');
  const row=await db.prepare('INSERT INTO items(value) VALUES(?) RETURNING id').bind('one').first();
  assert.equal(row.id,1);
  await assert.rejects(db.batch([db.prepare('INSERT INTO items(value) VALUES(?)').bind('two'),db.prepare('INSERT INTO items(value) VALUES(?)').bind('one')]));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM items').first('n'),1);
  assert.deepEqual(await db.prepare('SELECT value,id FROM items').raw({columnNames:true}),[['value','id'],['one',1]]);
  assert.equal((await db.prepare('UPDATE items SET value=? WHERE id=1').bind('updated').run()).meta.changes,1);
  db.close();
});
test('durable queue defers messages, survives restart and records dead letters',async()=>{
  const root=await mkdtemp(join(tmpdir(),'wr-queue-'));let db=new LocalDatabase(join(root,'db.sqlite'));
  try {
    let queue=new DurableQueue(db,'test',{maxAttempts:2});
    await queue.send({id:1},{delaySeconds:60});
    assert.equal(await queue.process(()=>assert.fail('must not dispatch early')),false);
    db.close();db=new LocalDatabase(join(root,'db.sqlite'));queue=new DurableQueue(db,'test',{maxAttempts:2});
    assert.equal(await queue.process(async batch=>{assert.equal(batch.messages[0].body.id,1);batch.messages[0].retry({delaySeconds:60});},Date.now()+61000),true);
    assert.equal(await queue.process(()=>assert.fail('must respect retry delay')),false);
    await queue.process(async()=>{throw new Error('temporary');},Date.now()+61000);
    assert.equal(db.sqlite.prepare('SELECT state FROM server_queue').get().state,'dead');
    await queue.send({id:2});await queue.process(async b=>b.ackAll());
    assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM server_queue').get().n,1);
  }finally{db.close();await rm(root,{recursive:true,force:true});}
});
test('private bucket handles unsafe keys, ranges, metadata, multipart and restart',async()=>{
  const root=await mkdtemp(join(tmpdir(),'wr-storage-'));
  const db=new LocalDatabase(join(root,'db.sqlite'));
  try {
    const bucket=new LocalBucket(join(root,'objects'),db);
    await bucket.put('../../secret','0123456789',{httpMetadata:{contentType:'video/mp4'},customMetadata:{owner:'a'}});
    const part=await bucket.get('../../secret',{range:{offset:3,length:4}});
    assert.equal(await part.text(),'3456');
    const headers=new Headers();part.writeHttpMetadata(headers);assert.equal(headers.get('content-type'),'video/mp4');
    const upload=await bucket.createMultipartUpload('multi');
    const a=await upload.uploadPart(1,'first'),b=await upload.uploadPart(2,'second');
    await upload.complete([a,b]);
    const reopened=new LocalBucket(join(root,'objects'),db);
    assert.equal(await (await reopened.get('multi')).text(),'firstsecond');
    await reopened.delete('../../secret');assert.equal(await reopened.get('../../secret'),null);
    assert.equal((await reopened.list()).objects.length,1);
  } finally {db.close();await rm(root,{recursive:true,force:true});}
});
