#!/bin/sh
set -eu
# Browser/renderer may reach public Internet, never host/VPC/metadata services.
# Established connections back to the API are allowed; no new private connection.
iptables -N WR_COPY_EGRESS 2>/dev/null || true
iptables -F WR_COPY_EGRESS
iptables -A WR_COPY_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -N WR_COPY_INPUT 2>/dev/null || true
iptables -F WR_COPY_INPUT
iptables -A WR_COPY_INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for name in web-radar-server-browser-1 web-radar-server-builder-1; do
  ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$name")
  [ -n "$ip" ] || exit 1
  # Public generated assets are served through the HTTPS vhost; no other host port.
  iptables -A WR_COPY_EGRESS -s "$ip" -d 47.236.26.22/32 -p tcp --dport 443 -j RETURN
  iptables -A WR_COPY_INPUT -s "$ip" -p tcp --dport 443 -j RETURN
  iptables -A WR_COPY_INPUT -s "$ip" -j REJECT
  for destination in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 47.236.26.22/32; do
    iptables -A WR_COPY_EGRESS -s "$ip" -d "$destination" -j REJECT
  done
done
iptables -A WR_COPY_EGRESS -j RETURN
iptables -A WR_COPY_INPUT -j RETURN
iptables -C DOCKER-USER -j WR_COPY_EGRESS 2>/dev/null || iptables -I DOCKER-USER 1 -j WR_COPY_EGRESS
iptables -C INPUT -j WR_COPY_INPUT 2>/dev/null || iptables -I INPUT 1 -j WR_COPY_INPUT
