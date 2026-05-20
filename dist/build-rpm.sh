#!/bin/bash
set -e
DIR="$(dirname "$(readlink -f "$0")")"
cd "$DIR/.."
PKG="aihub-for-linux"
VER="0.2.1"

rm -rf rpmbuild
mkdir -p rpmbuild/BUILD rpmbuild/RPMS rpmbuild/SRPMS rpmbuild/SPECS rpmbuild/SOURCES

cat > "rpmbuild/SPECS/${PKG}.spec" << SPEC_EOF
%global __requires_exclude ^(python-gi|python3-gi|gir1\\.2-gtk|gir1\\.2-webkit2)

Name:      ${PKG}
Version:   ${VER}
Release:   1%{?dist}
Summary:   Unify 65+ AI assistants in a single native Linux desktop app
License:   GPL-3.0-or-later
URL:       https://github.com/Daskashk/aihub-for-linux
BuildArch: noarch
AutoReqProv: no

Requires:  python3
Requires:  python3-gobject
Requires:  python3-gi-cairo
Requires:  gtk3 >= 3.20
Requires:  webkit2gtk4.1 >= 2.40

%description
AI Hub for Linux - Native GTK3 + WebKitGTK application.
Unify 65+ AI assistants in a single native Linux desktop app.

%prep
# no-op: pure Python, no compilation, no tarball extraction

%build
# no-op

%install
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/512x512/apps
mkdir -p %{buildroot}%{_datadir}/pixmaps

install -m 755 ${PWD}/app.py %{buildroot}%{_bindir}/${PKG}
install -m 644 ${PWD}/icon.png %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/${PKG}.png
install -m 644 ${PWD}/icon.png %{buildroot}%{_datadir}/pixmaps/${PKG}.png

cat > %{buildroot}%{_datadir}/applications/${PKG}.desktop << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=AI Hub for Linux
Comment=Unified AI assistant desktop application
Exec=${PKG}
Icon=${PKG}
Categories=Utility;Network;AI;
Terminal=false
DESKTOP_EOF

%files
%{_bindir}/${PKG}
%{_datadir}/applications/${PKG}.desktop
%{_datadir}/icons/hicolor/512x512/apps/${PKG}.png
%{_datadir}/pixmaps/${PKG}.png
SPEC_EOF

rpmbuild -bb --nodeps \
  --define "_topdir $(pwd)/rpmbuild" \
  --define "_rpmdir $(pwd)/dist" \
  --define "_rpmfilename %{NAME}-%{VERSION}-%{RELEASE}.%{ARCH}.rpm" \
  --define "_builddir $(pwd)/rpmbuild/BUILD" \
  --define "_specdir $(pwd)/rpmbuild/SPECS" \
  --define "_sourcedir $(pwd)/rpmbuild/SOURCES" \
  --define "_srcrpmdir $(pwd)/rpmbuild/SRPMS" \
  --define "_buildrootdir $(pwd)/rpmbuild/BUILDROOT" \
  "rpmbuild/SPECS/${PKG}.spec"

rm -rf "$(pwd)/rpmbuild"
echo "RPM package created in dist/"
