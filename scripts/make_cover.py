"""Compose the DEV article cover (1000:420) from the generated art panel.

One-off, but kept so the cover is reproducible:
    python scripts/make_cover.py <art.png>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 2000, 840  # 1000:420 at 2x
CREAM = (251, 247, 236)
INK = (38, 48, 31)
GOLD = (201, 166, 75)
MOSS = (106, 124, 84)

FONTS = Path("C:/Windows/Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def main(art_path: str) -> None:
    art = Image.open(art_path).convert("RGB")

    # right panel: bottom-aligned cover-crop of the art (keeps grass + sprout)
    panel_w = 940
    scale = max(panel_w / art.width, H / art.height)
    resized = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    left = resized.width - panel_w
    top = resized.height - H
    panel = resized.crop((left, top, left + panel_w, top + H))

    cover = Image.new("RGB", (W, H), CREAM)
    cover.paste(panel, (W - panel_w, 0))

    d = ImageDraw.Draw(cover)

    # wordmark
    d.text((150, 236), "helio", font=font("palab.ttf", 168), fill=INK)
    wm_w = d.textlength("helio", font=font("palab.ttf", 168))
    d.line([(158, 452), (158 + wm_w * 0.32, 452)], fill=GOLD, width=5)

    d.text((150, 486), "proof of grass", font=font("palabi.ttf", 58), fill=MOSS)
    d.text(
        (150, 596),
        "an open-weight AI that gets you outside",
        font=font("FRABK.TTF", 33),
        fill=INK,
    )
    d.text(
        (150, 646),
        "— and refuses to believe you went",
        font=font("FRABK.TTF", 33),
        fill=INK,
    )

    out = ROOT / "submission" / "assets" / "cover.png"
    cover.save(out)
    print(f"wrote {out} ({cover.width}x{cover.height})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "vibe_images" / "helio-cover_1791661142352_b5994383.png"))
