import re

with open('reader.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the typo caused by PowerShell expansion
typo_old = "Number(page-current.textContent)"
typo_new = "Number($('page-current').textContent)"

content = content.replace(typo_old, typo_new)

with open('reader.js', 'w', encoding='utf-8') as f:
    f.write(content)
