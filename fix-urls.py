import os
import re

def walk(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                yield os.path.join(root, file)

modified = 0
for filepath in walk('src'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # We want to wrap uses of VITE_API_URL to strip 'undefined' strings safely without breaking the app.
    pattern1 = r'\(import\.meta(?: as any)?\)\.env\?\.VITE_API_URL'
    replacement1 = r"String((import.meta as any).env?.VITE_API_URL || '').replace('undefined', '')"
    
    pattern2 = r'(?<!\.)import\.meta\.env\.VITE_API_URL'
    
    content = re.sub(pattern1, replacement1, content)
    content = re.sub(pattern2, replacement1, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        modified += 1
        print(f"Patched {filepath}")

print(f"Successfully patched {modified} files.")
