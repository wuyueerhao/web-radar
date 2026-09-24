import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { currentPrincipal } from '../../src/worker/product-radar';
import { mintSession } from '../../src/worker/auth';
// @ts-ignore Node adapter
import { LocalDatabase } from '../../src/server/sqlite.mjs';
const [database,envPath,tokenPath]=process.argv.slice(2);
if(!database||!envPath)throw new Error('Usage: check-auth database protected-env [protected-token-output]');
const env={...parseEnv(readFileSync(envPath,'utf8')),DB:new LocalDatabase(database)} as any;
const row=await env.DB.prepare('SELECT owner_id,workspace_id FROM projects ORDER BY id LIMIT 1').first();
const principal=await currentPrincipal(env,{userId:row.owner_id,workspaceId:row.workspace_id} as any);
console.log('Original identity service verified; workspace role:',principal.workspaceRole);
if(tokenPath){
  const session=await mintSession(env,principal);
  writeFileSync(tokenPath,session.token,{mode:0o600});
  // Deployment acceptance session expires in 15 minutes and is deleted after checks.
  env.DB.sqlite.prepare('UPDATE sessions SET expires_at=MIN(expires_at,?) WHERE token_hash=?').run(Date.now()+15*60*1000,createHash('sha256').update(session.token).digest('hex'));
  console.log('Short-lived acceptance session written to protected file');
}
env.DB.close();
