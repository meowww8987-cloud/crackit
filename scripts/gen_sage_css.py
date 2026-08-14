"""Generate the Sage Mist theme CSS block."""

# Sage Mist palette
WARM_MIST = '#E8EBE4'
CREAM_LINEN = '#F2F0E8'
SOFT_STONE_RGB = (120, 130, 110)
DEEP_FOREST = '#2D3A2E'
SAGE_GRAY_RGB = (92, 107, 90)
MISTY_OLIVE_RGB = (138, 149, 131)
MUTED_SAGE = '#7A9B76'
WARM_CLAY = '#C2856B'
DUSTY_GOLD = '#C9A961'

# RGB tuples for opacity ladder
DF = (45, 58, 46)         # Deep Forest
SG = (92, 107, 90)        # Sage Gray
MO = (138, 149, 131)      # Misty Olive
LP = (180, 190, 175)      # Light sage (for low opacity)

# CSS variables block
css = f"""/* ===== SAGE MIST THEME — Eye-comfort palette for long study sessions =====
 * Design goals:
 *  - LOW LUMINANCE CONTRAST: ~7:1 (WCAG AAA) — not pure black on pure white
 *  - WARM COLOR TEMPERATURE: zero pure blue/white, all colors shifted warm
 *  - DESATURATED PALETTE: ~40% less saturated than dark theme
 *  - NO VISUAL NOISE: grid + vignette + noise overlay hidden
 *  - SOFT FLOATING PARTICLES instead of sharp atoms/DNA
 *  - SOLID CARD BACKGROUNDS — no glassmorphism transparency
 *  - EARTH TONES replace neon — sage/terracotta/gold instead of electric blue/red/green
 * Named palette: Warm Mist / Cream Linen / Deep Forest / Sage Gray / Misty Olive
 *                Muted Sage / Warm Terracotta / Dusty Gold / Soft Stone
 */
.sage {{
  --ring-track: rgba(122, 155, 118, 0.18);
  --ring-outer: {MUTED_SAGE};
  --bar-track: rgba(201, 169, 97, 0.20);
  --card-bg: {CREAM_LINEN};
  --bg-app: {WARM_MIST};
  --bg-card: {CREAM_LINEN};
  --bg-card-solid: {CREAM_LINEN};
  --bg-glass-strong: {CREAM_LINEN};
  --text-primary: {DEEP_FOREST};
  --text-secondary: rgb({SG[0]}, {SG[1]}, {SG[2]});
  --text-muted: rgb({MO[0]}, {MO[1]}, {MO[2]});
  --border-color: rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.18);
  --border-card: rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.22);
  --shadow-card: 0 2px 8px -2px rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.08);
  --shadow-strong: 0 8px 28px -4px rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.12);
  --background: oklch(0.94 0.008 120);
  --foreground: oklch(0.30 0.02 120);
  --card: oklch(0.96 0.006 120);
  --card-foreground: oklch(0.30 0.02 120);
  --popover: oklch(0.96 0.006 120);
  --popover-foreground: oklch(0.30 0.02 120);
  --primary: oklch(0.62 0.06 130);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.92 0.01 120);
  --secondary-foreground: oklch(0.35 0.02 120);
  --muted: oklch(0.92 0.01 120);
  --muted-foreground: oklch(0.50 0.02 120);
  --accent: oklch(0.88 0.04 75);
  --accent-foreground: oklch(0.35 0.04 75);
  --destructive: oklch(0.55 0.14 35);
  --border: oklch(0.86 0.01 120);
  --input: oklch(0.92 0.01 120);
  --ring: oklch(0.62 0.06 130);
}}
/* Body background — flat Warm Mist (no busy gradients for eye comfort) */
html.sage body {{
  background: {WARM_MIST} !important;
  background-attachment: fixed !important;
}}
/* Hide ALL visual noise for calm reading environment */
html.sage .grid-bg,
html.sage .aurora-noise,
html.sage .aurora-vignette {{
  display: none !important;
}}

/* === Text color overrides — Deep Forest (warm dark green-charcoal) ===
 * All-pink opacity ladder: Deep Forest → Sage Gray → Misty Olive → Light Sage
 */
.sage .text-white, .sage text-white {{ color: {DEEP_FOREST} !important; }}"""

# Generate text-white/N overrides (5-95 in steps of 5)
text_overrides = []
for n in [95, 90, 85, 80]:
    text_overrides.append(f".sage .text-white\\/{n} {{ color: rgba({DF[0]}, {DF[1]}, {DF[2]}, {n/100:.2f}) !important; }}")
for n in [75, 70, 65, 60]:
    text_overrides.append(f".sage .text-white\\/{n} {{ color: rgba({SG[0]}, {SG[1]}, {SG[2]}, {n/100 + 0.06:.2f}) !important; }}")
for n in [55, 50, 45]:
    text_overrides.append(f".sage .text-white\\/{n} {{ color: rgba({MO[0]}, {MO[1]}, {MO[2]}, {n/100 + 0.10:.2f}) !important; }}")
for n in [40, 35, 30, 25]:
    text_overrides.append(f".sage .text-white\\/{n} {{ color: rgba({MO[0]}, {MO[1]}, {MO[2]}, {n/100 + 0.08:.2f}) !important; }}")
for n in [20, 15, 10, 5]:
    text_overrides.append(f".sage .text-white\\/{n}  {{ color: rgba({LP[0]}, {LP[1]}, {LP[2]}, {n/100 + 0.10:.2f}) !important; }}")

# bg-white/N overrides — Muted Sage tint
bg_overrides = []
for n, alpha in [(5, 0.05), (10, 0.07), (15, 0.10), (20, 0.13), (30, 0.18)]:
    bg_overrides.append(f".sage .bg-white\\/{n} {{ background: rgba(122, 155, 118, {alpha}) !important; }}")

# border-white/N overrides — Soft Stone
border_overrides = []
for n, alpha in [(5, 0.12), (10, 0.18), (20, 0.28)]:
    border_overrides.append(f".sage .border-white\\/{n} {{ border-color: rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, {alpha}) !important; }}")

# Closing block — glass / cards / gradient-text / inputs / sliders / minimal-mode
closing = f""".sage .ring-white\\/30 {{ --tw-ring-color: rgba(122, 155, 118, 0.30) !important; }}

/* === Glass / cards — Cream Linen with Soft Stone borders === */
.sage .glass {{
  background: {CREAM_LINEN} !important;
  border: 1px solid rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.20) !important;
  box-shadow: 0 2px 12px -2px rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.08), inset 0 1px 0 rgba(255,255,255,0.5) !important;
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
}}
.sage .glass-strong {{
  background: {CREAM_LINEN} !important;
  border: 1px solid rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.24) !important;
  box-shadow: 0 8px 32px -4px rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.12), inset 0 1px 0 rgba(255,255,255,0.6) !important;
}}
.sage .card-solid {{
  background: {CREAM_LINEN} !important;
  border: 1px solid rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.18) !important;
  box-shadow: 0 2px 10px -2px rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.06), inset 0 1px 0 rgba(255,255,255,0.5) !important;
}}
.sage .card-tint {{
  mix-blend-mode: normal;
  opacity: 0.4;
}}
/* Gradient text — solid Sage Gray (no gradients for eye comfort) */
.sage .gradient-text {{
  background: linear-gradient(135deg, {MUTED_SAGE}, {DUSTY_GOLD}) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
}}
.sage .grid-bg {{
  background-image: linear-gradient(rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.04) 1px, transparent 1px);
}}
.sage .bg-black\\/60 {{ background: rgba(232, 235, 228, 0.7) !important; }}
.sage .bg-black\\/70 {{ background: rgba(232, 235, 228, 0.8) !important; }}

/* === Inputs — Deep Forest text on Cream Linen, Dusty Gold focus ring === */
.sage input, .sage textarea, .sage select {{
  color: {DEEP_FOREST} !important;
  background: {CREAM_LINEN} !important;
  border-color: rgba({SOFT_STONE_RGB[0]}, {SOFT_STONE_RGB[1]}, {SOFT_STONE_RGB[2]}, 0.24) !important;
}}
.sage input::placeholder, .sage textarea::placeholder {{
  color: rgba({MO[0]}, {MO[1]}, {MO[2]}, 0.6) !important;
}}
.sage input:focus, .sage textarea:focus, .sage select:focus {{
  border-color: {DUSTY_GOLD} !important;
  box-shadow: 0 0 0 3px rgba(201, 169, 97, 0.15) !important;
  outline: none !important;
}}

/* Range sliders — Muted Sage track + thumb */
.sage input[type="range"] {{
  background: rgba(122, 155, 118, 0.15) !important;
}}
.sage input[type="range"]::-webkit-slider-thumb {{
  border-color: {MUTED_SAGE} !important;
  box-shadow: 0 2px 8px rgba(122, 155, 118, 0.20) !important;
}}
.sage input[type="range"]::-moz-range-thumb {{
  border-color: {MUTED_SAGE} !important;
}}

/* === Minimal-mode overrides for sage — keep cards Cream Linen === */
.minimal-mode.sage {{
  --bg-app: {WARM_MIST};
  --bg-card: {CREAM_LINEN};
  --bg-card-solid: {CREAM_LINEN};
  --bg-glass-strong: {CREAM_LINEN};
}}"""

# === force-dark-ui reset for Sage (same as Rose) ===
# Reuse the same reset rules — they apply to both .sage and html:not(.dark):not(.warm)
# We add .sage to the existing rules via additional selectors below
force_dark_lines = ["""
/* === FORCE DARK UI reset for Sage theme ===
 * (Same rules as Rose — copied here so FocusTimer/Splash/SleepLockScreen
 *  stay pure-black + white-text even when Sage light theme is active.)
 */
html.sage .force-dark-ui .text-white { color: #ffffff !important; }"""]

for n in [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5]:
    alpha = n / 100
    force_dark_lines.append(
        f"html.sage .force-dark-ui .text-white\\/{n} {{ color: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

for n, alpha in [(5, 0.05), (10, 0.10), (15, 0.15), (20, 0.20), (30, 0.30)]:
    force_dark_lines.append(
        f"html.sage .force-dark-ui .bg-white\\/{n} {{ background: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

for n, alpha in [(5, 0.05), (10, 0.10), (15, 0.15), (20, 0.20)]:
    force_dark_lines.append(
        f"html.sage .force-dark-ui .border-white\\/{n} {{ border-color: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

force_dark_lines.append(
    "html.sage .force-dark-ui .ring-white\\/30 { --tw-ring-color: rgba(255, 255, 255, 0.30) !important; }"
)

for n, alpha in [(60, 0.6), (70, 0.7), (80, 0.8)]:
    force_dark_lines.append(
        f"html.sage .force-dark-ui .bg-black\\/{n} {{ background: rgba(0, 0, 0, {alpha:.2f}) !important; }}"
    )

force_dark_lines.append(
    "html.sage .force-dark-ui input,\n"
    "html.sage .force-dark-ui textarea,\n"
    "html.sage .force-dark-ui select "
    "{ color: #ffffff !important; background: rgba(255,255,255,0.08) !important; }"
)

force_dark_block = "\n".join(force_dark_lines)

# === Assemble final CSS ===
final = (
    css + "\n" +
    "\n".join(text_overrides) + "\n\n" +
    "\n".join(bg_overrides) + "\n\n" +
    "\n".join(border_overrides) + "\n" +
    closing + "\n" +
    force_dark_block + "\n"
)

with open("/home/z/my-project/scripts/sage_css_output.txt", "w") as f:
    f.write(final)

print(f"Generated {len(final)} chars of CSS")
print(f"  - {len(text_overrides)} text-white/N overrides")
print(f"  - {len(bg_overrides)} bg-white/N overrides")
print(f"  - {len(border_overrides)} border-white/N overrides")
print(f"  - {len(force_dark_lines)} force-dark-ui reset rules")
