#!/usr/bin/env python3
"""AI Hub Desktop - Modern GTK UI + WebKitGTK services"""

import os, sys, json, threading, urllib.request, urllib.error, re, warnings
from urllib.parse import urlparse
from datetime import datetime, timezone

os.environ.setdefault('WEBKIT_DISABLE_COMPOSITING_MODE', '1')

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib, Gdk, Pango, Gio, GObject, GdkPixbuf
warnings.filterwarnings('ignore', category=DeprecationWarning, module='gi')

APP_ID = 'com.aihub.desktop'
BASE = os.path.dirname(os.path.abspath(__file__))
CFG_DIR = os.path.join(os.path.expanduser('~'), '.config', 'aihub-desktop')
DATA_DIR = os.path.join(CFG_DIR, 'data')
USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
LOWERCASE_RE = re.compile(r'[^a-z0-9-]')
WHITESPACE_RE = re.compile(r'\s+')
COLOR_RE = re.compile(r'^[0-9A-Fa-f]{3,8}$')

FALLBACK_DOMAINS = {
    'google.com', 'accounts.google.com', 'oauth2.googleapis.com', 'recaptcha.google.com', 'www.google.com',
    'gstatic.com', 'challenges.cloudflare.com', 'hcaptcha.com', 'api.hcaptcha.com', 'newassets.hcaptcha.com',
    'arkoselabs.com', 'client-api.arkoselabs.com', 'funcaptcha.com', 'geetest.com',
    'github.com', 'githubusercontent.com', 'login.microsoftonline.com', 'login.live.com', 'appleid.apple.com',
    'auth0.com', 'facebook.com', 'graph.facebook.com', 'linkedin.com', 'recaptcha.net',
    'googletagmanager.com', 'chatgpt.com', 'auth.openai.com', 'chat.openai.com', 'claude.ai',
    'accounts.anthropic.com', 'gemini.google.com', 'ai.google.dev', 'perplexity.ai', 'z.ai',
    'jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com',
}

DEFAULT_CONFIG = {
    'blockingEnabled': True, 'maxActiveServices': 9, 'darkMode': True,
    'enabledServices': ['chatgpt', 'claude', 'gemini'],
    'favoriteServices': [], 'serviceOrder': [],
    'lastActiveService': None, 'defaultService': 'chatgpt', 'loadLastOpenedAI': True,
    'customJs': '', 'customCss': '', 'thirdPartyCookies': True, 'fontSize': 'medium',
    'openExternalLinks': False,
    'proxyEnabled': False, 'proxyType': 'http', 'proxyHost': '', 'proxyPort': '',
    'lastUpdate': None, 'lastUpdateCheck': None, 'updateFrequencyDays': 3,
    'remoteUrls': {
        'services': 'https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json',
        'rules': 'https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json',
    },
}


def gen_id(name):
    if not name: return ''
    return LOWERCASE_RE.sub('', WHITESPACE_RE.sub('', name.lower()))


def sanitize_color(c):
    if not c: return Gdk.RGBA(red=0.114, green=0.6, blue=0.953, alpha=1)
    h = c.lstrip('#')
    if COLOR_RE.match(h):
        try:
            rgba = Gdk.RGBA()
            rgba.parse(c if '#' in c else '#' + c)
            return rgba
        except: pass
    return Gdk.RGBA(red=0.114, green=0.6, blue=0.953, alpha=1)


CSS = """
/* Structural: sidebar panel */
.sidebar-panel { border-right: 1px solid @borders; }

/* Toolbar buttons: flat, compact */
.tb-btn { background: transparent; border: none; border-radius: 4px; padding: 2px 6px; min-height: 0; font-size: 12px; }
.tb-btn:hover { background: alpha(@theme_fg_color, 0.08); }
.tb-icon-btn { padding: 2px 4px; }

/* Category chips: pill shape */
.cat-chip { background: alpha(@theme_fg_color, 0.06); border: 1px solid alpha(@theme_fg_color, 0.12); border-radius: 14px; padding: 2px 10px; font-size: 10px; font-weight: 500; }
.cat-chip:hover { background: alpha(@theme_fg_color, 0.1); }
.cat-chip:checked { background: @theme_selected_bg_color; color: @theme_selected_fg_color; border-color: @theme_selected_bg_color; }

/* Service rows: subtle hover */
.svc-row { border-radius: 6px; }
.svc-row:hover { background: alpha(@theme_fg_color, 0.05); }
.svc-open { background: alpha(@theme_selected_bg_color, 0.06); }
.svc-active { background: alpha(@theme_selected_bg_color, 0.1); }

/* Badges for pricing / privacy */
.bdg-free { background: rgba(39,174,96,0.12); color: #27ae60; border: 1px solid rgba(39,174,96,0.2); border-radius: 10px; padding: 0 6px; font-size: 8px; font-weight: 600; }
.bdg-freemium { background: rgba(246,116,0,0.12); color: #f67400; border: 1px solid rgba(246,116,0,0.2); border-radius: 10px; padding: 0 6px; font-size: 8px; font-weight: 600; }
.bdg-paid { background: rgba(218,68,83,0.12); color: #da4453; border: 1px solid rgba(218,68,83,0.2); border-radius: 10px; padding: 0 6px; font-size: 8px; font-weight: 600; }
.bdg-priv { background: rgba(39,174,96,0.1); color: #27ae60; border: 1px solid rgba(39,174,96,0.15); border-radius: 10px; padding: 0 6px; font-size: 8px; }
.bdg-friendly { background: rgba(246,116,0,0.1); color: #f67400; border: 1px solid rgba(246,116,0,0.15); border-radius: 10px; padding: 0 6px; font-size: 8px; }
.bdg-nopriv { background: rgba(218,68,83,0.1); color: #da4453; border: 1px solid rgba(218,68,83,0.15); border-radius: 10px; padding: 0 6px; font-size: 8px; }

/* Welcome label */
.welcome-label { font-size: 14px; color: alpha(@theme_fg_color, 0.4); font-weight: 400; }

/* Star fav */
.fav-star { background: transparent; border: none; border-radius: 0; padding: 1px; font-size: 13px; min-width: 0; min-height: 0; }
.fav-star:hover { color: @theme_selected_bg_color; }

/* Section labels */
.section-label { font-size: 8px; font-weight: 700; color: alpha(@theme_fg_color, 0.45); padding: 4px 10px 2px; letter-spacing: 0.5px; }

/* Open tabs */
.tab-row { border-radius: 4px; }
.tab-row:hover { background: alpha(@theme_fg_color, 0.05); }
.tab-active { background: alpha(@theme_selected_bg_color, 0.1); }

/* Status message */
.status-msg { font-size: 11px; color: alpha(@theme_fg_color, 0.55); }

/* Switch styling */
switch { font-size: 0; min-width: 36px; min-height: 18px; }
switch slider { min-width: 16px; min-height: 16px; margin: 1px; }

/* Settings dialog: notebook tabs */
notebook tab { padding: 6px 14px; font-size: 11px; font-weight: 500; }
notebook tab:checked { border-bottom: 2px solid @theme_selected_bg_color; color: @theme_selected_bg_color; }

/* Settings dialog: frame */
dialog frame { border-radius: 6px; }
"""


class AIHubApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.FLAGS_NONE)
        self.connect('activate', self.on_activate)

        self.config = {}
        self.services_data = []
        self.rules_cache = None
        self.service_views = {}
        self.tab_order = []
        self.current_sid = None
        self.categories = []
        self.active_cat = 'all'
        self.query = ''

        self.win = None
        self.svc_container = None
        self.tabs_container = None
        self.stack = None
        self.search_entry = None
        self.cat_container = None
        self.header_update_btn = None
        self.blocking_indicator = None

    # ── helpers ──────────────────────────────────────────────
    def gen_id(self, n): return gen_id(n)

    def load_json(self, p):
        try:
            if os.path.exists(p):
                with open(p) as f: return json.load(f)
        except: return None

    def save_json(self, p, d):
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w') as f: json.dump(d, f, indent=2)
        except Exception as e: print(f'[Save] {p}: {e}')

    # ── config ───────────────────────────────────────────────
    def load_config(self):
        self.config = dict(DEFAULT_CONFIG)
        s = self.load_json(os.path.join(CFG_DIR, 'config.json'))
        if s:
            ru = dict(DEFAULT_CONFIG['remoteUrls'])
            ru.update(s.get('remoteUrls', {}))
            for k in DEFAULT_CONFIG:
                if k in s: self.config[k] = s[k]
            self.config['remoteUrls'] = ru
        self.save_config()

    def save_config(self):
        self.save_json(os.path.join(CFG_DIR, 'config.json'), self.config)

    # ── services ─────────────────────────────────────────────
    def load_services(self):
        d = self.load_json(os.path.join(DATA_DIR, 'remote_services.json'))
        if d and isinstance(d, dict):
            self.services_data = d.get('ai_services', [])
            cats = set()
            for s in self.services_data:
                if len(s) > 2 and s[2]: cats.add(s[2])
            self.categories = sorted(cats)

    def load_rules(self):
        if self.rules_cache: return self.rules_cache
        d = self.load_json(os.path.join(DATA_DIR, 'remote_rules.json'))
        if d: self.rules_cache = d
        return d

    def get_service_domains(self, sid):
        r = self.load_rules()
        return r.get('service_domains', {}).get(sid, []) if r else []

    def is_domain_allowed(self, host, sid):
        if not self.config.get('blockingEnabled', True): return True
        if host in FALLBACK_DOMAINS or any(host.endswith('.' + d) for d in FALLBACK_DOMAINS): return True
        r = self.load_rules()
        if r:
            a = r.get('common_auth_domains', [])
            if host in a or any(host.endswith('.' + d) for d in a): return True
        ds = self.get_service_domains(sid)
        if host in ds or any(host.endswith('.' + d) for d in ds): return True
        return False

    # ── network ──────────────────────────────────────────────
    def fetch_url(self, url):
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8')

    def update_remote_data(self):
        def _run():
            try:
                os.makedirs(DATA_DIR, exist_ok=True)
                upd = False
                urls = self.config.get('remoteUrls', DEFAULT_CONFIG['remoteUrls'])
                sr = self.fetch_url(urls['services'])
                sp = os.path.join(DATA_DIR, 'remote_services.json')
                so = open(sp).read() if os.path.exists(sp) else None
                if sr != so:
                    self.save_json(sp, json.loads(sr))
                    upd = True
                rr = self.fetch_url(urls['rules'])
                rp = os.path.join(DATA_DIR, 'remote_rules.json')
                ro = open(rp).read() if os.path.exists(rp) else None
                if rr != ro:
                    self.save_json(rp, json.loads(rr))
                    self.rules_cache = None
                    upd = True
                if upd:
                    self.config['lastUpdate'] = datetime.now(timezone.utc).isoformat()
                    self.load_rules()
                    self.load_services()
                self.config['lastUpdateCheck'] = datetime.now(timezone.utc).isoformat()
                self.save_config()
                GLib.idle_add(self._on_update_done)
            except Exception as e:
                print(f'[Update] {e}')
                GLib.idle_add(lambda: self._flash('Update failed'))
        threading.Thread(target=_run, daemon=True).start()

    def _on_update_done(self):
        self._rebuild_list()
        self._flash('Updated')

    # ── services ─────────────────────────────────────────────
    def open_service(self, sid, url, name):
        if sid in self.service_views:
            self._switch_to(sid)
            return
        lim = self.config.get('maxActiveServices', 9)
        if len(self.service_views) >= lim:
            return
        wv = WebKit2.WebView.new()
        ctx = wv.get_context()
        ctx.set_preferred_languages(['en-US', 'en'])
        s = wv.get_settings()
        s.set_enable_javascript(True)
        s.set_allow_modal_dialogs(True)
        s.set_javascript_can_open_windows_automatically(True)
        s.set_enable_webaudio(True)
        s.set_enable_webgl(True)
        s.set_enable_media_stream(True)
        s.set_enable_mediasource(True)
        s.set_enable_encrypted_media(True)
        s.set_enable_page_cache(True)
        s.set_enable_media(True)
        s.set_enable_plugins(True)
        s.set_enable_webrtc(True)
        s.set_enable_accelerated_2d_canvas(True)
        s.set_enable_site_specific_quirks(True)
        s.set_enable_frame_flattening(True)
        s.set_media_playback_requires_user_gesture(False)
        s.set_user_agent(USER_AGENT)
        if not self.config.get('thirdPartyCookies', True): s.set_enable_private_browsing(True)
        wv.connect('decide-policy', lambda w, d, t, i=sid: self._on_policy(w, d, t, i))
        wv.connect('load-changed', lambda w, e, i=sid: self._on_load(w, e, i))
        wv.load_uri(url)
        wv.show_all()
        self.service_views[sid] = wv
        self.tab_order.append(sid)
        self.stack.add_named(wv, sid)
        self._switch_to(sid)

    def close_service(self, sid):
        if sid in self.service_views:
            wv = self.service_views.pop(sid)
            self.stack.remove(wv)
            wv.destroy()
            if sid in self.tab_order: self.tab_order.remove(sid)
            if self.current_sid == sid:
                if self.tab_order:
                    self._switch_to(self.tab_order[-1])
                else: self.current_sid = None; self._show_welcome()
            self._rebuild_list()

    def _switch_to(self, sid):
        if sid in self.service_views:
            self.current_sid = sid
            self.stack.set_visible_child(self.service_views[sid])
            self.config['lastActiveService'] = sid
            self.save_config()
            self._rebuild_list()

    def _show_welcome(self):
        e = self.stack.get_child_by_name('_welcome')
        if not e:
            l = Gtk.Label(label='Select a service\nfrom the sidebar')
            l.get_style_context().add_class('welcome-label')
            l.set_name('_welcome')
            l.set_justify(Gtk.Justification.CENTER)
            self.stack.add_named(l, '_welcome')
        self.stack.set_visible_child_name('_welcome')

    def _on_policy(self, wv, d, t, sid):
        if t == WebKit2.PolicyDecisionType.NAVIGATION_ACTION:
            uri = d.get_request().get_uri()
            try:
                p = urlparse(uri)
                if p.hostname:
                    if self.config.get('openExternalLinks', False) and not self.is_domain_allowed(p.hostname, sid):
                        self._open_url(uri)
                        d.ignore()
                        return True
                    if not self.is_domain_allowed(p.hostname, sid):
                        d.ignore()
                        return True
            except: pass
        d.use(); return False

    def _on_load(self, wv, ev, sid):
        if ev == WebKit2.LoadEvent.FINISHED:
            css = self.config.get('customCss', '')
            jsc = self.config.get('customJs', '')
            if css:
                esc = css.replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')
                self._run_js(wv, '(function(){var s=document.createElement("style");s.id="aihub-css";var e=document.getElementById("aihub-css");if(e)e.remove();s.textContent=`' + esc + '`;document.head.appendChild(s);})()')
            if jsc: self._run_js(wv, jsc)

    def _run_js(self, wv, j):
        try: wv.evaluate_javascript(j, -1, None, None, None, None, None)
        except (AttributeError, TypeError): wv.run_javascript(j, None, lambda w, r, d: None, None)

    # ── sidebar list ─────────────────────────────────────────
    def _rebuild_list(self):
        if not self.svc_container: return
        for c in self.svc_container.get_children(): self.svc_container.remove(c)

        q = self.search_entry.get_text().strip().lower() if self.search_entry else ''
        eids = set(self.config.get('enabledServices', []))
        svcs = [s for s in self.services_data if self.gen_id(s[0]) in eids]
        if q:
            svcs = [s for s in svcs if s[0] and q in s[0].lower()]
        if self.active_cat != 'all':
            svcs = [s for s in svcs if len(s) > 2 and s[2] and s[2].lower() == self.active_cat]

        favs = set(self.config.get('favoriteServices', []))
        order = self.config.get('serviceOrder', [])

        def sort_key(s):
            sid = self.gen_id(s[0])
            return order.index(sid) if sid in order else 999

        if not svcs:
            l = Gtk.Label(label='No services found', xalign=0)
            l.set_margin_start(12)
            l.set_margin_top(12)
            l.get_style_context().add_class('section-label')
            self.svc_container.pack_start(l, False, False, 0)
            self.svc_container.show_all()
            self._update_tabs()
            return

        flist = [s for s in svcs if self.gen_id(s[0]) in favs]
        nlist = [s for s in svcs if self.gen_id(s[0]) not in favs]
        flist.sort(key=sort_key)
        nlist.sort(key=sort_key)

        def make_row(svc):
            name, url = svc[0], svc[1]
            typ = svc[2] if len(svc) > 2 else ''
            priv = svc[3] if len(svc) > 3 else ''
            color = sanitize_color(svc[4] if len(svc) > 4 else '')
            sid = self.gen_id(name)
            is_open = sid in self.service_views
            is_active = sid == self.current_sid
            is_fav = sid in favs

            row = Gtk.ListBoxRow()
            row.get_style_context().add_class('svc-row')
            if is_active: row.get_style_context().add_class('svc-active')
            elif is_open: row.get_style_context().add_class('svc-open')

            hb = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            hb.set_margin_start(8); hb.set_margin_end(4)
            hb.set_margin_top(4); hb.set_margin_bottom(4)

            dot = Gtk.DrawingArea()
            dot.set_size_request(7, 7)
            dot.set_valign(Gtk.Align.CENTER)
            cr = color
            dot.connect('draw', lambda w, c: c.set_source_rgba(cr.red, cr.green, cr.blue, 1) or c.arc(3.5, 3.5, 3.5, 0, 6.283) or c.fill())
            hb.pack_start(dot, False, False, 0)

            nl = Gtk.Label(label=name, xalign=0)
            nl.set_ellipsize(Pango.EllipsizeMode.END)
            nl.set_max_width_chars(14)
            nl.set_markup(f'<b>{name}</b>')
            nl.set_use_markup(True)
            hb.pack_start(nl, True, True, 0)

            fav_b = Gtk.Button(label='\u2605' if is_fav else '\u2606')
            fav_b.get_style_context().add_class('fav-star')
            fav_b.connect('clicked', lambda b, i=sid: self._toggle_fav(i))
            hb.pack_start(fav_b, False, False, 0)

            if is_open:
                cl_b = Gtk.Button(label='\u2715')
                cl_b.get_style_context().add_class('fav-star')
                cl_b.connect('clicked', lambda b, i=sid: self.close_service(i))
                hb.pack_start(cl_b, False, False, 0)

            eb = Gtk.EventBox()
            eb.add(hb)
            eb.connect('button-press-event', lambda w, e, i=sid, u=url, n=name: self._on_svc_click(w, e, i, u, n) or True)
            row.add(eb)
            return row

        sec = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if flist:
            l = Gtk.Label(label='FAVORITES', xalign=0)
            l.get_style_context().add_class('section-label')
            sec.pack_start(l, False, False, 0)
            for s in flist: sec.pack_start(make_row(s), False, False, 0)
        if nlist:
            if flist:
                sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
                sec.pack_start(sep, False, False, 4)
            l2 = Gtk.Label(label='ALL SERVICES', xalign=0)
            l2.get_style_context().add_class('section-label')
            sec.pack_start(l2, False, False, 0)
            for s in nlist: sec.pack_start(make_row(s), False, False, 0)

        self.svc_container.add(sec)
        self.svc_container.show_all()
        self._update_tabs()

    def _update_tabs(self):
        if not self.tabs_container: return
        for c in self.tabs_container.get_children(): self.tabs_container.remove(c)
        if not self.tab_order:
            self.tabs_expander.set_visible(False)
            return
        self.tabs_expander.set_visible(True)
        self.tabs_expander.set_label(f'Open tabs ({len(self.tab_order)})')
        self.tabs_expander.set_expanded(True)

        for sid in self.tab_order:
            svc = self._find(sid)
            name = svc[0] if svc else sid
            color = sanitize_color(svc[4] if svc else '#1d99f3')
            is_active = sid == self.current_sid

            hb = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
            hb.set_margin_start(6); hb.set_margin_end(4)
            hb.set_margin_top(2); hb.set_margin_bottom(2)

            dot = Gtk.DrawingArea()
            dot.set_size_request(5, 5)
            dot.set_valign(Gtk.Align.CENTER)
            cr = color
            dot.connect('draw', lambda w, c: c.set_source_rgba(cr.red, cr.green, cr.blue, 1) or c.arc(2.5, 2.5, 2.5, 0, 6.283) or c.fill())
            hb.pack_start(dot, False, False, 0)

            lbl = Gtk.Label(label=name, xalign=0)
            lbl.set_ellipsize(Pango.EllipsizeMode.END)
            hb.pack_start(lbl, True, True, 0)

            cl = Gtk.Button(label='\u2715')
            cl.get_style_context().add_class('tab-close-btn')
            cl.connect('clicked', lambda b, i=sid: self.close_service(i))
            hb.pack_start(cl, False, False, 0)

            eb = Gtk.EventBox()
            eb.add(hb)
            eb.connect('button-press-event', lambda w, e, i=sid: self._switch_to(i) or True)

            c = Gtk.ListBoxRow()
            c.get_style_context().add_class('tab-row')
            if is_active: c.get_style_context().add_class('tab-active')
            c.add(eb)
            self.tabs_container.pack_start(c, False, False, 0)

        self.tabs_container.show_all()

    def _rebuild_cats(self):
        if not self.cat_container: return
        for c in self.cat_container.get_children(): self.cat_container.remove(c)

        def on_cat(b, cat):
            self.active_cat = cat
            for ch in self.cat_container.get_children():
                ch.set_active(ch == b)
            self._rebuild_list()

        all_b = Gtk.ToggleButton(label='All')
        all_b.get_style_context().add_class('cat-chip')
        all_b.set_active(True)
        all_b.set_relief(Gtk.ReliefStyle.NONE)
        all_b.connect('toggled', lambda b: on_cat(b, 'all'))
        self.cat_container.add(all_b)

        for cat in self.categories[:8]:
            b = Gtk.ToggleButton(label=cat)
            b.get_style_context().add_class('cat-chip')
            b.set_relief(Gtk.ReliefStyle.NONE)
            b.connect('toggled', lambda b, c=cat.lower(): on_cat(b, c) if b.get_active() else None)
            self.cat_container.add(b)

        self.cat_container.show_all()

    def _on_svc_click(self, w, ev, sid, url, name):
        if ev.button == 1: self.open_service(sid, url, name)
        return True

    def _toggle_fav(self, sid):
        f = list(self.config.get('favoriteServices', []))
        if sid in f: f.remove(sid)
        else: f.append(sid)
        self.config['favoriteServices'] = f
        self.save_config()
        self._rebuild_list()

    def _find(self, sid):
        for s in self.services_data:
            if self.gen_id(s[0]) == sid: return s
        return None

    def _zoom(self, delta):
        if self.current_sid and self.current_sid in self.service_views:
            wv = self.service_views[self.current_sid]
            if delta == 0:
                wv.set_zoom_level(1.0)
                self._flash('Zoom 100%')
            else:
                z = wv.get_zoom_level()
                wv.set_zoom_level(max(0.3, min(5.0, z + delta)))
                self._flash(f'Zoom {int(round((z + delta) * 100))}%')

    def _clear_page_data(self):
        if not (self.current_sid and self.current_sid in self.service_views): return
        d = Gtk.MessageDialog(parent=self.win, flags=Gtk.DialogFlags.MODAL,
                              type=Gtk.MessageType.WARNING, buttons=Gtk.ButtonsType.OK_CANCEL,
                              text='Clear cached data for this page?')
        d.format_secondary_text('All cached data (images, scripts, API responses) will be removed.')
        r = d.run(); d.destroy()
        if r != Gtk.ResponseType.OK: return
        self.service_views[self.current_sid].get_context().clear_cache()
        self._flash('Data cleared')

    def _reload_page(self):
        if self.current_sid and self.current_sid in self.service_views:
            self.service_views[self.current_sid].reload()
            self._flash('Reloading...')

    def _open_in_browser(self):
        if self.current_sid:
            svc = self._find(self.current_sid)
            if svc: self._open_url(svc[1])

    def _open_url(self, url):
        import subprocess
        if url.startswith(('http://', 'https://')):
            subprocess.Popen(['xdg-open', url])

    def _flash(self, msg):
        self.status_label.set_text(msg)
        GLib.timeout_add_seconds(2, lambda: self.status_label.set_text('') or True)

    # ── main window ──────────────────────────────────────────
    def on_activate(self, app):
        self.load_config(); self.load_services(); self.load_rules()

        self.win = Gtk.ApplicationWindow(application=app)
        self.win.set_title('AI Hub')
        self.win.set_default_size(1100, 750)
        self.win.set_position(Gtk.WindowPosition.CENTER)

        css = Gtk.CssProvider()
        css.load_from_data(CSS.encode('utf-8'))
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        self.win.set_title('AI Hub')

        # ── toolbar below system titlebar ──
        tb = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        tb.set_margin_start(4); tb.set_margin_end(4)
        tb.set_margin_top(2); tb.set_margin_bottom(1)

        self.blocking_indicator = Gtk.Label()
        self.blocking_indicator.set_markup('<span color="#27ae60" size="large">\u25cf</span>')
        tb.pack_start(self.blocking_indicator, False, False, 0)

        self.status_label = Gtk.Label(label='')
        self.status_label.set_margin_start(4)
        self.status_label.get_style_context().add_class('status-msg')
        tb.pack_start(self.status_label, False, False, 0)

        def _tbtn(lbl, tip, cb):
            b = Gtk.Button(label=lbl); b.set_tooltip_text(tip); b.set_relief(Gtk.ReliefStyle.NONE); b.connect('clicked', lambda b: cb()); b.get_style_context().add_class('tb-btn'); return b

        tb.pack_start(_tbtn('\u2630', 'Toggle sidebar', self._toggle_sidebar), False, False, 0)
        self.header_update_btn = _tbtn('\u21bb', 'Update', self._on_update_click)
        tb.pack_start(self.header_update_btn, False, False, 0)

        tb.pack_start(Gtk.Label(), True, True, 0)  # spacer

        for l, t, c in [('\u2212', 'Zoom out', lambda: self._zoom(-0.15)), ('\u25E6', 'Reset', lambda: self._zoom(0)), ('+', 'Zoom in', lambda: self._zoom(0.15))]:
            tb.pack_end(_tbtn(l, t, c), False, False, 0)
        tb.pack_end(_tbtn('\u21bb', 'Reload', self._reload_page), False, False, 0)
        tb.pack_end(_tbtn('\u2197', 'Open in system browser', self._open_in_browser), False, False, 0)
        clr_btn = Gtk.Button()
        clr_btn.set_relief(Gtk.ReliefStyle.NONE)
        clr_btn.set_tooltip_text('Clear cached data for this page')
        clr_btn.get_style_context().add_class('tb-btn')
        clr_btn.get_style_context().add_class('tb-icon-btn')
        clr_img = Gtk.Image.new_from_icon_name('edit-delete-symbolic', Gtk.IconSize.MENU)
        clr_img.set_pixel_size(14)
        clr_btn.add(clr_img)
        clr_btn.connect('clicked', lambda b: self._clear_page_data())
        tb.pack_end(clr_btn, False, False, 0)

        # ── main layout ──
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        vbox.pack_start(tb, False, False, 0)

        self.paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL)
        paned = self.paned
        vbox.pack_start(paned, True, True, 0)
        self.win.add(vbox)

        # --- sidebar ---
        sidebar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        sidebar.get_style_context().add_class('sidebar-panel')
        sidebar.set_size_request(220, -1)

        self.search_entry = Gtk.SearchEntry()
        self.search_entry.set_placeholder_text('Search services...')
        self.search_entry.set_margin_top(6)
        self.search_entry.set_margin_bottom(4)
        self.search_entry.set_margin_start(6)
        self.search_entry.set_margin_end(6)
        self.search_entry.get_style_context().add_class('search-entry')
        self.search_entry.connect('search-changed', lambda e: self._rebuild_list())
        sidebar.pack_start(self.search_entry, False, False, 0)

        self.cat_container = Gtk.FlowBox()
        self.cat_container.set_max_children_per_line(4)
        self.cat_container.set_min_children_per_line(2)
        self.cat_container.set_selection_mode(Gtk.SelectionMode.NONE)
        self.cat_container.set_margin_start(6)
        self.cat_container.set_margin_end(6)
        self.cat_container.set_margin_top(2)
        self.cat_container.set_margin_bottom(4)
        self.cat_container.set_row_spacing(3)
        self.cat_container.set_column_spacing(3)
        sidebar.pack_start(self.cat_container, False, False, 0)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_min_content_height(200)
        self.svc_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        scrolled.add(self.svc_container)
        sidebar.pack_start(scrolled, True, True, 0)

        sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sidebar.pack_start(sep, False, False, 0)

        self.tabs_expander = Gtk.Expander(label='Open tabs')
        self.tabs_expander.set_expanded(True)
        self.tabs_expander.get_style_context().add_class('tabs-section')
        tscroll = Gtk.ScrolledWindow()
        tscroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        tscroll.set_min_content_height(60)
        tscroll.set_max_content_height(200)
        self.tabs_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        tscroll.add(self.tabs_container)
        self.tabs_expander.add(tscroll)
        self.tabs_expander.set_visible(False)
        sidebar.pack_start(self.tabs_expander, False, False, 0)

        # Settings button at bottom
        sbtn_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        sbtn_box.set_margin_start(6); sbtn_box.set_margin_end(6)
        sbtn_box.set_margin_top(4); sbtn_box.set_margin_bottom(6)
        sbtn = Gtk.Button(label='\u2699 Settings')
        sbtn.set_size_request(-1, 30)
        sbtn.connect('clicked', lambda b: self._show_settings())
        sbtn_box.pack_start(sbtn, True, True, 0)
        sidebar.pack_start(sbtn_box, False, False, 0)

        paned.pack1(sidebar, False, False)

        # --- service stack ---
        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self._show_welcome()
        paned.pack2(self.stack, True, False)

        self.win.show_all()

        self._rebuild_cats()
        self._rebuild_list()

        if self.config.get('loadLastOpenedAI') and self.config.get('lastActiveService'):
            sid = self.config['lastActiveService']
            svc = self._find(sid)
            if svc: self.open_service(sid, svc[1], svc[0])

        GLib.timeout_add_seconds(3, lambda: self.update_remote_data() or False)

    def _toggle_sidebar(self):
        sidebar = self.paned.get_child1()
        if sidebar.get_visible():
            sidebar.hide()
        else:
            sidebar.show()

    def _on_update_click(self):
        self._flash('Updating...')
        self.update_remote_data()

    def _cache_dialog(self, parent, btn):
        d = Gtk.MessageDialog(parent=parent, flags=Gtk.DialogFlags.MODAL,
                              type=Gtk.MessageType.WARNING, buttons=Gtk.ButtonsType.OK_CANCEL,
                              text='Clear all cached data?')
        d.format_secondary_text('This will clear the cache for all services.')
        r = d.run(); d.destroy()
        if r != Gtk.ResponseType.OK: return
        for wv in self.service_views.values(): wv.get_context().clear_cache()
        btn.set_label('\u2713 Cache cleared')

    def _clear_all_dialog(self, parent, btn):
        d = Gtk.MessageDialog(parent=parent, flags=Gtk.DialogFlags.MODAL,
                              type=Gtk.MessageType.WARNING, buttons=Gtk.ButtonsType.OK_CANCEL,
                              text='Delete all data?')
        d.format_secondary_text('All cached data, service data, and local files will be removed.')
        r = d.run(); d.destroy()
        if r != Gtk.ResponseType.OK: return
        import shutil
        if os.path.exists(DATA_DIR): shutil.rmtree(DATA_DIR)
        btn.set_label('\u2713 All data cleared')

    # ── settings dialog ──────────────────────────────────────
    def _show_settings(self):
        d = Gtk.Dialog(title='Settings', parent=self.win, flags=0)
        d.add_buttons('Cancel', Gtk.ResponseType.CANCEL, 'Save', Gtk.ResponseType.OK)
        d.set_default_size(540, 620)

        nb = Gtk.Notebook()
        d.get_content_area().pack_start(nb, True, True, 0)

        # ── General ──
        g = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        g.set_margin_start(12); g.set_margin_end(12); g.set_margin_top(12)

        chk_load = Gtk.CheckButton(label='Load last opened AI on startup', active=self.config.get('loadLastOpenedAI', True))
        g.pack_start(chk_load, False, False, 0)

        hd = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        hd.pack_start(Gtk.Label(label='Default service:'), False, False, 0)
        cd = Gtk.ComboBoxText()
        for s in self.services_data:
            sid = self.gen_id(s[0])
            if sid in self.config.get('enabledServices', []): cd.append(sid, s[0])
        cd.set_active_id(self.config.get('defaultService', 'chatgpt'))
        hd.pack_start(cd, True, True, 0)
        g.pack_start(hd, False, False, 0)

        hf = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        hf.pack_start(Gtk.Label(label='Font size:'), False, False, 0)
        cf = Gtk.ComboBoxText()
        for v, l in [('x-small','X-Small'),('small','Small'),('medium','Medium'),('large','Large'),('x-large','X-Large')]:
            cf.append(v, l)
        cf.set_active_id(self.config.get('fontSize', 'medium'))
        hf.pack_start(cf, False, False, 0)
        g.pack_start(hf, False, False, 0)

        chk_3p = Gtk.CheckButton(label='Allow third-party cookies', active=self.config.get('thirdPartyCookies', True))
        g.pack_start(chk_3p, False, False, 0)

        chk_blk = Gtk.CheckButton(label='Enable domain blocking', active=self.config.get('blockingEnabled', True))
        g.pack_start(chk_blk, False, False, 0)

        chk_ext = Gtk.CheckButton(label='Open external links in browser', active=self.config.get('openExternalLinks', False))
        g.pack_start(chk_ext, False, False, 0)

        # proxy frame
        pf = Gtk.Frame(label='Proxy')
        pb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        pb.set_margin_start(8); pb.set_margin_end(8); pb.set_margin_top(8); pb.set_margin_bottom(8)

        chk_pr = Gtk.CheckButton(label='Enable proxy', active=self.config.get('proxyEnabled', False))
        pb.pack_start(chk_pr, False, False, 0)

        hp = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        cp = Gtk.ComboBoxText()
        cp.append('http','HTTP'); cp.append('socks5','SOCKS5')
        cp.set_active_id(self.config.get('proxyType','http'))
        hp.pack_start(cp, False, False, 0)
        eph = Gtk.Entry(); eph.set_placeholder_text('Host'); eph.set_text(self.config.get('proxyHost',''))
        hp.pack_start(eph, True, True, 0)
        epp = Gtk.Entry(); epp.set_placeholder_text('Port'); epp.set_width_chars(6); epp.set_text(self.config.get('proxyPort',''))
        hp.pack_start(epp, False, False, 0)
        pb.pack_start(hp, False, False, 0)
        pf.add(pb)
        g.pack_start(pf, False, False, 0)

        hu = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        hu.pack_start(Gtk.Label(label='Update frequency:'), False, False, 0)
        cu = Gtk.ComboBoxText()
        for v, l in [('1','Daily'),('3','Every 3 days'),('7','Weekly'),('-1','Manual')]:
            cu.append(v, l)
        cu.set_active_id(str(self.config.get('updateFrequencyDays',3)))
        hu.pack_start(cu, False, False, 0)
        g.pack_start(hu, False, False, 0)

        lu = Gtk.Label(label='Last updated: ' + str(self.config.get('lastUpdate','Never')), xalign=0)
        g.pack_start(lu, False, False, 0)

        stb = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        ccb = Gtk.Button(label='Clear Cache')
        cab = Gtk.Button(label='Clear All Data')
        ccb.connect('clicked', lambda b: self._cache_dialog(d, ccb))
        cab.connect('clicked', lambda b: self._clear_all_dialog(d, cab))
        stb.pack_start(ccb, False, False, 0)
        stb.pack_start(cab, False, False, 0)
        g.pack_start(stb, False, False, 0)

        nb.append_page(g, Gtk.Label(label='General'))

        # ── Services ──
        st = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        st.set_margin_start(12); st.set_margin_end(12); st.set_margin_top(12)

        svc_search = Gtk.SearchEntry()
        svc_search.set_placeholder_text('Search services...')
        svc_search.set_margin_bottom(4)
        st.pack_start(svc_search, False, False, 0)

        ss = Gtk.ScrolledWindow()
        sl = Gtk.ListBox()
        eids = set(self.config.get('enabledServices', []))
        order = self.config.get('serviceOrder', [])
        all_svcs = sorted(self.services_data, key=lambda s: order.index(self.gen_id(s[0])) if self.gen_id(s[0]) in order else 999)

        def rebuild_service_settings(search_text=''):
            for c in sl.get_children(): sl.remove(c)
            q = search_text.lower().strip() if search_text else ''
            filtered = [s for s in all_svcs if not q or (s[0] and q in s[0].lower())]
            for svc in filtered:
                sid = self.gen_id(svc[0])
                ie = sid in eids
                row = Gtk.ListBoxRow()
                rh = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
                sw = Gtk.Switch()
                sw.set_active(ie)
                sw.connect('notify::active', lambda s, p, i=sid: self._on_svc_toggle(i, s.get_active()))
                rh.pack_start(sw, False, False, 0)

                color = sanitize_color(svc[4] if len(svc) > 4 else '')
                dot = Gtk.DrawingArea()
                dot.set_size_request(10, 10)
                dot.set_valign(Gtk.Align.CENTER)
                cr = color
                dot.connect('draw', lambda w, c: c.set_source_rgba(cr.red, cr.green, cr.blue, 1) or c.arc(5, 5, 5, 0, 6.283) or c.fill())
                rh.pack_start(dot, False, False, 0)

                vb_info = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
                nl = Gtk.Label(label=svc[0], xalign=0)
                nl.set_markup(f'<b>{svc[0]}</b>')
                nl.set_use_markup(True)
                vb_info.pack_start(nl, False, False, 0)

                # Badges row
                badge_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
                typ = svc[2] if len(svc) > 2 else ''
                priv = svc[3] if len(svc) > 3 else ''
                if typ:
                    cls = 'bdg-free' if typ.lower() == 'free' else 'bdg-freemium' if typ.lower() == 'freemium' else 'bdg-paid'
                    bl = Gtk.Label(label=typ)
                    bl.get_style_context().add_class(cls)
                    badge_box.pack_start(bl, False, False, 0)
                if priv:
                    cls2 = 'bdg-priv' if priv.lower() == 'privacy focused' else 'bdg-friendly' if priv.lower() == 'privacy friendly' else 'bdg-nopriv'
                    bl2 = Gtk.Label(label=priv)
                    bl2.get_style_context().add_class(cls2)
                    badge_box.pack_start(bl2, False, False, 0)
                vb_info.pack_start(badge_box, False, False, 0)

                rh.pack_start(vb_info, True, True, 0)

                ub = Gtk.Button(label='\u25b2'); ub.set_size_request(22, 22)
                ub.connect('clicked', lambda b, i=sid: self._move_svc(i, -1))
                rh.pack_start(ub, False, False, 0)
                db = Gtk.Button(label='\u25bc'); db.set_size_request(22, 22)
                db.connect('clicked', lambda b, i=sid: self._move_svc(i, 1))
                rh.pack_start(db, False, False, 0)

                row.add(rh); sl.add(row)
            sl.show_all()

        svc_search.connect('search-changed', lambda e: rebuild_service_settings(e.get_text()))
        rebuild_service_settings()

        ss.add(sl); st.pack_start(ss, True, True, 0)
        nb.append_page(st, Gtk.Label(label='Services'))

        # ── Injection ──
        ij = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        ij.set_margin_start(12); ij.set_margin_end(12); ij.set_margin_top(12)

        ij.pack_start(Gtk.Label(label='Custom JavaScript', xalign=0), False, False, 0)
        tvj = Gtk.TextView(); tvj.set_wrap_mode(Gtk.WrapMode.WORD_CHAR); tvj.set_size_request(-1, 100)
        bj = tvj.get_buffer(); bj.set_text(self.config.get('customJs',''))
        swj = Gtk.ScrolledWindow(); swj.add(tvj); ij.pack_start(swj, True, True, 0)

        ij.pack_start(Gtk.Label(label='Custom CSS', xalign=0), False, False, 0)
        tvc = Gtk.TextView(); tvc.set_wrap_mode(Gtk.WrapMode.WORD_CHAR); tvc.set_size_request(-1, 100)
        bc = tvc.get_buffer(); bc.set_text(self.config.get('customCss',''))
        swc = Gtk.ScrolledWindow(); swc.add(tvc); ij.pack_start(swc, True, True, 0)

        nb.append_page(ij, Gtk.Label(label='Injection'))

        # ── About ──
        ab = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        ab.set_margin_start(12); ab.set_margin_end(12); ab.set_margin_top(12)

        # App icon
        icon_path = os.path.join(BASE, 'ui', 'assets', 'icon.png')
        if os.path.exists(icon_path):
            icon_pix = GdkPixbuf.Pixbuf.new_from_file_at_scale(icon_path, 48, 48, True)
            icon_img = Gtk.Image.new_from_pixbuf(icon_pix)
            icon_img.set_margin_bottom(4)
            ab.pack_start(icon_img, False, False, 0)

        l_ab = Gtk.Label(label='AI Hub Desktop', xalign=0)
        l_ab.set_markup('<b>AI Hub Desktop</b>')
        ab.pack_start(l_ab, False, False, 0)
        ab.pack_start(Gtk.Label(label='Version 1.0.0 (Python - Linux Native)', xalign=0), False, False, 0)
        ab.pack_start(Gtk.Label(label='All-in-one AI assistants desktop application', xalign=0), False, False, 0)

        sep1 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep1.set_margin_top(8); sep1.set_margin_bottom(8)
        ab.pack_start(sep1, False, False, 0)

        # Credits
        l_cr = Gtk.Label(label='Credits', xalign=0)
        l_cr.set_markup('<b>Credits</b>')
        ab.pack_start(l_cr, False, False, 0)

        def make_link(text, desc, url):
            bx = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            bx.set_margin_start(4)
            vb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
            vb.pack_start(Gtk.Label(label=text, xalign=0), False, False, 0)
            if desc:
                d = Gtk.Label(xalign=0)
                d.set_markup(f'<span size="small" color="#808488">{desc}</span>')
                vb.pack_start(d, False, False, 0)
            bx.pack_start(vb, True, True, 0)
            btn = Gtk.Button(label='Open')
            btn.connect('clicked', lambda b: self._open_url(url))
            bx.pack_start(btn, False, False, 0)
            return bx

        ab.pack_start(make_link('AI Hub Android', 'Original Android app by SilentCoder', 'https://github.com/SilentCoderHere/aihub'), False, False, 0)
        ab.pack_start(make_link('AI Hub Desktop', 'Desktop port', 'https://github.com/Daskashk/aihub-desktop'), False, False, 0)

        sep2 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep2.set_margin_top(8); sep2.set_margin_bottom(8)
        ab.pack_start(sep2, False, False, 0)

        # Community
        l_comm = Gtk.Label(label='Community', xalign=0)
        l_comm.set_markup('<b>Community</b>')
        ab.pack_start(l_comm, False, False, 0)
        ab.pack_start(make_link('AI Hub Matrix Group', 'Official AI Hub community on Matrix', 'https://matrix.to/#/#aihub-silentcoder:matrix.org'), False, False, 0)
        ab.pack_start(make_link('Topic Guild Matrix Group', "Daskashk's community on Matrix", 'https://matrix.to/#/#topic-guild:matrix.org'), False, False, 0)
        ab.pack_start(make_link('Topic Guild Telegram', 'Join on Telegram', 'https://t.me/topicsguild'), False, False, 0)

        sep3 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep3.set_margin_top(8); sep3.set_margin_bottom(8)
        ab.pack_start(sep3, False, False, 0)

        # Feedback
        l_fb = Gtk.Label(label='Feedback', xalign=0)
        l_fb.set_markup('<b>Feedback</b>')
        ab.pack_start(l_fb, False, False, 0)
        ab.pack_start(make_link('Request New AI Service', 'Suggest a new AI service to be added', 'https://github.com/SilentCoderHere/aihub/issues/new?template=new_ai_service_request.yml'), False, False, 0)
        ab.pack_start(make_link('Report a Bug', 'Report an issue with the desktop app', 'https://github.com/Daskashk/aihub-desktop/issues/new'), False, False, 0)

        sep4 = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep4.set_margin_top(8); sep4.set_margin_bottom(8)
        ab.pack_start(sep4, False, False, 0)

        ab.pack_start(Gtk.Label(label='Licensed under GPL-3.0', xalign=0), False, False, 0)

        nb.append_page(ab, Gtk.Label(label='About'))

        d.get_content_area().show_all()
        r = d.run()

        if r == Gtk.ResponseType.OK:
            self.config['loadLastOpenedAI'] = chk_load.get_active()
            self.config['defaultService'] = cd.get_active_id() or 'chatgpt'
            self.config['fontSize'] = cf.get_active_id() or 'medium'
            self.config['thirdPartyCookies'] = chk_3p.get_active()
            self.config['blockingEnabled'] = chk_blk.get_active()
            self.config['openExternalLinks'] = chk_ext.get_active()
            self.config['proxyEnabled'] = chk_pr.get_active()
            self.config['proxyType'] = cp.get_active_id() or 'http'
            self.config['proxyHost'] = eph.get_text()
            self.config['proxyPort'] = epp.get_text()
            self.config['updateFrequencyDays'] = int(cu.get_active_id() or '3')
            si, ei = bj.get_bounds(); self.config['customJs'] = bj.get_text(si, ei, True)
            si2, ei2 = bc.get_bounds(); self.config['customCss'] = bc.get_text(si2, ei2, True)
            self.save_config()
            self._rebuild_list()
            GLib.idle_add(lambda: self._flash('Saved') or False)

        d.destroy()

    def _on_svc_toggle(self, sid, active):
        e = list(self.config.get('enabledServices', []))
        if active:
            if sid not in e:
                e.append(sid)
                o = list(self.config.get('serviceOrder', []))
                if sid not in o: o.append(sid); self.config['serviceOrder'] = o
        elif len(e) > 1 and sid in e: e.remove(sid)
        self.config['enabledServices'] = e
        self.save_config()
        self._rebuild_list()

    def _move_svc(self, sid, d):
        o = list(self.config.get('serviceOrder', []))
        i = o.index(sid) if sid in o else -1
        if i < 0: return
        ni = i + d
        if ni < 0 or ni >= len(o): return
        o[i], o[ni] = o[ni], o[i]
        self.config['serviceOrder'] = o
        self.save_config()
        self._rebuild_list()


if __name__ == '__main__':
    app = AIHubApp()
    sys.exit(app.run(sys.argv))
