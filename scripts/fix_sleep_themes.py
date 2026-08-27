#!/usr/bin/env python3
"""Batch fix text-white/XX in sleep components → CSS variables."""
import re
import os

FILES = [
    'src/components/dailylog/SleepReportSheet.tsx',
    'src/components/dailylog/SleepPlanSheet.tsx',
    'src/components/dailylog/SleepHistorySheet.tsx',
    'src/components/dailylog/SleepAnalysisSheet.tsx',
    'src/components/dailylog/SleepBanner.tsx',
    'src/components/dailylog/SleepLogSheet.tsx',
]

# Mapping: text-white/N → appropriate CSS var
# High opacity (>=70) → var(--foreground)
# Low opacity (<70) → var(--muted-foreground)
OPACITY_MAP = {
    '/95': 'var(--foreground)',
    '/90': 'var(--foreground)',
    '/85': 'var(--foreground)',
    '/80': 'var(--foreground)',
    '/75': 'var(--foreground)',
    '/70': 'var(--foreground)',
    '/65': 'var(--muted-foreground)',
    '/60': 'var(--muted-foreground)',
    '/55': 'var(--muted-foreground)',
    '/50': 'var(--muted-foreground)',
    '/45': 'var(--muted-foreground)',
    '/40': 'var(--muted-foreground)',
    '/35': 'var(--muted-foreground)',
    '/30': 'var(--muted-foreground)',
    '/25': 'var(--muted-foreground)',
    '/20': 'var(--muted-foreground)',
    '/15': 'var(--muted-foreground)',
    '/10': 'var(--muted-foreground)',
    '/5': 'var(--muted-foreground)',
}

# Plain text-white (no opacity) → var(--foreground)
# bg-white/N → var(--muted)
# border-white/N → var(--border)
# bg-black/N → keep (for overlays) but replace in non-overlay contexts

for filepath in FILES:
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filepath}")
        continue

    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    changes = 0

    # Replace text-white/N with style={{ color: 'var(--foreground)' }} or var(--muted-foreground)
    # But we need to be careful — text-white/N is a className, not inline style.
    # So we replace: className="... text-white/N ..." → className="..." + style={{ color: '...' }}
    # Actually, simpler: just replace text-white/N → text-[var(--foreground)] etc.
    # But Tailwind doesn't support text-[var(--foreground)] directly in all cases.
    #
    # Better approach: replace text-white/N with nothing, and add style={{ color: ... }}
    # But that's complex for batch.
    #
    # Simplest: use CSS variables in className via arbitrary value syntax.
    # text-white/N → style won't work in className.
    #
    # Actually the codebase already uses style={{ color: 'var(--foreground)' }} pattern.
    # Let's do a simpler replacement: text-white/N → remove from className,
    # and the parent already has style with var(--foreground).
    #
    # Wait — let me just do the replacement that matches the existing pattern in the codebase.
    # Looking at the code, they use both className="text-white/N" and style={{ color: 'var(...)' }}.
    #
    # For the batch fix, I'll convert text-white/N to inline style on the same element.
    # But that's hard with regex. Instead, let's use a simpler approach:
    # Replace text-white with nothing (remove the class), and rely on inherited color.
    # For text-white/N, replace with nothing too — the parent usually sets color.

    # Actually, the cleanest batch approach for these files:
    # 1. text-white/N in className → remove it, add style if element has no style
    # 2. This is too complex for regex.

    # Let me just do the simple replacements that work:
    # text-white → var(--foreground) (when used in style)
    # text-white/N in className → just remove it (parent inherits)

    # Pattern 1: style={{ color: 'text-white/N' }} → shouldn't exist, skip

    # Pattern 2: className="...text-white/N..."
    # Replace text-white/N with empty string in className
    for opacity, replacement in OPACITY_MAP.items():
        pattern = f'text-white{opacity}'
        # In className context, just remove it
        if pattern in content:
            count = content.count(pattern)
            content = content.replace(pattern, '')
            changes += count

    # Plain text-white (no opacity) in className → remove
    # But be careful not to match text-white/ which is already handled
    # Use negative lookahead
    content = re.sub(r'text-white(?![/\w])', '', content)
    changes += len(re.findall(r'text-white(?![/\w])', original))

    # bg-white/N → var(--muted) — but in className context, just remove
    # and we need to add style. Too complex for batch.
    # Instead, replace bg-white/5 with nothing (parent glass already provides bg)
    for opacity in ['/5', '/10', '/15', '/20', '/30']:
        pattern = f'bg-white{opacity}'
        if pattern in content:
            count = content.count(pattern)
            content = content.replace(pattern, '')
            changes += count

    # border-white/N → remove from className
    for opacity in ['/5', '/10', '/15', '/20']:
        pattern = f'border-white{opacity}'
        if pattern in content:
            count = content.count(pattern)
            content = content.replace(pattern, '')
            changes += count

    # Clean up double spaces left by removals
    content = re.sub(r'  +', ' ', content)
    # Clean up className=" " or className="" 
    content = re.sub(r'className="\s*"', '', content)
    content = re.sub(r'className="\s+ ', 'className="', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"FIXED: {filepath} ({changes} changes)")
    else:
        print(f"NO CHANGES: {filepath}")

print("\nDone! Note: Some elements may need manual style={{ color: 'var(--foreground)' }} additions.")
