"""Draws the Dhyey mark and writes every icon size the app needs.

The mark is three rising steps and a dot at the foot of them: a small step
every day ("roz thoda, fit sada"), with the dot as the person about to
climb. One colour, flat, so the same drawing serves as the Android icon,
the web and iPhone icons, the splash and the desktop icon. The geometry
matches src/ui/Logo.tsx. Run with: python3 scripts/make-logo.py
"""
from PIL import Image, ImageDraw

TEAL = (0x1D, 0x9E, 0x75)        # the app's accent in light mode
WHITE = (255, 255, 255)
SS = 4                           # supersample for smooth edges

# Geometry in a 100-unit square, so every size is the same picture.
STEPS = [(18, 78), (36, 78), (36, 60), (54, 60), (54, 42), (72, 42), (72, 24)]
STROKE = 9
DOT, DOT_R = (76, 76), 8


def mark(size, scale=1.0, colour=WHITE):
    """The steps and the dot on a transparent square. `scale` shrinks it for icon safe zones."""
    s = size * SS
    layer = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(layer)

    def pt(p):
        return ((p[0] - 50) * scale + 50) / 100 * s, ((p[1] - 50) * scale + 50) / 100 * s

    w = STROKE * scale / 100 * s
    pts = [pt(p) for p in STEPS]
    d.line(pts, fill=255, width=int(round(w)), joint='curve')
    # Round caps: a disc at each end of the path.
    for cx, cy in (pts[0], pts[-1]):
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=255)
    dx, dy = pt(DOT)
    r = DOT_R * scale / 100 * s
    d.ellipse([dx - r, dy - r, dx + r, dy + r], fill=255)

    alpha = layer.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(Image.new('RGB', (size, size), colour), (0, 0), alpha)
    return out


def tile(size, scale=0.84):
    """Full-bleed icon: teal square, white mark. The OS rounds the corners itself."""
    out = Image.new('RGBA', (size, size), TEAL + (255,))
    out.alpha_composite(mark(size, scale=scale))
    return out


out = 'assets/images/'
big = tile(1024)
big.save(out + 'icon.png')
big.resize((48, 48), Image.LANCZOS).save(out + 'favicon.png')
# Android adaptive: the OS masks the outer third, so the mark sits in the middle 66%.
mark(512, scale=0.56).save(out + 'android-icon-foreground.png')
Image.new('RGBA', (512, 512), TEAL + (255,)).save(out + 'android-icon-background.png')
mark(512, scale=0.56, colour=WHITE).save(out + 'android-icon-monochrome.png')
mark(512, scale=0.86, colour=WHITE).save(out + 'splash-icon.png')
# iPhone home-screen icon and PWA manifest icons, served from public/.
big.resize((180, 180), Image.LANCZOS).save('public/apple-touch-icon.png')
big.resize((192, 192), Image.LANCZOS).save('public/icon-192.png')
big.resize((512, 512), Image.LANCZOS).save('public/icon-512.png')
# The Windows shell's icon.
big.save('desktop/src-tauri/icons/icon.png')
print('wrote icons')
