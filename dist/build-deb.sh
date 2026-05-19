#!/bin/bash
set -e
DIR="$(dirname "$(readlink -f "$0")")"
cd "$DIR/.."
PKG="aihub-for-linux"
VER="0.2.1"

rm -rf "/tmp/${PKG}-${VER}"
mkdir -p "/tmp/${PKG}-${VER}/DEBIAN"
mkdir -p "/tmp/${PKG}-${VER}/usr/bin"
mkdir -p "/tmp/${PKG}-${VER}/usr/share/applications"
mkdir -p "/tmp/${PKG}-${VER}/usr/share/doc/${PKG}"

install -m 755 app.py "/tmp/${PKG}-${VER}/usr/bin/${PKG}"

cat > "/tmp/${PKG}-${VER}/usr/share/applications/${PKG}.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=AI Hub for Linux
Comment=Unified AI assistant desktop application
Exec=${PKG}
Icon=${PKG}
Categories=Utility;Network;AI;
Terminal=false
DESKTOP_EOF

cp dist/debian/copyright "/tmp/${PKG}-${VER}/usr/share/doc/${PKG}/copyright"
cp README.md "/tmp/${PKG}-${VER}/usr/share/doc/${PKG}/"

cat > "/tmp/${PKG}-${VER}/DEBIAN/control" << CTRL_EOF
Package: ${PKG}
Version: ${VER}-1
Section: utils
Priority: optional
Architecture: all
Maintainer: Daskashk <daskashk@users.noreply.github.com>
Depends: python3 (>= 3.10), python3-gi (>= 3.30), python3-gi-cairo,
         gir1.2-gtk-3.0 (>= 3.20), gir1.2-webkit2-4.1 (>= 2.40)
Description: Unify 65+ AI assistants in a single native Linux desktop app.
 Native GTK3 + WebKitGTK application providing a unified interface for
 ChatGPT, Claude, Gemini, and 65+ AI services. Features include domain-level
 privacy blocking, custom JS/CSS injection, proxy support, and a remotely
 updated service catalog.
CTRL_EOF

fakeroot dpkg-deb --build "/tmp/${PKG}-${VER}" "dist/${PKG}_${VER}-1_all.deb"
rm -rf "/tmp/${PKG}-${VER}"
echo "DEB package created: dist/${PKG}_${VER}-1_all.deb"
