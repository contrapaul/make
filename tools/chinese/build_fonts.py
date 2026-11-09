#!/usr/bin/env python3
"""
build_fonts.py — produce the self-hosted woff2 files in fonts/ for tools/chinese.

Removes the site's dependency on fonts.googleapis.com (blocked on mainland home and
mobile networks) and puts the pinyin tone marks in a face that actually carries them.

One pass:
  1. download the four pinned upstream TTFs from google/fonts into .fonts-src/
  2. harvest the codepoints this site really draws (shared with font_coverage.py)
  3. subset, clamp the weight axes, pin the optical axes, compress to woff2
  4. write fonts/*.woff2, the OFL licences, README.md and manifest.json

Re-run any time the vocab grows. `python3 font_coverage.py` then proves nothing is missing.

    pip install fonttools brotli
    python3 build_fonts.py

Sources: google/fonts at pin GOOGLE_FONTS_SHA. Subset codepoints and per-file sizes are
recorded in fonts/manifest.json, so a byte-identical rebuild is checkable.
"""
import hashlib
import json
import shutil
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

from font_coverage import UI_CHROME, CONTENT_MARKS, rendered_codepoints, role_of

HERE = Path(__file__).resolve().parent
FONTS_DIR = HERE / "fonts"
CACHE_DIR = HERE / ".fonts-src"

GOOGLE_FONTS_SHA = "8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5"   # google/fonts, 2026-03-12
RAW_BASE = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_SHA}"

# The three loaded families. `stack` says which css/style.css token the face backs, which
# decides the subset: a latin face only ever needs latin codepoints, the CJK face carries
# every codepoint so it can also supply the ↕ ≡ ▼ that the latin faces lack.
FACES = [
    {"file": "noto-serif-sc.woff2", "family": "Noto Serif SC", "stack": "cjk",
     "source": "ofl/notoserifsc/NotoSerifSC[wght].ttf", "licence": "ofl/notoserifsc/OFL.txt",
     "wght": (400, 600), "pin": {}},
    {"file": "source-serif-4.woff2", "family": "Source Serif 4", "stack": "latin",
     "source": "ofl/sourceserif4/SourceSerif4[opsz,wght].ttf", "licence": "ofl/sourceserif4/OFL.txt",
     "wght": (400, 600), "pin": {"opsz": 14}},
    {"file": "source-serif-4-italic.woff2", "family": "Source Serif 4", "stack": "latin",
     "source": "ofl/sourceserif4/SourceSerif4-Italic[opsz,wght].ttf",
     "licence": "ofl/sourceserif4/OFL.txt", "wght": (400, 600), "pin": {"opsz": 14}},
    {"file": "instrument-sans.woff2", "family": "Instrument Sans", "stack": "ui",
     "source": "ofl/instrumentsans/InstrumentSans[wdth,wght].ttf",
     "licence": "ofl/instrumentsans/OFL.txt", "wght": (400, 600), "pin": {"wdth": 100}},
]
# Faces in the ui stack are used for UI text and for CJK chrome glyphs in the tabbar.
SUBSET_ROLES = {"latin": ("latin",), "cjk": ("latin", "cjk"), "ui": ("latin", "cjk")}
# Glyphs no source file contains but the site paints: the ↕ ≡ ▼ ≈ chrome marks that only the
# CJK face carries, and the ✓ × marks style.css draws with content:"". Forced into every
# subset so font_coverage.py's per-face checks can require them.
CHROME_EXTRA = set(UI_CHROME) | set(CONTENT_MARKS)


def ssl_context():
    """SSL context for urllib. python.org builds ship without system trust, so prefer
    certifi when it is installed. Run /Applications/Python*/Install Certificates.command
    once, or `pip install certifi`."""
    try:
        import ssl

        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def download(url_path):
    """Fetch one upstream file into the cache, cached across runs.

    The cache key carries the parent folder because three families all ship OFL.txt.
    """
    parts = Path(url_path).parts
    dest = CACHE_DIR / "_".join(parts[-2:])
    if not dest.exists():
        CACHE_DIR.mkdir(exist_ok=True)
        url = f"{RAW_BASE}/{url_path}"
        print(f"  fetch {url_path}")
        context = ssl_context()
        with urllib.request.urlopen(url, timeout=120, context=context) as resp:
            dest.write_bytes(resp.read())
    return dest


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def codepoints_for(face, points):
    roles = SUBSET_ROLES[face["stack"]]
    wanted = {cp for cp in points if role_of(cp) in roles}
    wanted |= CHROME_EXTRA          # chrome and CSS content marks, absent from the sources
    return wanted


def subset_face(face, points):
    src = download(face["source"])
    options = subset.Options()
    options.layout_features = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = False
    font = TTFont(str(src))       # eager load: instantiateVariableFont deepcopies tables
    font.recalcTimestamp = False  # head.modified is frozen, so rebuilds are byte-identical
    wanted = sorted(codepoints_for(face, points))
    target = subset.Subsetter(options=options)
    target.populate(unicodes=wanted)
    target.subset(font)
    # Clamp the weight range to what the CSS asks for, then freeze the remaining axes.
    # Subsetting first keeps the instancer working on a small glyph set; pinning opsz/wdth
    # first is what bloats the latin files, so both happen after the cut.
    wght_min, wght_max = face["wght"]
    axes = {**face["pin"], "wght": (wght_min, wght_max)}
    font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    out = FONTS_DIR / face["file"]
    font.flavor = "woff2"
    font.save(str(out))
    return src, out, len(wanted)


def write_licences():
    texts = {}
    for face in FACES:
        family = face["source"].split("/")[1]
        dest = FONTS_DIR / f"LICENSE-{family}.txt"
        if not dest.exists():
            shutil.copyfile(download(face["licence"]), dest)
        texts[family] = dest.name
    return texts


def write_manifest(files, licences, points):
    manifest = {
        "generated_by": "build_fonts.py",
        "source_repo": "https://github.com/google/fonts",
        "source_commit": GOOGLE_FONTS_SHA,
        "rendered_codepoints": len(points),
        "fonts": files,
        "licences": licences,
    }
    (FONTS_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main():
    points = rendered_codepoints()
    FONTS_DIR.mkdir(exist_ok=True)
    print(f"site draws {len(points)} unique codepoints")
    files = {}
    for face in FACES:
        src, out, count = subset_face(face, points)
        size = out.stat().st_size
        files[face["file"]] = {
            "family": face["family"], "stack": face["stack"], "source": face["source"],
            "weights": list(face["wght"]), "codepoints": count,
            "bytes": size, "source_sha256": sha256(src), "sha256": sha256(out),
        }
        print(f"  {face['file']}: {count} codepoints, {size / 1024:.0f} KB")
    licences = write_licences()
    write_manifest(files, licences, points)
    total = sum(f["bytes"] for f in files.values())
    print(f"total {total / 1024:.0f} KB across {len(files)} files")
    print("next: python3 font_coverage.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
