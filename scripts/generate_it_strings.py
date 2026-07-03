#!/usr/bin/env python3
"""Generate Italian strings only, with retry/backoff."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "app/src/main/res/values/strings.xml"
TARGET = ROOT / "app/src/main/res/values-it/strings.xml"
SKIP_NAMES = {"app_name"}
PLACEHOLDER_RE = re.compile(r"%(\d+\$)?[sd]|%[sd]|%\.?\d*f")


def protect_placeholders(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def repl(match: re.Match[str]) -> str:
        tokens.append(match.group(0))
        return f"PH{len(tokens) - 1}TOKEN"

    return PLACEHOLDER_RE.sub(repl, text), tokens


def restore_placeholders(text: str, tokens: list[str]) -> str:
    for i, token in enumerate(tokens):
        text = text.replace(f"PH{i}TOKEN", token)
    return text


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("'", "\\'")
        .replace('"', '\\"')
    )


def translate(text: str) -> str:
    query = urllib.parse.quote(text)
    url = f"https://api.mymemory.translated.net/get?q={query}&langpair=en|it"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data.get("responseData", {}).get("translatedText", text)
        except urllib.error.HTTPError as err:
            if err.code == 429 and attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    return text


def main() -> None:
    root = ET.parse(SOURCE).getroot()
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>", '    <string name="app_name">ChaslayPOS</string>']
    count = 0
    for node in root.findall("string"):
        name = node.attrib["name"]
        if name in SKIP_NAMES:
            continue
        text = node.text or ""
        protected, tokens = protect_placeholders(text)
        translated = restore_placeholders(translate(protected), tokens)
        lines.append(f'    <string name="{name}">{escape_xml(translated)}</string>')
        count += 1
        print(f"it: {count}...")
        time.sleep(1.2)
    lines.extend(["</resources>", ""])
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {TARGET} ({count} strings)")


if __name__ == "__main__":
    main()
