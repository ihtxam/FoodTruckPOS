# -*- coding: utf-8 -*-
from pathlib import Path
import re

hits = []
for p in Path("dashboard/src").rglob("*"):
    if p.suffix not in {".tsx", ".ts"}:
        continue
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        # t() accidentally embedded inside a quoted string
        if re.search(r"['\"].*\{t\(", line) or re.search(r"['\"]t\(", line):
            # allow template literals that correctly interpolate
            if "${t(" in line:
                continue
            if "|| t(" in line or "? t(" in line or ": t(" in line:
                continue
            if line.strip().startswith("//"):
                continue
            hits.append(f"{p}:{i}: {line.strip()[:140]}")

print("\n".join(hits) if hits else "clean")
