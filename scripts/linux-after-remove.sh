#!/bin/sh
# Remove ZeltaTV user data when the DEB package is removed.
# Runs as root during dpkg removal; only touches app-named directories.
set -e
for home in /home/* /root; do
    [ -d "$home" ] || continue
    rm -rf "$home/.config/ZeltaTV" \
           "$home/.config/zeltatv" \
           "$home/.local/share/ZeltaTV" \
           "$home/.local/share/zeltatv" \
           "$home/.cache/ZeltaTV" \
           "$home/.cache/zeltatv" 2>/dev/null || true
done
exit 0
