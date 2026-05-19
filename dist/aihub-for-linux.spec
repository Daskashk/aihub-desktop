%global __requires_exclude ^(python-gi|python3-gi|gir1\\.2-gtk|gir1\\.2-webkit2)

Name:      aihub-for-linux
Version:   0.2.1
Release:   1%{?dist}
Summary:   Unify 65+ AI assistants in a single native Linux desktop app

License:   GPL-3.0-or-later
URL:       https://github.com/Daskashk/aihub-desktop
Source0:   %{name}-%{version}.tar.gz

BuildArch: noarch

BuildRequires: python3-devel
BuildRequires: python3-gobject-base

Requires:  python3
Requires:  python3-gobject
Requires:  python3-gi-cairo
Requires:  gtk3 >= 3.20
Requires:  webkit2gtk4.1 >= 2.40

%description
A lightweight, privacy-focused desktop application that brings 65+ AI
assistants together in a single tabbed interface. Built with Python/GTK3
and WebKitGTK — no Electron, no Chromium, no bundled web engine.

Features domain-level privacy blocking, custom JS/CSS injection, HTTP/SOCKS5
proxy support, auto-updating service catalog, and a native GTK settings
interface with General, Network, Services, Injection, and About tabs.

%prep
%setup -q

%build
# pure Python — no build step

%install
mkdir -p %{buildroot}%{_bindir}
install -m 755 app.py %{buildroot}%{_bindir}/aihub-for-linux

mkdir -p %{buildroot}%{_datadir}/applications
cat > %{buildroot}%{_datadir}/applications/aihub-for-linux.desktop << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=AI Hub for Linux
Comment=Unified AI assistant desktop application
Exec=aihub-for-linux
Icon=aihub-for-linux
Categories=Utility;Network;AI;
Terminal=false
DESKTOP_EOF

%files
%{_bindir}/aihub-for-linux
%{_datadir}/applications/aihub-for-linux.desktop

%changelog
* Mon May 18 2026 Daskashk <daskashk@users.noreply.github.com> - 0.1.0-1
- Initial release: native Python/GTK/WebKitGTK application
