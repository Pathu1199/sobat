"""Draws the Sobat mark and writes every icon size the app needs.

The mark is two discs on a tilted bar: two together (सोबत means company), a
dumbbell, and two eyes looking up. Colours come from src/ui/theme.ts and the geometry
matches src/ui/Logo.tsx. Run with: python3 scripts/make-logo.py
"""
from PIL import Image, ImageDraw, ImageFilter

BG = (0x0F, 0x16, 0x1B)          # C.bgAlt
ACCENT = (0x2D, 0xD4, 0xA3)      # C.accent
CYAN = (0x38, 0xC6, 0xE8)        # C.cyan
WHITE = (255, 255, 255)
SS = 4                           # supersample for smooth edges

# Geometry in a unit square, so every size is the same picture.
A, B, R = (0.31, 0.61), (0.69, 0.39), 0.17
BAR_W = 0.11
EYE_OFF, EYE_R = (0.05, -0.05), 0.042


def gradient(size, bottom_left, top_right):
    """Diagonal gradient, bottom-left to top-right, matching the SVG."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + (size - 1 - y)) / max(1, 2 * (size - 1))
            px[x, y] = tuple(round(bottom_left[i] + (top_right[i] - bottom_left[i]) * t) for i in range(3))
    return img


def mark(size, scale=1.0, colour=None, shift=(0, 0), eyes=True):
    """The two discs and bar on a transparent square. `scale` shrinks it for icon safe zones."""
    s = size * SS
    layer = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(layer)

    def pt(p):
        return ((p[0] - 0.5) * scale + 0.5 + shift[0]) * s, ((p[1] - 0.5) * scale + 0.5 + shift[1]) * s

    ax, ay = pt(A)
    bx, by = pt(B)
    r = R * scale * s
    w = BAR_W * scale * s
    d.line([(ax, ay), (bx, by)], fill=255, width=int(w))
    for cx, cy in ((ax, ay), (bx, by)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        if eyes:
            ex, ey = cx + EYE_OFF[0] * scale * s, cy + EYE_OFF[1] * scale * s
            er = EYE_R * scale * s
            d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=0)

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
    g.ellipse([size * 0.5 - gr, size * 0.52 - gr, size * 0.5 + gr, size * 0.52 + gr], fill=ACCENT + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.16))
    bg.paste(glow, (0, 0), glow)
    out = bg.convert('RGBA')
    out.alpha_composite(mark(size, scale=0.8))
    return out


out = 'assets/images/'
big = tile(1024)
big.save(out + 'icon.png')
big.resize((48, 48), Image.LANCZOS).save(out + 'favicon.png')
# Android adaptive: the OS masks the outer third, so the mark sits in the middle 66%.
mark(512, scale=0.54).save(out + 'android-icon-foreground.png')
Image.new('RGBA', (512, 512), BG + (255,)).save(out + 'android-icon-background.png')
mark(512, scale=0.54, colour=WHITE).save(out + 'android-icon-monochrome.png')
mark(512, scale=0.86, colour=WHITE).save(out + 'splash-icon.png')
# iPhone home-screen icon and PWA manifest icons, served from public/.
big.resize((180, 180), Image.LANCZOS).save('public/apple-touch-icon.png')
big.resize((192, 192), Image.LANCZOS).save('public/icon-192.png')
big.resize((512, 512), Image.LANCZOS).save('public/icon-512.png')
print('wrote icons')
