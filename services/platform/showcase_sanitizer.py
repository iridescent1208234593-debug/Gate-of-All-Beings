"""[M7] Allowlist re-serializer for saved showcase pages.

Saved showcase HTML is user-controlled. Before it is served, it is parsed and rebuilt from an
allowlist of tags, attributes and URL forms: scripts, event handlers, embeds, forms, frames,
meta refresh, <base>, and javascript:/external URLs are dropped. Every attribute value and text
node is re-escaped, so the output never carries markup the allowlist did not produce. The only
scripts on a served page are the server's own, added by `controlled_showcase()` with a per-response
nonce and a CSP that refuses every other script. The sandboxed iframe in show.html stays as the
second layer.
"""
from html import escape
from html.parser import HTMLParser
import re
import secrets

ALLOWED_TAGS = frozenset("""
html head title style meta body div span p h1 h2 h3 h4 h5 h6 br hr table thead tbody tfoot tr th td
caption colgroup col ul ol li dl dt dd strong b em i u s small sub sup mark blockquote pre code
details summary a img button nav footer header section article aside main figure figcaption canvas
""".split())
VOID_TAGS = frozenset("br hr img meta col".split())
# Content of these elements is dropped with the element; anything else unknown keeps its text only.
DROP_CONTENT_TAGS = frozenset("""
script noscript template iframe frame frameset object embed applet svg math form textarea select
option xmp plaintext noembed noframes video audio source track picture portal
""".split())
GLOBAL_ATTRIBUTES = frozenset("class id style title lang dir role hidden".split())
TAG_ATTRIBUTES = {
    "img": frozenset("src alt width height loading decoding".split()),
    "a": frozenset("href".split()),
    "button": frozenset("type disabled".split()),
    "details": frozenset("open".split()),
    "td": frozenset("colspan rowspan".split()),
    "th": frozenset("colspan rowspan scope".split()),
    "col": frozenset("span".split()),
    "ol": frozenset("start type".split()),
    "canvas": frozenset("width height".split()),
    "html": frozenset("lang data-theme".split()),
}
DATA_ATTRIBUTE = re.compile(r"^(?:data|aria)-[a-z0-9-]{1,40}$")
DATA_IMAGE = re.compile(r"^data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$", re.I)
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)
CSS_BLOCKED = re.compile(r"@import|expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:", re.I)
SAFE_CSS_DATA = re.compile(r"^data:image/(?:png|jpeg|webp|gif|svg\+xml)[;,]", re.I)


def _same_origin_path(value):
    # "/x" only: "//host", "/\host" and any whitespace/control character could leave the site.
    return (value.startswith("/") and value[1:2] not in ("/", "\\")
            and not re.search(r"[\x00-\x20\x7f\\]", value))


def safe_link(value):
    value = value.strip()
    if value.startswith("#") and not re.search(r"[\x00-\x20\x7f]", value):
        return value
    return value if _same_origin_path(value) else None


def safe_image_source(value, remote_hosts=()):
    value = value.strip()
    if DATA_IMAGE.fullmatch(value) or _same_origin_path(value):
        return value
    match = re.fullmatch(r"https://([A-Za-z0-9.-]+)/[^\s\"'<>\\]*", value)
    if match and match.group(1).lower() in remote_hosts:
        return value
    return None


def safe_css(text):
    """Keep declarations; drop imports, legacy script hooks and url() that leaves the page."""
    if CSS_BLOCKED.search(text):
        text = CSS_BLOCKED.sub("/*removed*/", text)

    def url(match):
        target = match.group(2).strip()
        if SAFE_CSS_DATA.match(target) or _same_origin_path(target):
            return match.group(0)
        return "none"
    return CSS_URL.sub(url, text).replace("<", "\\3c ")


class _Sanitizer(HTMLParser):
    def __init__(self, remote_hosts):
        super().__init__(convert_charrefs=True)
        self.remote_hosts = remote_hosts
        self.out = []
        self.stack = []        # open allowed tags, for balanced closing
        self.skip = []         # open dropped-content tags
        self.raw = None        # "style" while inside an allowed <style>

    def _attributes(self, tag, attrs):
        allowed = TAG_ATTRIBUTES.get(tag, frozenset())
        kept = []
        for name, value in attrs:
            name = (name or "").lower()
            value = "" if value is None else value
            if name.startswith("on") or not (name in GLOBAL_ATTRIBUTES or name in allowed or DATA_ATTRIBUTE.fullmatch(name)):
                continue
            if name == "href":
                value = safe_link(value)
            elif name == "src":
                value = safe_image_source(value, self.remote_hosts)
            elif name == "style":
                value = safe_css(value)
            elif name == "type" and tag == "button":
                value = "button"
            if value is None:
                continue
            kept.append(f' {name}="{escape(value, quote=True)}"')
        return "".join(kept)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.skip:
            if tag in DROP_CONTENT_TAGS and tag not in VOID_TAGS:
                self.skip.append(tag)
            return
        if tag in DROP_CONTENT_TAGS:
            self.skip.append(tag)
            return
        if tag not in ALLOWED_TAGS:
            return
        if tag == "meta":
            # Only the charset and viewport metas the template writes; never http-equiv/refresh.
            values = {(k or "").lower(): v or "" for k, v in attrs}
            if "charset" in values:
                self.out.append('<meta charset="utf-8">')
            elif values.get("name", "").lower() == "viewport":
                self.out.append('<meta name="viewport" content="' + escape(values.get("content", ""), quote=True) + '">')
            return
        self.out.append("<" + tag + self._attributes(tag, attrs) + ">")
        if tag in VOID_TAGS:
            return
        self.stack.append(tag)
        if tag == "style":
            self.raw = "style"

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.skip:
            if tag == self.skip[-1]:
                self.skip.pop()
            return
        if tag not in self.stack:
            return
        while self.stack:
            open_tag = self.stack.pop()
            self.out.append("</" + open_tag + ">")
            if open_tag == "style":
                self.raw = None
            if open_tag == tag:
                break

    def handle_data(self, data):
        if self.skip:
            return
        if self.raw == "style":
            self.out.append(safe_css(data))
        else:
            self.out.append(escape(data, quote=False))

    # Comments, doctypes, processing instructions and CDATA are never re-emitted.
    def handle_comment(self, data): pass
    def handle_decl(self, decl): pass
    def handle_pi(self, data): pass
    def unknown_decl(self, data): pass

    def result(self):
        self.close()
        while self.stack:
            self.out.append("</" + self.stack.pop() + ">")
        return "".join(self.out)


def sanitize_showcase(html, remote_hosts=()):
    """Rebuild saved showcase HTML from the allowlist; returns markup without any script."""
    parser = _Sanitizer(frozenset(h.lower() for h in remote_hosts))
    parser.feed(html if isinstance(html, str) else "")
    return parser.result()


RUNTIME_SCRIPTS = ("/showcase-runtime.js?v=20261103", "/showcase-download.js?v=20261103")


def controlled_showcase(html, theme=None, remote_hosts=()):
    """Sanitized saved markup plus only the server's own scripts, pinned by a nonce CSP."""
    body = sanitize_showcase(html, remote_hosts)
    nonce = secrets.token_urlsafe(18)
    # Only scripts are pinned: in the sandboxed srcdoc the origin is opaque, so 'self' would also
    # refuse the page's own same-site images and styles.
    csp = ("script-src 'nonce-" + nonce + "'; object-src 'none'; base-uri 'none'; "
           "form-action 'none'; frame-src 'none'")
    head = ('<meta http-equiv="Content-Security-Policy" content="' + csp + '">'  # constant + url-safe nonce
            '<meta name="referrer" content="no-referrer">')
    # The saved page's own <style> must be parsed first: installShowcase reads its variables.
    theme_scripts = "" if theme is None else (
        '<script nonce="' + nonce + '" src="/character-colors.js?v=20261013"></script>'
        '<script nonce="' + nonce + '">HuiguanColors.installShowcase(' + theme + ');</script>')
    tail = "".join('<script nonce="' + nonce + '" src="' + src + '"></script>' for src in RUNTIME_SCRIPTS)
    if "<head>" in body and "</head>" in body:
        body = body.replace("<head>", "<head>" + head, 1).replace("</head>", theme_scripts + "</head>", 1)
    else:
        body = "<head>" + head + theme_scripts + "</head>" + body
    if "</body>" in body:
        body = body.replace("</body>", tail + "</body>", 1)
    else:
        body += tail
    return "<!DOCTYPE html>" + body
