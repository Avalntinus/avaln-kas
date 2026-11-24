"""Preview widget untuk picker Android (bukan render sebenarnya)."""
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 400
BG = (250, 250, 248)
INK = (18, 16, 14)
INK2 = (107, 104, 98)
INK3 = (168, 164, 156)
ACCENT = (31, 111, 92)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, W - 1, H - 1], radius=48, fill=BG)

bold = ImageFont.truetype("/usr/share/fonts/google-carlito-fonts/Carlito-Bold.ttf", 30)
label = ImageFont.truetype("/usr/share/fonts/google-carlito-fonts/Carlito-Regular.ttf", 22)
big = ImageFont.truetype("/usr/share/fonts/google-carlito-fonts/Carlito-Bold.ttf", 84)
small = ImageFont.truetype("/usr/share/fonts/google-carlito-fonts/Carlito-Regular.ttf", 26)

d.text((56, 56), "SISA HARI INI", font=label, fill=INK3)
d.text((52, 92), "Rp 30.000", font=big, fill=INK)
d.rectangle([56, 196, 56 + 210, 204], fill=ACCENT)
d.rectangle([56 + 210, 196, 56 + 330, 204], fill=(232, 230, 225))

d.text((560, 64), "Minggu", font=small, fill=INK3)
d.text((560, 100), "Rp 210.000", font=label, fill=INK2)

d.text((56, 300), "Avaln Kas", font=bold, fill=INK2)

img.save("assets/widget-preview/budget.png", "PNG")
print("preview saved")
