#!/usr/bin/env bash
# Install the ops stack on a Linux node. Run by the owner, as root, ONLY after the owner approved the
# exact plan in docs/three-node-ops.md ("部署步骤"). Nothing here touches existing units,
# nginx, cloudflared, databases or release directories.
#
#   sudo bash install-linux-node.sh b  <bundle-dir>     # B: frps + visitor + agent + hub
#   sudo bash install-linux-node.sh hk <bundle-dir>     # A: agent + outbound frpc (read-only)
#   sudo bash install-linux-node.sh uninstall           # stop + disable + remove our units only
#
# <bundle-dir> is prepared on C: rendered TOML for this node, its pki/ files, agent.json, readers/tokens,
# and a copy of services/ops/opsnode. Secrets travel by scp, never through Git.
set -euo pipefail

FRP_VERSION=0.71.1
declare -A FRP_SHA256=(
  [amd64]=1d9875210972a5d1a62b2dc4c48df45ab0af05d3ca1b5e494a014428259df803
  [arm64]=8edf590b0c396fa42f9c147121a76af83cfc2002b08f5aef0ea1008c43482019
)
OPT=/opt/iridescently-ops
ETC=/etc/iridescently-ops
LOG=/var/log/iridescently-ops
UNITS_B=(iridescently-ops-frps iridescently-ops-visitor iridescently-ops-agent iridescently-ops-hub)
UNITS_HK=(iridescently-ops-agent iridescently-ops-frpc)

role=${1:?role b|hk|uninstall}
if [[ $role == uninstall ]]; then
  for u in "${UNITS_B[@]}" "${UNITS_HK[@]}"; do
    systemctl disable --now "$u.service" 2>/dev/null || true
    rm -f "/etc/systemd/system/$u.service"
  done
  systemctl daemon-reload
  echo "units removed; $ETC and $OPT kept for inspection (remove by hand when no longer needed)"
  exit 0
fi
bundle=${2:?bundle dir}
[[ $role == b || $role == hk ]] || { echo "role must be b or hk"; exit 2; }

arch=$(dpkg --print-architecture 2>/dev/null || uname -m)
case $arch in x86_64) arch=amd64;; aarch64) arch=arm64;; esac
[[ -n ${FRP_SHA256[$arch]:-} ]] || { echo "unsupported arch $arch"; exit 2; }

id iridescently-ops >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin iridescently-ops
install -d -m 0755 "$OPT" "$OPT/frp" "$OPT/services/ops"
install -d -m 0750 -o root -g iridescently-ops "$ETC" "$ETC/frp" "$ETC/frp/pki" "$ETC/tokens"
install -d -m 0750 -o iridescently-ops -g iridescently-ops "$LOG"

# Official release, verified against the pinned checksum from the v$FRP_VERSION release page.
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
tgz="frp_${FRP_VERSION}_linux_${arch}.tar.gz"
curl -fsSL -o "$tmp/$tgz" "https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/$tgz"
echo "${FRP_SHA256[$arch]}  $tmp/$tgz" | sha256sum -c -
tar -xzf "$tmp/$tgz" -C "$tmp"
install -m 0755 "$tmp/frp_${FRP_VERSION}_linux_${arch}/frpc" "$OPT/frp/frpc"
[[ $role == b ]] && install -m 0755 "$tmp/frp_${FRP_VERSION}_linux_${arch}/frps" "$OPT/frp/frps"

cp -r "$bundle/opsnode" "$OPT/services/ops/"
install -m 0640 -o root -g iridescently-ops "$bundle"/pki/* "$ETC/frp/pki/"
install -m 0640 -o root -g iridescently-ops "$bundle"/agent.json "$bundle"/agent-readers.json "$ETC/"
install -m 0640 -o root -g iridescently-ops "$bundle"/frpc-admin-password.txt "$ETC/frp/"
if [[ $role == b ]]; then
  install -m 0640 -o root -g iridescently-ops "$bundle"/frps.toml "$bundle"/frpc-b-visitor.toml \
    "$bundle"/frps-dashboard-password.txt "$ETC/frp/"
  install -m 0640 -o root -g iridescently-ops "$bundle"/hub.json "$bundle"/hub-readers.json "$ETC/"
  install -m 0640 -o root -g iridescently-ops "$bundle"/tokens/* "$ETC/tokens/"
  "$OPT/frp/frps" verify -c "$ETC/frp/frps.toml"
  "$OPT/frp/frpc" verify -c "$ETC/frp/frpc-b-visitor.toml"
  units=("${UNITS_B[@]}")
else
  install -m 0640 -o root -g iridescently-ops "$bundle"/frpc-hk.toml "$ETC/frp/"
  "$OPT/frp/frpc" verify -c "$ETC/frp/frpc-hk.toml"
  # No sudoers entry: the agent reads release state as its own user (opsnode/hkrelease.py) and never
  # calls iridescently-control, which is a forced-command tool with write paths.
  units=("${UNITS_HK[@]}")
fi
for u in "${units[@]}"; do install -m 0644 "$bundle/systemd/$u.service" /etc/systemd/system/; done
systemctl daemon-reload
for u in "${units[@]}"; do systemctl enable --now "$u.service"; done
sleep 3
systemctl --no-pager --lines=5 status "${units[@]/%/.service}" || true
echo "installed role=$role. Listening sockets owned by our user:"
ss -ltnp | grep -E 'frps|frpc|python3' || true
