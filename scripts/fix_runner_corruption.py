#!/usr/bin/env python3
"""Fix corrupted patterns in PracticeRunner.tsx using regex.
The Write tool dropped '[h' from '[haptics' and '[m' from '[menuOpen' in useCallback deps.
"""

import re

path = '/home/z/my-project/src/components/practice/PracticeRunner.tsx'
with open(path, 'r') as f:
    content = f.read()

original = content

# Fix 'const enuOpen, setMenuOpen]' → 'const [menuOpen, setMenuOpen]'
content = re.sub(r'const enuOpen, setMenuOpen\]', 'const [menuOpen, setMenuOpen]', content)

# Fix '}, aptics, answerQuestion]);' → '}, [haptics, answerQuestion]);'
content = re.sub(r'\}, aptics, answerQuestion\]\);', '}, [haptics, answerQuestion]);', content)

# Fix '}, aptics, setSubAnswer]);' → '}, [haptics, setSubAnswer]);'
content = re.sub(r'\}, aptics, setSubAnswer\]\);', '}, [haptics, setSubAnswer]);', content)

# Fix '}, aptics, pausePractice]);' → '}, [haptics, pausePractice]);'
content = re.sub(r'\}, aptics, pausePractice\]\);', '}, [haptics, pausePractice]);', content)

# Fix '}, enuOpen]);' → '}, [menuOpen]);'
content = re.sub(r'\}, enuOpen\]\);', '}, [menuOpen]);', content)

if content == original:
    print('No changes made — patterns not found')
else:
    with open(path, 'w') as f:
        f.write(content)
    print('Fixes applied.')

# Verify
import subprocess
result = subprocess.run(['grep', '-nE', r'aptics\]|enuOpen\]', path],
                       capture_output=True, text=True)
print('Remaining corruption:')
print(result.stdout if result.stdout else '(none found)')
