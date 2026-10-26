"""Find absolute URLs to the site's own roots outside the reviewed exceptions.

Code builds own-site URLs from packages/site-domains/domains.json or uses same-origin paths.
The exceptions below are deliberate: search/social metadata stays on the current
canonical root until a separately approved canonical switch, and provenance or
content records are data, not routing. Usage:
  python tools/domains/check-domain-hardcodes.py              # tracked source
  python tools/domains/check-domain-hardcodes.py DIR [DIR...] # built candidates
"""
from fnmatch import fnmatch
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
ROOTS = json.loads((ROOT / "packages/site-domains/domains.json").read_text(encoding="utf-8"))["roots"]
OWN_URL = re.compile(r"(?:https?|wss?)://(?:[a-z0-9-]+\.)*(?:" + "|".join(map(re.escape, ROOTS)) + r")\b", re.I)
TEXT_SUFFIXES = {".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".css", ".json", ".svg", ".txt", ".env", ".example"}
SOURCE_SCOPES = ("apps", "services", "packages", "tools")
EXCEPT_FILES = {
    "*.md": "documentation",
    "**/tests/**": "test fixtures exercise exact public hosts",
    "services/platform/tests/verify_portal.py": "route contract template, expanded to every approved root",
    "services/platform/tests/test_ingress_security.py": "ingress regression fixtures for the deployed canonical host",
    "tools/domains/check-domain-hardcodes.py": "this scanner",
    "packages/shared-data/worldview.json": "historical export kept as a data record",
    "apps/www/links.json": "editable homepage content seed; runtime copy is persistent data",
    "services/platform/.env.example": "example operator configuration",
    "apps/cards/scripts/inspect-sites.mjs": "operator inspection of the live canonical site",
    "apps/cards/scripts/verify-game.mjs": "operator inspection of the live canonical site",
}
EXCEPT_SNIPPETS = (
    re.compile(r'<link rel="canonical" href="https://iridescently\.xyz/[^"]*"'),
    re.compile(r'<meta property="og:image" content="https://(?:huiguan|oc)\.iridescently\.xyz/favicon\.png">'),
    # Character provenance in shared worldview data, in source and minified bundles.
    re.compile(r'"?sourceUrl"?:\s*"https://huiguan\.iridescently\.xyz/"'),
)


def _excepted(relative):
    return any(fnmatch(relative, pattern) or (pattern.startswith("**/") and fnmatch(relative, pattern[3:]))
               for pattern in EXCEPT_FILES)


def findings(files, base):
    result = []
    for file in files:
        relative = file.relative_to(base).as_posix()
        if file.suffix.lower() not in TEXT_SUFFIXES or _excepted(relative):
            continue
        text = file.read_text(encoding="utf-8", errors="replace")
        for pattern in EXCEPT_SNIPPETS:
            text = pattern.sub("", text)
        for number, line in enumerate(text.splitlines(), 1):
            for match in OWN_URL.finditer(line):
                result.append(f"{relative}:{number}: {match.group(0)}")
    return result


def source_files():
    names = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", *SOURCE_SCOPES], cwd=ROOT).decode("utf-8").split("\0")
    return [ROOT / name for name in names if name and (ROOT / name).is_file()]


def main(arguments):
    if arguments:
        result = []
        for directory in map(Path, arguments):
            directory = directory.resolve(strict=True)
            result += findings(sorted(path for path in directory.rglob("*") if path.is_file()), directory)
    else:
        result = findings(source_files(), ROOT)
    for line in result:
        print(line)
    print(json.dumps({"findings": len(result)}))
    return 1 if result else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
