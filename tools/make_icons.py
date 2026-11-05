# 產生 PWA 圖示：深灰號誌燈箱，三顆燈（紅亮、黃綠暗）
import os
from PIL import Image, ImageDraw

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')


def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), '#E9E6DD')
    d = ImageDraw.Draw(im)
    x0, x1 = pad * s, (1 - pad) * s
    h = (x1 - x0) * .42
    y0 = s / 2 - h / 2
    d.rounded_rectangle([x0, y0, x1, y0 + h], radius=h / 2, fill='#262A2E')
    r = h * .34
    cols = ['#FF4A3D', '#4A3A12', '#0F3A2C']
    for i, c in enumerate(cols):
        cx = x0 + (x1 - x0) * (i + .5) / 3
        d.ellipse([cx - r, s / 2 - r, cx + r, s / 2 + r], fill=c)
    # 紅燈上的 ✕
    cx = x0 + (x1 - x0) / 6
    k, w = r * .42, int(s * .022)
    d.line([cx - k, s / 2 - k, cx + k, s / 2 + k], fill='#fff', width=w)
    d.line([cx - k, s / 2 + k, cx + k, s / 2 - k], fill='#fff', width=w)
    return im.resize((size, size), Image.LANCZOS)


draw(192, .08).save(os.path.join(out, 'icon-192.png'))
draw(512, .08).save(os.path.join(out, 'icon-512.png'))
draw(512, .18).save(os.path.join(out, 'icon-maskable-512.png'))
