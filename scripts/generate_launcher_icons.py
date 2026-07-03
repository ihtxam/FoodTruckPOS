#!/usr/bin/env python3
"""Build Android launcher icons from Chaslay POS logo (alpha-mask PNG)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "app/src/main/res"
SOURCE = ROOT / "assets/chaslay_logo_pos.png"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
BLACK = (0, 0, 0, 255)


def decode_alpha_logo(src: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Return (full black icon, transparent foreground) from alpha-only source."""
    src = src.convert("RGBA")
    full = Image.new("RGBA", src.size, BLACK)
    fg = Image.new("RGBA", src.size, (0, 0, 0, 0))
    full_pixels: list[tuple[int, int, int, int]] = []
    fg_pixels: list[tuple[int, int, int, int]] = []
    for _r, _g, _b, a in src.getdata():
        if a <= 8:
            full_pixels.append(BLACK)
            fg_pixels.append((0, 0, 0, 0))
        else:
            t = a / 255.0
            gray = int(255 * t)
            full_pixels.append((gray, gray, gray, 255))
            fg_pixels.append((255, 255, 255, a))
    full.putdata(full_pixels)
    fg.putdata(fg_pixels)
    return full, fg


def fit_square(img: Image.Image, size: int, pad_ratio: float = 0.08) -> Image.Image:
    pad = int(size * pad_ratio)
    inner = size - pad * 2
    fitted = img.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), img.getpixel((0, 0)))
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> None:
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    if not source_path.exists():
        print(f"Missing logo source: {source_path}")
        sys.exit(1)

    src = Image.open(source_path)
    full, fg = decode_alpha_logo(src)

    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)

    master_full = fit_square(full, 512, pad_ratio=0.06)
    master_fg = fit_square(fg, 512, pad_ratio=0.14)

    master_full.save(drawable / "chaslay_logo.png")
    master_fg.save(drawable / "ic_launcher_foreground.png")

    xml_fg = drawable / "ic_launcher_foreground.xml"
    if xml_fg.exists():
        xml_fg.unlink()

    for folder, px in SIZES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = fit_square(full, px, pad_ratio=0.06)
        icon.save(out_dir / "ic_launcher.png")
        icon.save(out_dir / "ic_launcher_round.png")
        print(f"Wrote {folder} ({px}px)")

    white_px = sum(1 for p in master_full.getdata() if p[0] > 50)
    print(f"chaslay_logo.png white pixels: {white_px}")
    print("Done.")


if __name__ == "__main__":
    main()
