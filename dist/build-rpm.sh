#!/bin/bash
set -e
DIR="$(dirname "$(readlink -f "$0")")"
cd "$DIR/.."
PKG="aihub-for-linux"
VER="0.2.0"

rm -rf rpmbuild
mkdir -p rpmbuild/SOURCES rpmbuild/SPECS rpmbuild/BUILD rpmbuild/RPMS rpmbuild/SRPMS

git archive --format=tar.gz --prefix="${PKG}-${VER}/" -o "rpmbuild/SOURCES/${PKG}-${VER}.tar.gz" HEAD
cp "dist/${PKG}.spec" "rpmbuild/SPECS/${PKG}.spec"

rpmbuild -bb --nodeps \
  --define "_topdir $(pwd)/rpmbuild" \
  --define "_sourcedir $(pwd)/rpmbuild/SOURCES" \
  --define "_specdir $(pwd)/rpmbuild/SPECS" \
  --define "_rpmdir $(pwd)/dist" \
  --define "_srcrpmdir $(pwd)/rpmbuild/SRPMS" \
  --define "_builddir $(pwd)/rpmbuild/BUILD" \
  "rpmbuild/SPECS/${PKG}.spec"

rm -rf "$(pwd)/rpmbuild"
echo "RPM package created in dist/"
