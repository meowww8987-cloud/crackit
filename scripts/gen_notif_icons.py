"""Generate time-of-day themed notification icons for sleep state.

Creates 5 square icons (192x192) for different sleep time-of-day moods:
- night.png (10pm-5am): dark blue with crescent moon + stars
- dawn.png   (5am-7am):  purple-pink gradient with rising sun
- morning.png(7am-11am): light blue with bright sun + clouds
- noon.png   (11am-4pm): bright yellow with high sun
- dusk.png   (4pm-7pm):  orange-pink sunset
- evening.png(7pm-10pm): deep blue with first stars

Also creates a wide 450x270 sleep-scene.png with shooting stars
(for notification `image` field — large preview on Android).

Run: python3 scripts/gen_notif_icons.py
"""

import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = '/home/z/my-project/public/notif'
os.makedirs(OUT_DIR, exist_ok=True)

W, H = 192, 192


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def vertical_gradient(w, h, top_color, bottom_color):
    img = Image.new('RGB', (w, h), top_color)
    px = img.load()
    for y in range(h):
        c = lerp_color(top_color, bottom_color, y / max(1, h - 1))
        for x in range(w):
            px[x, y] = c
    return img


def draw_stars(draw, n, seed_color, w, h):
    import random
    random.seed(42)
    for _ in range(n):
        x = random.randint(8, w - 8)
        y = random.randint(8, h // 2)
        r = random.choice([1, 1, 2, 2, 3])
        alpha = random.choice([180, 200, 220, 255])
        draw.ellipse([x - r, y - r, x + r, y + r], fill=seed_color + (alpha,))


def draw_moon(draw, cx, cy, r, color=(240, 240, 220)):
    # Full disc
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    # Bite out a piece to make it a crescent
    draw.ellipse([cx - r // 2, cy - r, cx + r + r // 2, cy + r], fill=(0, 0, 0, 0))


def draw_sun(draw, cx, cy, r, color):
    # Soft halo via multiple concentric circles
    for i in range(6, 0, -1):
        a = 30 + (6 - i) * 20
        col = color + (a,)
        rr = r + i * 4
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    # Solid disc
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))


def make_icon(name, top_color, bottom_color, scene):
    img = vertical_gradient(W, H, top_color, bottom_color).convert('RGBA')
    draw = ImageDraw.Draw(img)
    scene(draw)
    out_path = os.path.join(OUT_DIR, f'{name}.png')
    img.save(out_path)
    print(f'  → {out_path}')


# === Night (10pm-5am) ===
def scene_night(draw):
    draw_stars(draw, 40, (255, 255, 240), W, H)
    draw_moon(draw, 140, 50, 26, color=(245, 245, 220))
    # Small shooting star
    draw.line([(20, 60), (50, 90)], fill=(255, 255, 255, 200), width=2)
    draw.ellipse([48, 88, 54, 94], fill=(255, 255, 255, 255))


# === Dawn (5am-7am) ===
def scene_dawn(draw):
    # Rising sun half-disc at bottom
    cx, cy, r = 96, 165, 50
    draw_sun(draw, cx, cy, r, (255, 180, 130))
    # Horizon line subtle
    draw.rectangle([0, 160, W, 192], fill=(80, 50, 100, 180))


# === Morning (7am-11am) ===
def scene_morning(draw):
    draw_sun(draw, 50, 50, 26, (255, 220, 110))
    # Small clouds
    for cx, cy in [(120, 60), (60, 110)]:
        draw.ellipse([cx - 18, cy - 8, cx + 18, cy + 8], fill=(255, 255, 255, 180))
        draw.ellipse([cx - 10, cy - 12, cx + 10, cy + 4], fill=(255, 255, 255, 200))


# === Noon (11am-4pm) ===
def scene_noon(draw):
    draw_sun(draw, 96, 60, 34, (255, 230, 90))


# === Dusk (4pm-7pm) sunset ===
def scene_dusk(draw):
    cx, cy, r = 96, 130, 36
    draw_sun(draw, cx, cy, r, (255, 140, 80))


# === Evening (7pm-10pm) ===
def scene_evening(draw):
    draw_stars(draw, 18, (220, 220, 255), W, H)
    draw_moon(draw, 50, 50, 18, color=(230, 230, 240))


print('Generating notification icons (192x192)...')
make_icon('night',   (8, 12, 50),    (30, 40, 90),   scene_night)
make_icon('dawn',    (90, 50, 110),  (255, 170, 130), scene_dawn)
make_icon('morning', (130, 190, 240),(220, 230, 240), scene_morning)
make_icon('noon',    (110, 180, 230),(220, 220, 220), scene_noon)
make_icon('dusk',    (180, 80, 70),  (255, 170, 100), scene_dusk)
make_icon('evening', (40, 30, 80),   (90, 60, 110),  scene_evening)


# === Wide sleep scene (450x270) for notification `image` field ===
print('Generating wide sleep scene (450x270)...')
SW, SH = 450, 270
img = vertical_gradient(SW, SH, (8, 12, 50), (30, 40, 90)).convert('RGBA')
draw = ImageDraw.Draw(img)

import random
random.seed(7)
# Twinkling stars
for _ in range(80):
    x = random.randint(10, SW - 10)
    y = random.randint(10, SH - 80)
    r = random.choice([1, 1, 2, 2, 3])
    a = random.choice([160, 200, 220, 255])
    draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, a))

# Moon
mx, my, mr = 360, 60, 32
draw.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(245, 245, 220, 255))
# Crescent cut
draw.ellipse([mx - mr // 2 - 5, my - mr, mx + mr + mr // 2 - 5, my + mr], fill=(8, 12, 50, 255))

# Multiple shooting stars (diagonal lines with bright heads)
shooters = [
    (60, 70, 130, 110),
    (200, 30, 260, 70),
    (300, 130, 360, 170),
]
for x1, y1, x2, y2 in shooters:
    # Trail (gradient line: faint → bright)
    for i in range(20):
        t = i / 19
        x = int(x1 + (x2 - x1) * t)
        y = int(y1 + (y2 - y1) * t)
        r = max(1, int(2 - t * 1.5))
        a = int(220 * t)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, a))
    # Head
    draw.ellipse([x2 - 3, y2 - 3, x2 + 3, y2 + 3], fill=(255, 255, 255, 255))

# Hills at the bottom (silhouette)
draw.polygon([(0, SH), (0, SH - 50), (60, SH - 70), (120, SH - 60), (200, SH - 90),
              (280, SH - 70), (360, SH - 80), (SW, SH - 60), (SW, SH)],
             fill=(5, 8, 30, 255))
draw.polygon([(0, SH), (0, SH - 25), (80, SH - 35), (160, SH - 30), (250, SH - 45),
              (350, SH - 30), (SW, SH - 40), (SW, SH)],
             fill=(15, 20, 60, 255))

scene_path = os.path.join(OUT_DIR, 'sleep-scene.png')
img.save(scene_path)
print(f'  → {scene_path}')

print('\nAll notification icons generated successfully.')
