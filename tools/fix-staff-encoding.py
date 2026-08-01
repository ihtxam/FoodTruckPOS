from pathlib import Path

p = Path("dashboard/src/pages/merchant/Staff.tsx")
t = p.read_text(encoding="utf-8")
replacements = [
    ('placeholder="4\u201d8 digits"', 'placeholder="4\u20138 digits"'),
    ("{s.pinSet ? 'Set' : '\u201d'}", "{s.pinSet ? 'Set' : '\u2014'}"),
    (" ? ' \u201d system profile'", " ? ' \u2014 system profile'"),
]
t2 = t
for old, new in replacements:
    if old not in t2:
        raise SystemExit(f"missing: {old.encode('unicode_escape')}")
    t2 = t2.replace(old, new)
p.write_text(t2, encoding="utf-8", newline="\n")
for i, line in enumerate(t2.splitlines(), 1):
    if any(ord(c) > 127 for c in line):
        print(i, line.encode("unicode_escape").decode())
print("ok")
