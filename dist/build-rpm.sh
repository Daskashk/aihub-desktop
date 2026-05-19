#!/bin/bash
set -e
DIR="$(dirname "$(readlink -f "$0")")"
cd "$DIR/.."
PKG="aihub-for-linux"
VER="0.2.0"

rpmbuild -bb \
  --define "_topdir $(pwd)/rpmbuild" \
  --define "_sourcedir $(pwd)" \
  --define "_rpmdir $(pwd)/dist" \
  dist/aihub-for-linux.spec

echo "RPM package created in dist/"
