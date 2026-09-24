import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';

// Keys never become filesystem paths. Immutable bodies are addressed by hash;
// the SQLite metadata pointer changes only after an atomic file rename.
export class LocalBucket {
  constructor(root, db) {
    Object.assign(this, { root, db });
    db.sqlite.exec('CREATE TABLE IF NOT EXISTS server_objects(key TEXT PRIMARY KEY, metadata TEXT NOT NULL)');
  }
  path(hash) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid object hash');
    return join(this.root, hash.slice(0, 2), hash);
  }
  async put(key, value, options = {}) {
    const bytes = Buffer.from(await new Response(value).arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024) throw new Error('Object too large');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const path = this.path(hash), temp = path + '.' + randomUUID();
    await mkdir(join(this.root, hash.slice(0, 2)), { recursive: true });
    await writeFile(temp, bytes, { mode: 0o600 });
    await rename(temp, path);
    const metadata = { key, hash, size: bytes.length, etag: hash, uploaded: new Date().toISOString(), version: randomUUID(), httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} };
    this.db.sqlite.prepare('INSERT INTO server_objects VALUES(?,?) ON CONFLICT(key) DO UPDATE SET metadata=excluded.metadata').run(key, JSON.stringify(metadata));
    return this.object(metadata);
  }
  object(metadata, range) {
    const result = { ...metadata, uploaded: new Date(metadata.uploaded), httpEtag: '"' + metadata.etag + '"', checksums: {},
      writeHttpMetadata(headers) {
        for (const [key, value] of Object.entries(metadata.httpMetadata || {})) {
          const name = { contentType:'Content-Type', contentLanguage:'Content-Language', contentDisposition:'Content-Disposition', contentEncoding:'Content-Encoding', cacheControl:'Cache-Control', cacheExpiry:'Expires' }[key];
          if (name && value) headers.set(name, String(value));
        }
      }
    };
    if (range !== undefined) {
      let start = range?.offset ?? (range?.suffix ? Math.max(0, metadata.size - range.suffix) : 0);
      let end = Math.min(metadata.size - 1, range?.length ? start + range.length - 1 : metadata.size - 1);
      if (metadata.size && (start < 0 || end < start || start >= metadata.size)) throw new RangeError('Invalid object range');
      const body = metadata.size ? Readable.toWeb(createReadStream(this.path(metadata.hash), { start, end })) : new ReadableStream({start(c){c.close();}});
      const response = new Response(body);
      Object.defineProperty(result,'bodyUsed',{get:()=>response.bodyUsed});
      Object.assign(result, { body, range: range ? {offset:start,length:end-start+1} : undefined,
        arrayBuffer: () => response.arrayBuffer(), text: () => response.text(), json: () => response.json(), blob: () => response.blob() });
    }
    return result;
  }
  async head(key) {
    const row = this.db.sqlite.prepare('SELECT metadata FROM server_objects WHERE key=?').get(key);
    return row ? this.object(JSON.parse(row.metadata)) : null;
  }
  async get(key, options) {
    const row = this.db.sqlite.prepare('SELECT metadata FROM server_objects WHERE key=?').get(key);
    return row ? this.object(JSON.parse(row.metadata), options?.range ?? null) : null;
  }
  async delete(keys) {
    // Immutable bodies are retained for backup/GC; deletion removes visibility immediately.
    for (const key of Array.isArray(keys) ? keys : [keys]) this.db.sqlite.prepare('DELETE FROM server_objects WHERE key=?').run(key);
  }
  async list(options = {}) {
    const limit = Math.min(options.limit || 1000, 1000);
    const rows = this.db.sqlite.prepare('SELECT key,metadata FROM server_objects WHERE substr(key,1,?)=? AND key>? ORDER BY key LIMIT ?').all((options.prefix || '').length, options.prefix || '', options.cursor || '', limit + 1);
    const truncated = rows.length > limit;
    return { objects: rows.slice(0, limit).map(r => this.object(JSON.parse(r.metadata))), truncated, cursor: truncated ? rows[limit-1].key : undefined, delimitedPrefixes: [] };
  }
  async createMultipartUpload(key, options) {
    const directory = join(this.root, '.multipart', randomUUID());
    await mkdir(directory, {recursive:true});
    const parts = new Map();
    return { key, uploadId: directory.split('/').pop(),
      uploadPart: async (number, data) => {
        if (!Number.isInteger(number) || number < 1 || number > 10000) throw new Error('Invalid part');
        const bytes = Buffer.from(await new Response(data).arrayBuffer());
        const etag = createHash('sha256').update(bytes).digest('hex');
        await writeFile(join(directory,String(number)),bytes,{mode:0o600});
        parts.set(number,etag);
        return {partNumber:number,etag};
      },
      complete: async entries => {
        try {
          const chunks=[];
          for(const part of entries) {
            if(parts.get(part.partNumber)!==part.etag) throw new Error('Invalid part ETag');
            chunks.push(await readFile(join(directory,String(part.partNumber))));
          }
          return await this.put(key,Buffer.concat(chunks),options);
        } finally { await rm(directory,{recursive:true,force:true}); }
      },
      abort: () => rm(directory,{recursive:true,force:true})
    };
  }
}
