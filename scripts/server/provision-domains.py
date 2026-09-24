#!/usr/bin/env python3
"""Provision only explicitly bound server-site domains; run as root from systemd."""
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import subprocess
import time

DB = Path(os.environ.get('WR_DATABASE', '/srv/web-radar/data/app.sqlite3'))
VHOST = Path(os.environ.get('WR_VHOST', '/www/server/panel/vhost/nginx'))
WEBROOT = '/var/www/web-radar-acme'
NGINX = '/www/server/nginx/sbin/nginx'
CERTROOT = Path('/etc/letsencrypt/live')

def valid_host(host):
    return isinstance(host, str) and len(host) <= 253 and bool(re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', host))

def config(host, cert=None):
    if not valid_host(host):
        raise ValueError('Invalid hostname')
    http = f'''server {{
 listen 80;
 server_name {host};
 location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
 location / {{ return 301 https://$host$request_uri; }}
}}
'''
    if not cert:
        return http
    return http + f'''server {{
 listen 443 ssl;
 server_name {host};
 ssl_certificate {cert}/fullchain.pem;
 ssl_certificate_key {cert}/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 client_max_body_size 1m;
 location / {{
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_read_timeout 120s;
 }}
}}
'''

def run(*args):
    subprocess.run(args, check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def write_config(path, value):
    previous = path.read_text() if path.exists() else None
    tmp = path.with_suffix('.tmp')
    tmp.write_text(value)
    os.replace(tmp, path)
    try:
        run(NGINX, '-t')
        run(NGINX, '-s', 'reload')
    except Exception:
        if previous is None:
            path.unlink(missing_ok=True)
        else:
            path.write_text(previous)
        raise

def main():
    lock = open('/run/web-radar-domains.lock', 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    env = {}
    for line in Path('/etc/web-radar/server.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v.strip().strip('\"\'')
    ip = str(ipaddress.IPv4Address(env['SERVER_PUBLIC_IP']))
    # Open WAL/SHM as the API data owner, even if the API is restarting.
    owner = DB.stat().st_uid
    os.seteuid(owner)
    try:
        db = sqlite3.connect(DB, timeout=20)
        db.execute('CREATE TABLE IF NOT EXISTS server_domain_attempts(hostname TEXT PRIMARY KEY, tried_at INTEGER NOT NULL)')
    finally:
        os.seteuid(0)
    rows = db.execute('''SELECT d.hostname,d.project_id,d.status,p.data,r.data
      FROM project_domains d JOIN projects p ON p.id=d.project_id
      JOIN releases r ON r.id=json_extract(p.data,'$.publishedReleaseId') AND r.project_id=p.id''').fetchall()
    native = [(h, p, s) for h, p, s, project, release in rows
              if valid_host(h) and json.loads(release).get('hostingTarget', {}).get('provider') != 'cloudflare']
    owned = {'wr-site-'+hashlib.sha256(h.encode()).hexdigest()[:24]+'.conf' for h, _, _ in native}
    removed = []
    for file in VHOST.glob('wr-site-*.conf'):
        if file.name not in owned:
            file.unlink()
            removed.append(file.stem)
    if removed:
        run(NGINX, '-t')
        run(NGINX, '-s', 'reload')
        for name in removed:
            if (CERTROOT/name).exists():
                run('certbot', 'delete', '--cert-name', name, '--non-interactive')
    for host, project, status in native:
        if status not in ('pending_tls', 'tls_failed'):
            continue
        last = db.execute('SELECT tried_at FROM server_domain_attempts WHERE hostname=?', (host,)).fetchone()
        if last and time.time()-last[0] < 600:
            continue
        db.execute('INSERT OR REPLACE INTO server_domain_attempts VALUES (?,?)', (host, int(time.time())))
        db.commit()
        name = 'wr-site-'+hashlib.sha256(host.encode()).hexdigest()[:24]
        path = VHOST/(name+'.conf')
        dns_ready = False
        try:
            # HTTP-01 requires all public A records to reach this server.
            addresses = {r[4][0] for r in socket.getaddrinfo(host, 80, socket.AF_INET)}
            if addresses != {ip}:
                raise ValueError('DNS not ready')
            dns_ready = True
            if not (CERTROOT/name/'fullchain.pem').exists():
                write_config(path, config(host))
                run('certbot', 'certonly', '--webroot', '-w', WEBROOT, '-d', host,
                    '--cert-name', name, '--non-interactive', '--agree-tos', '--keep-until-expiring')
            # Recheck authorization after certificate acquisition, which can take time.
            binding = db.execute('SELECT 1 FROM project_domains WHERE hostname=? AND project_id=?', (host, project)).fetchone()
            if not binding:
                path.unlink(missing_ok=True)
                run(NGINX, '-t'); run(NGINX, '-s', 'reload')
                continue
            write_config(path, config(host, CERTROOT/name))
            db.execute("UPDATE project_domains SET status='active' WHERE hostname=? AND project_id=?", (host, project))
            print('HTTPS ready:', host, flush=True)
        except Exception as error:
            db.execute("UPDATE project_domains SET status=? WHERE hostname=? AND project_id=?", ('tls_failed' if dns_ready else 'pending_tls', host, project))
            if not dns_ready:
                db.execute("UPDATE server_domain_attempts SET tried_at=? WHERE hostname=?", (int(time.time())-540, host))
            print('HTTPS pending/retry:', host, type(error).__name__, flush=True)
        db.commit()
    db.close()

if __name__ == '__main__':
    main()
