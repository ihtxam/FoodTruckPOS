#!/usr/bin/env python3
"""Generate launcher PNGs with visible white house + fork/knife on black."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "app/src/main/res"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BLACK)
    d = ImageDraw.Draw(img)
    s = size / 108.0
    cx = size / 2

    def pt(x: float, y: float) -> tuple[float, float]:
        return (x * s, y * s)

    # House body
    body = [pt(30, 44), pt(78, 44), pt(78, 80), pt(30, 80), pt(30, 44)]
    d.line(body, fill=WHITE, width=max(2, int(3.5 * s)), joint="curve")

    # Roof
    roof = [pt(54, 24), pt(78, 44), pt(30, 44), pt(54, 24)]
    d.line(roof, fill=WHITE, width=max(2, int(3.5 * s)), joint="curve")

    # Door
    door = [pt(48, 80), pt(48, 62), pt(60, 62), pt(60, 80)]
    d.line(door, fill=WHITE, width=max(2, int(3 * s)), joint="curve")

    # Fork
    fx = 40 * s
    d.line([(fx, 48 * s), (fx, 72 * s)], fill=WHITE, width=max(2, int(2.8 * s)))
    for ox in (-3, 0, 3):
        d.line([(fx + ox * s, 48 * s), (fx + ox * s, 56 * s)], fill=WHITE, width=max(1, int(2 * s)))

    # Knife
    kx = 66 * s
    d.line([(kx, 48 * s), (kx, 72 * s)], fill=WHITE, width=max(2, int(2.8 * s)))
    d.line([(kx, 48 * s), (70 * s, 54 * s), (70 * s, 60 * s), (kx, 66 * s)], fill=WHITE, width=max(2, int(2.8 * s)))

    return img


def main() -> None:
    drawable = ROOT / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    master = draw_icon(512)
    master.save(drawable / "chaslay_logo.png")

    for folder, px in SIZES.items():
        out_dir = ROOT / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = draw_icon(px)
        icon.save(out_dir / "ic_launcher.png")
        icon.save(out_dir / "ic_launcher_round.png")
        print(f"Wrote {folder} ({px}px)")

    print("Done.")


if __name__ == "__main__":
    main()
