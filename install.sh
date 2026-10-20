#!/bin/sh
set -eu

REPO="nebioudaniel/HULU_Code"
API="https://api.github.com/repos/${REPO}/releases/latest"
RAW="https://github.com/${REPO}/releases/latest/download"

os=$(uname -s)
arch=$(uname -m)

case "$os" in
  Darwin) os_name="darwin" ;;
  Linux) os_name="linux" ;;
  *) echo "Unsupported operating system: $os" >&2; exit 1 ;;
esac

case "$arch" in
  x86_64|amd64) arch_name="amd64" ;;
  arm64|aarch64) arch_name="arm64" ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

binary="hulucode_${os_name}_${arch_name}"
checksums="checksums.txt"

system=0
if [ "${1:-}" = "--system" ]; then
  system=1
fi

if [ "$system" -eq 1 ]; then
  dest="/usr/local/bin"
else
  dest="$HOME/.local/bin"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "${RAW}/${binary}" -o "$tmp/$binary"
curl -fsSL "${RAW}/checksums.txt" -o "$tmp/$checksums"

expected=$(grep " ${binary}\$" "$tmp/$checksums" | awk '{print $1}')
if [ -z "$expected" ]; then
  echo "Checksum entry not found for $binary" >&2
  exit 1
fi

actual=$(sha256sum "$tmp/$binary" | awk '{print $1}')
if [ "$actual" != "$expected" ]; then
  echo "Checksum verification failed" >&2
  exit 1
fi

mkdir -p "$dest"
cp "$tmp/$binary" "$dest/hulucode"
chmod +x "$dest/hulucode"

case ":$PATH:" in
  *":$dest:"*) ;;
  *) echo "Add $dest to your PATH" ;;
esac

echo "Installed hulucode to $dest/hulucode"