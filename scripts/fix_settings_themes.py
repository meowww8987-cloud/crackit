#!/usr/bin/env python3
"""Batch fix SettingsTab theme issues → CSS variables."""
import re
import os

filepath = 'src/components/tabs/SettingsTab.tsx'

with open(filepath, 'r') as f:
    content = f.read()

original = content
changes = 0

# === REPLACEMENTS ===

# 1. text-white/N → remove from className (parent inherits var(--foreground))
OPACITY_MAP = {
    '/95': '', '/90': '', '/85': '', '/80': '', '/75': '', '/70': '',
    '/65': '', '/60': '', '/55': '', '/50': '', '/45': '', '/40': '',
    '/35': '', '/30': '', '/25': '', '/20': '', '/15': '', '/10': '', '/5': '',
}
for opacity in OPACITY_MAP:
    pattern = f'text-white{opacity}'
    if pattern in content:
        count = content.count(pattern)
        content = content.replace(pattern, '')
        changes += count

# Plain text-white → remove
content = re.sub(r'text-white(?![/\w])', '', content)
changes += len(re.findall(r'text-white(?![/\w])', original))

# 2. text-t-muted → style with var(--muted-foreground)
content = content.replace('text-t-muted', '')
changes += original.count('text-t-muted')

# 3. text-t-secondary → remove
content = content.replace('text-t-secondary', '')
changes += original.count('text-t-secondary')

# 4. text-t-primary → remove
content = content.replace('text-t-primary', '')
changes += original.count('text-t-primary')

# 5. bg-white/N → var(--muted) — remove from className
for opacity in ['/5', '/10', '/15', '/20', '/30']:
    pattern = f'bg-white{opacity}'
    if pattern in content:
        count = content.count(pattern)
        content = content.replace(pattern, '')
        changes += count

# bg-white/[0.03], bg-white/[0.06] etc
content = re.sub(r'bg-white/\[0\.\d+\]', '', content)

# 6. border-white/N → remove
for opacity in ['/5', '/10', '/15', '/20']:
    pattern = f'border-white{opacity}'
    if pattern in content:
        count = content.count(pattern)
        content = content.replace(pattern, '')
        changes += count

# 7. text-black → text-white (for colored buttons like bg-teal-500)
content = content.replace('text-black', 'text-white')
changes += original.count('text-black')

# 8. text-teal-400 → style color #0d9488
content = content.replace('text-teal-400', '')
content = content.replace('text-teal-300', '')
content = content.replace('text-teal-500', '')

# 9. text-amber-400 → remove
content = content.replace('text-amber-400', '')
content = content.replace('text-amber-500', '')

# 10. text-red-400 → remove
content = content.replace('text-red-400', '')
content = content.replace('text-red-500', '')

# 11. text-blue-400 → remove
content = content.replace('text-blue-400', '')
content = content.replace('text-blue-500', '')

# 12. text-purple-400 → remove
content = content.replace('text-purple-400', '')
content = content.replace('text-purple-500', '')

# 13. text-green-400 → remove
content = content.replace('text-green-400', '')

# 14. bg-teal-500 → keep (it's a colored button, fine)
# But bg-teal-500/10, bg-teal-500/15 → remove (use style instead)
for opacity in ['/10', '/15', '/20']:
    pattern = f'bg-teal-500{opacity}'
    if pattern in content:
        content = content.replace(pattern, '')

# 15. bg-purple-500 → keep (colored button)
# bg-purple-500/20 → remove
content = content.replace('bg-purple-500/20', '')
content = content.replace('bg-purple-500/15', '')

# 16. bg-indigo-500/15 → remove
content = content.replace('bg-indigo-500/15', '')
content = content.replace('bg-indigo-500/20', '')

# 17. bg-amber-500/15, bg-amber-500/20 → remove
content = content.replace('bg-amber-500/15', '')
content = content.replace('bg-amber-500/20', '')

# 18. bg-red-500/15, bg-red-500/20 → remove
content = content.replace('bg-red-500/15', '')
content = content.replace('bg-red-500/20', '')

# 19. bg-blue-500/15 → remove
content = content.replace('bg-blue-500/15', '')

# 20. border-teal-500/30, border-teal-500/50 → remove
content = content.replace('border-teal-500/30', '')
content = content.replace('border-teal-500/50', '')
content = content.replace('border-teal-500/25', '')

# 21. border-amber-500/30 → remove
content = content.replace('border-amber-500/30', '')

# 22. border-red-500/30 → remove
content = content.replace('border-red-500/30', '')

# 23. bg-gradient-to-b from-teal-400 → remove (use style)
content = content.replace('bg-gradient-to-b from-teal-400 to-teal-500/60', '')

# 24. shadow-lg shadow-purple-500/30, shadow-teal-500/30 → remove
content = content.replace('shadow-lg shadow-purple-500/30', '')
content = content.replace('shadow-lg shadow-teal-500/30', '')

# 25. bg-white → remove (plain, no opacity)
content = re.sub(r'(?<![/\w])bg-white(?![/\w])', '', content)

# Clean up double spaces and empty classes
content = re.sub(r'  +', ' ', content)
content = re.sub(r'className="\s*"', '', content)
content = re.sub(r'className="\s+ ', 'className="', content)
content = re.sub(r' className=" ', ' className="', content)

with open(filepath, 'w') as f:
    f.write(content)

print(f"Done! {changes} replacements made.")
