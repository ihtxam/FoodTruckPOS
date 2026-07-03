#!/usr/bin/env python3
from __future__ import annotations

import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "app/src/main/res/values/strings.xml"
TARGETS = {
    "fr": ROOT / "app/src/main/res/values-fr/strings.xml",
    "de": ROOT / "app/src/main/res/values-de/strings.xml",
    "it": ROOT / "app/src/main/res/values-it/strings.xml",
}
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


def translate(text: str, lang: str) -> str:
    if not text.strip():
        return text
    query = urllib.parse.quote(text)
    url = f"https://api.mymemory.translated.net/get?q={query}&langpair=en|{lang}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
    import json

    data = json.loads(payload)
    result = data.get("responseData", {}).get("translatedText", text)
    if result.upper() == text.upper():
        return text
    return result


def build_locale(lang: str) -> None:
    root = ET.parse(SOURCE).getroot()
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>", '    <string name="app_name">ChaslayPOS</string>']
    count = 0
    for node in root.findall("string"):
        name = node.attrib["name"]
        if name in SKIP_NAMES:
            continue
        text = node.text or ""
        protected, tokens = protect_placeholders(text)
        translated = translate(protected, lang)
        translated = restore_placeholders(translated, tokens)
        lines.append(f'    <string name="{name}">{escape_xml(translated)}</string>')
        count += 1
        if count % 20 == 0:
            print(f"{lang}: {count} strings...")
            time.sleep(1)
        else:
            time.sleep(0.15)
    lines.extend(["</resources>", ""])
    target = TARGETS[lang]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {target} ({count} strings)")


if __name__ == "__main__":
    for code in TARGETS:
        build_locale(code)
