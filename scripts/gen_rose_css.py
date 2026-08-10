"""Generate the new Rose Quartz CSS block + force-dark-ui reset.

Outputs to /home/z/my-project/scripts/rose_css_output.txt for review.
"""

# Color palette (named)
MISTY_ROSE = "#FFE4E1"           # body bg
DARK_RASPBERRY = "#5A1A2E"       # primary text  rgb(90, 26, 46)
TUSCAN_RED = "#7C4848"           # secondary     rgb(124, 72, 72)
OLD_ROSE = "#C08081"             # muted         rgb(192, 128, 129)
ROSY_BROWN = (188, 143, 143)     # placeholder   rgb(188, 143, 143)
ROSE_PINK = "#D4738A"            # primary accent  rgb(212, 115, 138)
CHINA_ROSE = "#A8516E"           # secondary accent rgb(168, 81, 110)
PINK_PEARL = "#E8ACBF"           # tertiary/progress rgb(232, 172, 191)
ROSE_GOLD = "#B76E79"            # focus ring      rgb(183, 110, 121)

# RGB tuples for the named colors (for rgba() overrides)
DR = (90, 26, 46)        # Dark Raspberry
TR = (124, 72, 72)       # Tuscan Red
OR = (192, 128, 129)     # Old Rose
RB = (188, 143, 143)     # Rosy Brown
LP = (212, 175, 175)     # Light Pink (for very low opacity)
RP = (212, 115, 138)     # Rose Pink (accent)
CR = (168, 81, 110)      # China Rose (border tint)

# === Rose theme variables block ===
rose_vars = f"""/* ===== ROSE QUARTZ THEME — Rosy pink palette for long study sessions =====
 * Design goals:
 *  - UNMISTAKABLY PINK: Misty Rose bg + 5 shades of pink accents
 *  - HIGH READABILITY: pure white cards + Dark Raspberry text (WCAG AAA on white)
 *  - COHESIVE: monochrome pink palette (no clashing amber/sage)
 *  - 3D ANIMATION: pink-shaded atoms/DNA/molecules visible against pink-tinted bg
 * Named palette: Misty Rose / Dark Raspberry / Tuscan Red / Old Rose / Rosy Brown
 *                Rose Pink / China Rose / Pink Pearl / Rose Gold / Mauve Taupe
 */
.rose {{
  --ring-track: rgba({RP[0]}, {RP[1]}, {RP[2]}, 0.18);
  --ring-outer: {ROSE_PINK};
  --bar-track: rgba({PINK_PEARL[4:] if False else '232, 172, 191'}, 0.30);
  --card-bg: #ffffff;
  --bg-app: {MISTY_ROSE};
  --bg-card: #ffffff;
  --bg-card-solid: #ffffff;
  --bg-glass-strong: #ffffff;
  --text-primary: {DARK_RASPBERRY};
  --text-secondary: {TUSCAN_RED};
  --text-muted: {OLD_ROSE};
  --border-color: rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.22);
  --border-card: rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.26);
  --shadow-card: 0 2px 10px -2px rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.10);
  --shadow-strong: 0 8px 28px -4px rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.14);
  --background: oklch(0.97 0.018 350);
  --foreground: oklch(0.28 0.06 350);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.28 0.06 350);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.28 0.06 350);
  --primary: oklch(0.62 0.15 350);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.94 0.02 350);
  --secondary-foreground: oklch(0.35 0.06 350);
  --muted: oklch(0.94 0.02 350);
  --muted-foreground: oklch(0.55 0.05 350);
  --accent: oklch(0.92 0.03 350);
  --accent-foreground: oklch(0.35 0.06 350);
  --destructive: oklch(0.55 0.18 25);
  --border: oklch(0.88 0.02 350);
  --input: oklch(0.94 0.02 350);
  --ring: oklch(0.62 0.12 350);
}}
/* Body background — Misty Rose (clearly pink, distinct from Light's pure white) */
html.rose body {{
  background: {MISTY_ROSE} !important;
  background-attachment: fixed !important;
}}
/* Hide grid + noise overlays (visual clutter) — but LEAVE the 3D canvas visible
 * so the pink-shaded atoms/DNA/molecules animation shows. */
html.rose .grid-bg,
html.rose .aurora-noise,
html.rose .aurora-vignette {{
  display: none !important;
}}

/* === Text color overrides — Dark Raspberry (NOT brown) for max readability + pink identity ===
 * Graduating opacity ladder: Dark Raspberry → Tuscan Red → Old Rose → Rosy Brown → Light Pink
 */
.rose .text-white, .rose text-white {{ color: {DARK_RASPBERRY} !important; }}"""

# Generate text-white/N overrides (5-95 in steps of 5)
text_overrides = []
for n in [95, 90, 85, 80]:
    text_overrides.append(f".rose .text-white\\/{n} {{ color: rgba({DR[0]}, {DR[1]}, {DR[2]}, {n/100:.2f}) !important; }}")
for n in [75, 70, 65, 60]:
    text_overrides.append(f".rose .text-white\\/{n} {{ color: rgba({TR[0]}, {TR[1]}, {TR[2]}, {n/100 + 0.06:.2f}) !important; }}")
for n in [55, 50, 45]:
    text_overrides.append(f".rose .text-white\\/{n} {{ color: rgba({OR[0]}, {OR[1]}, {OR[2]}, {n/100 + 0.10:.2f}) !important; }}")
for n in [40, 35, 30, 25]:
    text_overrides.append(f".rose .text-white\\/{n} {{ color: rgba({RB[0]}, {RB[1]}, {RB[2]}, {n/100 + 0.12:.2f}) !important; }}")
for n in [20, 15, 10, 5]:
    text_overrides.append(f".rose .text-white\\/{n}  {{ color: rgba({LP[0]}, {LP[1]}, {LP[2]}, {n/100 + 0.10:.2f}) !important; }}")

# bg-white/N overrides — Rose Pink tint
bg_overrides = []
for n, alpha in [(5, 0.05), (10, 0.08), (15, 0.11), (20, 0.14), (30, 0.20)]:
    bg_overrides.append(f".rose .bg-white\\/{n} {{ background: rgba({RP[0]}, {RP[1]}, {RP[2]}, {alpha}) !important; }}")

# border-white/N overrides — China Rose / Mauve Taupe
border_overrides = []
for n, alpha in [(5, 0.14), (10, 0.22), (20, 0.32)]:
    border_overrides.append(f".rose .border-white\\/{n} {{ border-color: rgba({CR[0]}, {CR[1]}, {CR[2]}, {alpha}) !important; }}")

# Glass / cards / gradient-text / inputs / range
closing = f""".rose .ring-white\\/30 {{ --tw-ring-color: rgba({RP[0]}, {RP[1]}, {RP[2]}, 0.32) !important; }}

/* === Glass / cards — pure white with Mauve Taupe borders === */
.rose .glass {{
  background: #ffffff !important;
  border: 1px solid rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.20) !important;
  box-shadow: 0 2px 12px -2px rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.10), inset 0 1px 0 rgba(255,255,255,0.7) !important;
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}}
.rose .glass-strong {{
  background: #ffffff !important;
  border: 1px solid rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.24) !important;
  box-shadow: 0 8px 32px -4px rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.16), inset 0 1px 0 rgba(255,255,255,0.8) !important;
}}
.rose .card-solid {{
  background: #ffffff !important;
  border: 1px solid rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.18) !important;
  box-shadow: 0 2px 10px -2px rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.08), inset 0 1px 0 rgba(255,255,255,0.6) !important;
}}
.rose .card-tint {{
  mix-blend-mode: normal;
  opacity: 0.5;
}}
/* Gradient text — Rose Pink → China Rose (pure pink, no amber) */
.rose .gradient-text {{
  background: linear-gradient(135deg, {ROSE_PINK}, {CHINA_ROSE}) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
}}
.rose .grid-bg {{
  background-image: linear-gradient(rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.05) 1px, transparent 1px);
}}
.rose .bg-black\\/60 {{ background: rgba(255, 228, 225, 0.7) !important; }}
.rose .bg-black\\/70 {{ background: rgba(255, 228, 225, 0.8) !important; }}

/* === Inputs — Dark Raspberry text on white, Rose Gold focus ring === */
.rose input, .rose textarea, .rose select {{
  color: {DARK_RASPBERRY} !important;
  background: #ffffff !important;
  border-color: rgba({CR[0]}, {CR[1]}, {CR[2]}, 0.24) !important;
}}
.rose input::placeholder, .rose textarea::placeholder {{
  color: rgba({RB[0]}, {RB[1]}, {RB[2]}, 0.6) !important;
}}
.rose input:focus, .rose textarea:focus, .rose select:focus {{
  border-color: {ROSE_GOLD} !important;
  box-shadow: 0 0 0 3px rgba({ROSE_GOLD[1:] and '183, 110, 121'}, 0.18) !important;
  outline: none !important;
}}

/* Range sliders — Rose Pink track + thumb */
.rose input[type="range"] {{
  background: rgba({RP[0]}, {RP[1]}, {RP[2]}, 0.15) !important;
}}
.rose input[type="range"]::-webkit-slider-thumb {{
  border-color: {ROSE_PINK} !important;
  box-shadow: 0 2px 8px rgba({RP[0]}, {RP[1]}, {RP[2]}, 0.25) !important;
}}
.rose input[type="range"]::-moz-range-thumb {{
  border-color: {ROSE_PINK} !important;
}}

/* === Minimal-mode overrides for rose — keep cards pure white === */
.minimal-mode.rose {{
  --bg-app: {MISTY_ROSE};
  --bg-card: #ffffff;
  --bg-card-solid: #ffffff;
  --bg-glass-strong: #ffffff;
}}"""

# === force-dark-ui reset block ===
# This restores white-on-black UI for FocusTimer, Splash, SleepLockScreen
# regardless of which light theme is active (rose / light / warm).
force_dark_lines = ["""
/* ===== FORCE DARK UI — Focus Timer / Splash / Sleep Lock Screen =====
 * These full-screen overlays ALWAYS use pure black bg + white text.
 * The rose/light theme overrides above turn text-white dark, which would
 * make Focus Timer text invisible on its black background. This reset
 * restores the original white-on-black UI within .force-dark-ui scope.
 * (Dark themes don't override text-white, so this is a no-op for them.)
 */
html.rose .force-dark-ui .text-white,
html:not(.dark):not(.warm) .force-dark-ui .text-white { color: #ffffff !important; }"""]

# Reset all text-white/N to white with original opacity
for n in [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5]:
    alpha = n / 100
    force_dark_lines.append(
        f"html.rose .force-dark-ui .text-white\\/{n},\n"
        f"html:not(.dark):not(.warm) .force-dark-ui .text-white\\/{n} "
        f"{{ color: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

# Reset bg-white/N to white with original opacity
for n, alpha in [(5, 0.05), (10, 0.10), (15, 0.15), (20, 0.20), (30, 0.30)]:
    force_dark_lines.append(
        f"html.rose .force-dark-ui .bg-white\\/{n},\n"
        f"html:not(.dark):not(.warm) .force-dark-ui .bg-white\\/{n} "
        f"{{ background: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

# Reset border-white/N
for n, alpha in [(5, 0.05), (10, 0.10), (15, 0.15), (20, 0.20)]:
    force_dark_lines.append(
        f"html.rose .force-dark-ui .border-white\\/{n},\n"
        f"html:not(.dark):not(.warm) .force-dark-ui .border-white\\/{n} "
        f"{{ border-color: rgba(255, 255, 255, {alpha:.2f}) !important; }}"
    )

# Reset ring-white
force_dark_lines.append(
    "html.rose .force-dark-ui .ring-white\\/30,\n"
    "html:not(.dark):not(.warm) .force-dark-ui .ring-white\\/30 "
    "{ --tw-ring-color: rgba(255, 255, 255, 0.30) !important; }"
)

# Reset bg-black/N (FocusTimer uses bg-black/80 for hint)
for n, alpha in [(60, 0.6), (70, 0.7), (80, 0.8)]:
    force_dark_lines.append(
        f"html.rose .force-dark-ui .bg-black\\/{n},\n"
        f"html:not(.dark):not(.warm) .force-dark-ui .bg-black\\/{n} "
        f"{{ background: rgba(0, 0, 0, {alpha:.2f}) !important; }}"
    )

# Reset inputs inside force-dark-ui (FocusTimer has no inputs but just in case)
force_dark_lines.append(
    "html.rose .force-dark-ui input,\n"
    "html.rose .force-dark-ui textarea,\n"
    "html.rose .force-dark-ui select,\n"
    "html:not(.dark):not(.warm) .force-dark-ui input,\n"
    "html:not(.dark):not(.warm) .force-dark-ui textarea,\n"
    "html:not(.dark):not(.warm) .force-dark-ui select "
    "{ color: #ffffff !important; background: rgba(255,255,255,0.08) !important; }"
)

force_dark_block = "\n".join(force_dark_lines)

# === Assemble final CSS ===
final = rose_vars + "\n" + "\n".join(text_overrides) + "\n\n" + "\n".join(bg_overrides) + "\n\n" + "\n".join(border_overrides) + "\n" + closing + "\n" + force_dark_block + "\n"

with open("/home/z/my-project/scripts/rose_css_output.txt", "w") as f:
    f.write(final)

print(f"Generated {len(final)} chars of CSS")
print(f"  - {len(text_overrides)} text-white/N overrides")
print(f"  - {len(bg_overrides)} bg-white/N overrides")
print(f"  - {len(border_overrides)} border-white/N overrides")
print(f"  - {len(force_dark_lines)} force-dark-ui reset rules")
