#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a dedicated Linux guest for Automaton VM isolation.
# Run inside a fresh Debian/Ubuntu VM as root.
# The script intentionally does NOT copy host credentials into the guest.

AUTOMATON_USER="${AUTOMATON_USER:-automaton}"
AUTOMATON_HOME="/home/${AUTOMATON_USER}"
WORKSPACE="${AUTOMATON_WORKSPACE:-${AUTOMATON_HOME}/workspace}"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap currently supports Debian/Ubuntu guests (apt-get required)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  openssh-server \
  python3 \
  squid \
  chromium-browser 2>/dev/null || \
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  openssh-server \
  python3 \
  squid \
  chromium

if ! id "${AUTOMATON_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${AUTOMATON_USER}"
fi

install -d -m 0700 -o "${AUTOMATON_USER}" -g "${AUTOMATON_USER}" "${WORKSPACE}"
install -d -m 0700 -o "${AUTOMATON_USER}" -g "${AUTOMATON_USER}" "${AUTOMATON_HOME}/.ssh"
install -d -m 0700 -o "${AUTOMATON_USER}" -g "${AUTOMATON_USER}" "${AUTOMATON_HOME}/browser-profile"

# Disable password auth for the dedicated user. Add the public SSH key manually
# after reviewing it; never copy a private key into this guest.
cat >/etc/ssh/sshd_config.d/99-automaton.conf <<EOF
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers ${AUTOMATON_USER}
EOF

systemctl enable ssh
systemctl restart ssh

# Browser egress proxy: Chromium is forced through this localhost-only proxy.
# Squid resolves destinations itself and denies private/link-local/loopback
# addresses, so redirects to local infrastructure are blocked too.
cat >/etc/squid/squid.conf <<'SQUID'
http_port 127.0.0.1:3128

acl localhost src 127.0.0.1/32 ::1
acl private_dst dst 0.0.0.0/8
acl private_dst dst 10.0.0.0/8
acl private_dst dst 100.64.0.0/10
acl private_dst dst 127.0.0.0/8
acl private_dst dst 169.254.0.0/16
acl private_dst dst 172.16.0.0/12
acl private_dst dst 192.0.0.0/24
acl private_dst dst 192.168.0.0/16
acl private_dst dst 198.18.0.0/15
acl private_dst dst 224.0.0.0/4
acl private_dst dst 240.0.0.0/4
acl private_dst dst ::1/128
acl private_dst dst fc00::/7
acl private_dst dst fe80::/10

http_access deny private_dst
http_access allow localhost
http_access deny all

cache deny all
access_log none
cache_log /var/log/squid/cache.log
SQUID

systemctl enable squid
systemctl restart squid

cat <<EOF

Automaton VM guest bootstrap complete.

Next:
1. Put ONLY the public SSH key in:
   ${AUTOMATON_HOME}/.ssh/authorized_keys
2. chown it to ${AUTOMATON_USER}:${AUTOMATON_USER} and chmod 600.
3. From the host, connect once manually and verify the SSH host fingerprint.
4. Add that fingerprint to the host known_hosts file.
5. Configure Automaton with localIsolation="vm".

Workspace: ${WORKSPACE}
User:      ${AUTOMATON_USER}

The host-side Automaton keeps the private SSH key; this guest never receives it.
EOF
