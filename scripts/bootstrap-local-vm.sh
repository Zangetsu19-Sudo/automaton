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
  chromium-browser 2>/dev/null || \
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  openssh-server \
  python3 \
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
