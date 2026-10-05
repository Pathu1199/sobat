"""Draws the Sobat mark and writes every icon size the app needs.

The mark is a ring and a dot side by side: सोबत means company, someone with
you. Colours come from src/ui/theme.ts. Run with: python3 scripts/make-logo.py
"""
from PIL import Image, ImageDraw, ImageFilter

BG = (0x0B, 0x0E, 0x17)          # C.bgAlt
ACCENT = (0x3B, 0x82, 0xF6)      # C.accent
CYAN = (0x22, 0xD3, 0xEE)        # C.cyan
WHITE = (255, 255, 255)
SS = 4                           # supersample for smooth edges

# Geometry in a 1000-unit square, so every size is the same picture.
RING_C, RING_R, RING_W = (0.44, 0.50), 0.215, 0.088
DOT_C, DOT_R = (0.735, 0.655), 0.095


def gradient(size, top, bottom):
    img = Image.new('RGB', (1, size))
    for y in range(size):
        t = y / max(1, size - 1)
        img.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((size, size))


def mark(size, scale=1.0, colour=None, shift=(0, 0)):
    """The ring and dot on a transparent square. `scale` shrinks it for icon safe zones."""
    s = size * SS
    layer = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(layer)

    def pt(p):
        return ((p[0] - 0.5) * scale + 0.5 + shift[0]) * s, ((p[1] - 0.5) * scale + 0.5 + shift[1]) * s

    cx, cy = pt(RING_C)
    r, w = RING_R * scale * s, RING_W * scale * s
    d.ellipse([cx - r - w / 2, cy - r - w / 2, cx + r + w / 2, cy + r + w / 2], fill=255)
    d.ellipse([cx - r + w / 2, cy - r + w / 2, cx + r - w / 2, cy + r - w / 2], fill=0)
    # A gap where the dot sits, so the two shapes read as touching, not overlapping.
    dx, dy = pt(DOT_C)
    dr = DOT_R * scale * s
    gap = dr + w * 0.42
    d.ellipse([dx - gap, dy - gap, dx + gap, dy + gap], fill=0)
    d.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=255)

    alpha = layer.resize((size, size), Image.LANCZOS)
    fill = Image.new('RGB', (size, size), colour) if colour else gradient(size, ACCENT, CYAN)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(fill, (0, 0), alpha)
    return out


def tile(size):
    """Full-bleed icon: dark background with a soft glow behind the mark."""
    bg = Image.new('RGB', (size, size), BG)
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    gr = int(size * 0.42)
    g.ellipse([size * 0.5 - gr, size * 0.56 - gr, size * 0.5 + gr, size * 0.56 + gr], fill=ACCENT + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.16))
    bg.paste(glow, (0, 0), glow)
    out = bg.convert('RGBA')
    out.alpha_composite(mark(size, scale=0.86))
    return out


out = 'assets/images/'
tile(1024).save(out + 'icon.png')
tile(1024).resize((48, 48), Image.LANCZOS).save(out + 'favicon.png')
# Android adaptive: the OS masks the outer third, so the mark sits in the middle 66%.
mark(512, scale=0.56).save(out + 'android-icon-foreground.png')
Image.new('RGBA', (512, 512), BG + (255,)).save(out + 'android-icon-background.png')
mark(512, scale=0.56, colour=WHITE).save(out + 'android-icon-monochrome.png')
mark(512, scale=0.9, colour=WHITE).save(out + 'splash-icon.png')
print('wrote icons')
