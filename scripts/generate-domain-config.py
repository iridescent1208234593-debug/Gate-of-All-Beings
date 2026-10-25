"""Generate the browser/Node copy of the explicit shared domain map."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / "shared/site-domains.json").read_text(encoding="utf-8"))
template = (ROOT / "shared/site-domains.template.js").read_text(encoding="utf-8")
output = template.replace("/* DOMAIN_CONFIG */", json.dumps(config, ensure_ascii=False, separators=(",", ":")))
target = ROOT / "shared/site-domains.js"
if "--check" in sys.argv:
    if not target.exists() or target.read_text(encoding="utf-8") != output:
        raise SystemExit("shared/site-domains.js needs regeneration")
else:
    target.write_text(output, encoding="utf-8")
