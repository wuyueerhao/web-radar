#!/bin/sh
set -eu
umask 077
base=/srv/web-radar/backups
stage=$(mktemp -d "$base/.snapshot.XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
sqlite3 /srv/web-radar/data/app.sqlite3 ".backup '$stage/app.sqlite3'"
if [ -f /srv/web-radar/builder/builds.sqlite3 ]; then
  sqlite3 /srv/web-radar/builder/builds.sqlite3 ".backup '$stage/builds.sqlite3'"
fi
archive="$base/$(date -u +%Y%m%dT%H%M%SZ).tar.gz.enc"
# Immutable object bodies may be copied after the database snapshot safely.
tar -czf "$stage/snapshot.tar.gz" -C "$stage" app.sqlite3 $(test ! -f "$stage/builds.sqlite3" || printf builds.sqlite3) -C /srv/web-radar/data media -C /etc web-radar
openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:/etc/web-radar/backup.key -in "$stage/snapshot.tar.gz" -out "$archive"
sha256sum "$archive" > "$archive.sha256"
printf 'Backup created: %s\n' "$archive"

# Retain two weeks of successful daily archives; preserve the initial snapshot.
find "$base" -maxdepth 1 -type f \( -name "????????T??????Z.tar.gz.enc" -o -name "????????T??????Z.tar.gz.enc.sha256" \) -mtime +14 -delete
