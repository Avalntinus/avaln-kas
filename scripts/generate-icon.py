"""Dipakai untuk regenerasi aset ikon: python3 scripts/generate-icon.py"""
"""Generate ikon Avaln Kas v2: monogram A + meter, paper/emerald."""
from PIL import Image, ImageDraw

S = 4
INK = (18, 16, 14, 255)
ACCENT = (31, 111, 92, 255)
HAIRLINE = (232, 230, 225, 255)
BG = (250, 250, 248, 255)
BLACK = (0, 0, 0, 255)
LIGHT_INK = (245, 245, 245, 255)
DARK_ACCENT = (79, 169, 143, 255)
DARK_HAIRLINE = (38, 38, 38, 255)

# Geometri (kanvas 1024, mark sudah di tengah vertikal)
APEX = (512, 219)
BASE_L = (336, 727)
BASE_R = (688, 727)
LEG = 98
BAR_Y = 535
BAR_X1, BAR_X2 = 392, 632
BAR_H = 84
METER_Y1, METER_Y2 = 787, 805
METER_X1, METER_X2 = 336, 688
METER_FILL = 0.62


def draw_mark(draw, size, scale=1.0, center=(512, 512), a=INK, fill=ACCENT, track=HAIRLINE, meter=True):
    cx, cy = center
    f = (size / 1024) * S  # koordinat desain 1024 -> kanvas supersample

    def p(x, y):
        return ((cx + (x - 512) * scale) * f, (cy + (y - 512) * scale) * f)

    draw.line([p(*BASE_L), p(*APEX), p(*BASE_R)], fill=a, width=int(LEG * scale * f), joint="curve")
    draw.line([p(BAR_X1, BAR_Y), p(BAR_X2, BAR_Y)], fill=a, width=int(BAR_H * scale * f))

    if meter:
        x1, y1 = p(METER_X1, METER_Y1)
        x2, y2 = p(METER_X2, METER_Y2)
        r = (y2 - y1) / 2
        draw.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=track)
        draw.rounded_rectangle([x1, y1, x1 + (x2 - x1) * METER_FILL, y2], radius=r, fill=fill)


def make(size, bg=None, scale=1.0, color_mode="full", center=(512, 512)):
    img = Image.new("RGBA", (size * S, size * S), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if color_mode == "mono":
        draw_mark(d, size, scale, center, a=BLACK, fill=BLACK, track=BLACK)
    elif color_mode == "dark":
        draw_mark(d, size, scale, center, a=LIGHT_INK, fill=DARK_ACCENT, track=DARK_HAIRLINE)
    else:
        draw_mark(d, size, scale, center)
    return img.resize((size, size), Image.LANCZOS)


out = "assets/images"
make(1024, bg=BG).save(f"{out}/icon.png")
make(1024, bg=BG).save(f"{out}/android-icon-background.png")
make(1024, scale=0.80).save(f"{out}/android-icon-foreground.png")
make(432, scale=0.86, color_mode="mono").save(f"{out}/android-icon-monochrome.png")
make(512, scale=0.92).save(f"{out}/splash-icon.png")
make(512, scale=0.92, color_mode="dark").save(f"{out}/splash-icon-dark.png")

# pratinjau 512 + 96 + 48 untuk cek legibilitas
make(512, bg=BG).save("/tmp/opencode/icon-512.png")
make(96, bg=BG).save("/tmp/opencode/icon-96.png")
make(48, bg=BG).save("/tmp/opencode/icon-48.png")
print("selesai")
