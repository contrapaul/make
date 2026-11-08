#!/usr/bin/env python3
"""
font_coverage.py — audit that the fonts this site asks for can render every character
the site draws.

Failing test for PLAN-fonts.md F1, kept as a permanent gate: `python3 font_coverage.py`
exits 1 on any hard miss.

Rendered characters are harvested from js/*.js, *.html, js/*.json and the content:""
declarations of css/style.css. Comment text is dropped, it never reaches the screen.

Two roles, because a font stack resolves glyph by glyph:
  latin  everything outside the CJK ranges. Backed by the --latin and --ui stacks.
  cjk    CJK ideographs and CJK punctuation. Backed by the --cjk stack.

Checks, all hard:
  role coverage   every codepoint is covered by the union of faces in its stack
  pinyin integrity  every pinyin-range codepoint sits in each primary (non-tail) face of
                  --latin. A tail fallback face must never be what carries a tone mark.

Usage:
  python3 font_coverage.py                 # audit fonts/ against stacks in css/style.css
  python3 font_coverage.py --latin A.ttf B.ttf --cjk C.ttf
  python3 font_coverage.py --json          # machine-readable output
"""
import argparse
import json
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
SOURCE_GLOBS = ["js/*.js", "*.html", "js/*.json", "css/*.css"]
CONVERSATIONS = HERE.parent / "LearningChinese" / "conversations.md"

CJK = [range(0x3400, 0x4DBF + 1), range(0x4E00, 0x9FFF + 1), range(0x3000, 0x303F + 1),
       range(0xFF00, 0xFFEF + 1)]
# Latin Extended-A/B: macrons, carons, breve, ring. Everything pinyin needs.
PINYIN = [range(0x00C0, 0x024F + 1)]
SKIP_CODEPOINTS = {0xFE0F}                  # variation selector, zero width by design

# The only character harvested from a source file that no page ever paints: the speaking
# head in the conversations.md heading, which the card parser does not read. It is in no
# candidate face, so it stays exempt.
#
# ✅ ❌ ✕ are deliberately NOT exempt any more. They were dropped from the JS in favour of
# CSS marks, so any of them reappearing means a duplicated state mark: a hard failure.
CSS_CHROME = {
    0x1F5E3: "decorative speaking head (conversations.md heading, not parsed into cards)",
}
LINE_ART = {0x2500: "box drawing dash (JS comment separators only, never rendered)"}
# Chrome glyphs the latin faces lack and the CJK tail face answers by design.
UI_CHROME = {
    0x2195: "sort indicator ↕ (.sort-indicator inherits --latin)",
    0x2261: "menu toggle ≡ (.sidebar-toggle is a button on --ui)",
    0x25BC: "accordion arrow ▼ (.tool-row-arrow, .sidebar-toggle)",
    0x2248: "approximate ≈",
}
# Marks style.css paints with content:"". They appear in no source file, so build_fonts.py
# forces them into every subset and this audit requires them in each primary face.
CONTENT_MARKS = {
    0x2713: "correct mark ✓ (feedback bar ::before)",
    0x00D7: "incorrect mark × (feedback bar ::before)",
}


def strip_comments(text, suffix):
    """Remove text a browser never paints."""
    if suffix == ".js":
        return "\n".join(l for l in text.splitlines() if not l.strip().startswith("//"))
    if suffix == ".html":
        return re.sub(r"<!--.*?-->", "", text, flags=re.S)
    if suffix == ".md":
        return "\n".join(l for l in text.splitlines() if not l.strip().startswith(">"))
    if suffix == ".css":
        # Only what the stylesheet paints: the contents of content:"" declarations.
        return " ".join(re.findall(r'content:\s*["\']([^"\']*)["\']', text))
    return text


def source_files():
    paths = [p for pat in SOURCE_GLOBS for p in sorted(HERE.glob(pat))]
    if CONVERSATIONS.exists():
        paths.append(CONVERSATIONS)
    return paths


def rendered_codepoints():
    """Return {codepoint: (count, first file seen)} for every char the site draws."""
    seen = {}
    for path in source_files():
        for ch in strip_comments(path.read_text(encoding="utf-8"), path.suffix):
            cp = ord(ch)
            if cp < 0x20 or cp in SKIP_CODEPOINTS:
                continue
            hit = seen.setdefault(cp, [0, path.name])
            hit[0] += 1
    return {cp: (n, f) for cp, (n, f) in seen.items()}


def is_cjk(cp):
    return any(cp in r for r in CJK)


def is_pinyin(cp):
    return any(cp in r for r in PINYIN)


def role_of(cp):
    return "cjk" if is_cjk(cp) else "latin"


def font_cmap(path):
    font = TTFont(path, fontNumber=0, lazy=True)
    return set(font.getBestCmap().keys()), font


def stacks_from_css():
    """Map the --latin / --ui / --cjk stacks in css/style.css to fonts/ files.

    Each stack is split into `primaries` (faces we ship, ahead of the CJK face) and `tail`
    (the CJK face). The pinyin check must not let the tail rescue a primary, and chrome
    glyphs are only local if the CJK face sits before any system family, so that ordering
    is verified here rather than assumed.
    """
    css = (HERE / "css" / "style.css").read_text(encoding="utf-8")
    cjk_family = re.search(r'--cjk:\s*"([^"]+)"', css)
    if not cjk_family:
        return None
    cjk_name = cjk_family.group(1)
    declared = {}
    for family, filename in re.findall(
            r'font-family:\s*"([^"]+)"[^}]*?url\("\.\./fonts/([^"]+)"\)', css, flags=re.S):
        declared.setdefault(family, []).append(filename)
    roles = {}
    for role, token in (("latin", "latin"), ("ui", "ui"), ("cjk", "cjk")):
        stack = re.findall(rf'--{token}:\s*([^;]+);', css)
        if not stack:
            return None
        primaries, tail, seen_system = [], [], False
        for family in re.findall(r'"([^"]+)"', stack[0]):
            filenames = declared.get(family, [])
            if not filenames:
                seen_system = True
                continue
            if family == cjk_name and seen_system and role != "cjk":
                print(f"--{token}: {cjk_name} sits behind a system family, chrome glyphs "
                      "would come from the OS", file=sys.stderr)
                return None
            # One family can back several @font-face rules (roman + italic).
            # The cjk role has no tail: it is the face itself.
            bucket = tail if (family == cjk_name and role != "cjk") else primaries
            for filename in filenames:
                path = HERE / "fonts" / filename
                if not path.exists():
                    return None
                bucket.append(str(path))
        if not primaries:
            return None
        roles[role] = {"primaries": primaries, "tail": tail}
    return roles


def audit(roles_in, points):
    """Return per-role audit dicts plus the pinyin integrity failures."""
    out, pinyin_failures = {}, []
    for role, stack in roles_in.items():
        faces, coverage = {}, set()
        for path in stack["primaries"] + stack["tail"]:
            cmap, font = font_cmap(path)
            faces[font["name"].getDebugName(4) or Path(path).name] = cmap
            coverage |= cmap
        primary_coverage = set()
        for path in stack["primaries"]:
            primary_coverage |= font_cmap(path)[0]
        want_role = "cjk" if role == "cjk" else "latin"
        want = {cp: info for cp, info in points.items() if role_of(cp) == want_role}
        missing = {cp: info for cp, info in want.items() if cp not in coverage}
        hard = {cp: i for cp, i in missing.items()
                if cp not in CSS_CHROME and cp not in LINE_ART}
        delegated = {cp: i for cp, i in want.items()
                     if cp in UI_CHROME and cp not in primary_coverage}
        out[role] = {
            "faces": faces, "wanted": len(want), "hard": hard, "delegated": delegated,
            "exempt": {cp: i for cp, i in missing.items()
                       if cp in CSS_CHROME or cp in LINE_ART},
        }
        if role == "latin":
            # Pinyin lines take --latin first, and the feedback marks are painted by
            # --latin rules, so each latin primary must carry them itself. The --ui role
            # has no such duty: no UI string is pinyin, and the remove button is drawn.
            for path in stack["primaries"]:
                cmap, font = font_cmap(path)
                name = font["name"].getDebugName(4) or Path(path).name
                gaps = {cp: points[cp] for cp in want if is_pinyin(cp) and cp not in cmap}
                if gaps:
                    pinyin_failures.append((name, gaps))
                absent = {cp: (0, "css/style.css") for cp in CONTENT_MARKS if cp not in cmap}
                if absent:
                    pinyin_failures.append((name + " [CSS content marks]", absent))
    return out, pinyin_failures


def report(roles_in, points, as_json=False):
    roles, pinyin_failures = audit(roles_in, points)
    hard_total = sum(len(r["hard"]) for r in roles.values()) + sum(
        len(gaps) for _, gaps in pinyin_failures)
    if as_json:
        print(json.dumps({
            "verdict": "FAIL" if hard_total else "PASS",
            "rendered_codepoints": len(points),
            "roles": {
                role: {
                    "faces": {name: len(cmap) for name, cmap in r["faces"].items()},
                    "wanted": r["wanted"],
                    "hard_misses": {f"U+{cp:04X} {chr(cp)}": {"count": n, "file": f}
                                    for cp, (n, f) in sorted(r["hard"].items())},
                    "css_chrome": sorted(f"U+{cp:04X} {chr(cp)}" for cp in r["exempt"]),
                } for role, r in roles.items()
            },
            "pinyin_gaps": {name: sorted(f"U+{cp:04X} {chr(cp)}" for cp in gaps)
                            for name, gaps in pinyin_failures},
        }, ensure_ascii=False, indent=2))
        return 1 if hard_total else 0

    for role, r in roles.items():
        print(f"[{role}] {r['wanted']} codepoints needed, faces:")
        for name, cmap in r["faces"].items():
            print(f"  {name}: {len(cmap)} mapped codepoints")
        if r["exempt"]:
            print(f"  {len(r['exempt'])} glyph(s) left to CSS by design:")
            for cp, (n, _) in sorted(r["exempt"].items()):
                why = CSS_CHROME.get(cp) or LINE_ART.get(cp)
                print(f"    U+{cp:04X} {chr(cp)}  {n:,}x  {why}")
        if r["hard"]:
            print(f"  FAIL: {len(r['hard'])} rendered glyph(s) no {role} face can draw")
            for cp, (n, f) in sorted(r["hard"].items()):
                print(f"    U+{cp:04X} {chr(cp)}  {n:,}x  first seen in {f}")
        else:
            print(f"  ok: all {role} glyphs covered")
    delegated = sorted(roles["ui"]["delegated"] | roles["latin"]["delegated"]) \
        if "ui" in roles and "latin" in roles else []
    if delegated:
        print(f"\n{len(delegated)} UI mark(s) answered by the CJK face at the end of the stack:")
        for cp in delegated:
            print(f"  U+{cp:04X} {chr(cp)}  {UI_CHROME[cp]}")
    if pinyin_failures:
        print(f"\nFAIL: pinyin integrity ({len(pinyin_failures)} face(s) incomplete)")
        for name, gaps in pinyin_failures:
            chars = "".join(chr(cp) for cp in sorted(gaps))
            print(f"  {name}: missing {len(gaps)} pinyin codepoint(s): {chars}")
    print(f"\n{'FAIL' if hard_total else 'PASS'}: {hard_total} uncovered rendered glyph(s)")
    return 1 if hard_total else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--latin", nargs="+", help="files backing the --latin stack")
    ap.add_argument("--cjk", nargs="+", help="files backing the --cjk stack")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if args.latin or args.cjk:
        if not (args.latin and args.cjk):
            ap.error("--latin and --cjk must be given together")
        roles_in = {"latin": {"primaries": args.latin, "tail": []},
                    "cjk": {"primaries": args.cjk, "tail": []}}
    else:
        roles_in = stacks_from_css()
        if not roles_in:
            print("no fonts/ files match the stacks in css/style.css; run build_fonts.py",
                  file=sys.stderr)
            return 2
    return report(roles_in, rendered_codepoints(), args.json)


if __name__ == "__main__":
    sys.exit(main())
