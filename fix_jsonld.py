import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'"featureList": \[.*?\]', re.DOTALL)

replacement = '''"featureList": [
          "100% Local Processing (Zero server uploads)",
          "Distraction-free minimalist interface",
          "Instant Resume via IndexedDB offline cache",
          "Dark mode and brightness controls",
          "PDF and DOCX native parsing in-browser",
          "Local reading history and bookmarks",
          "Accessibility support for ADHD (distraction-free UI)",
          "Accessibility support for Eye Strain & Migraines (independent brightness, deep dark mode)",
          "Accessibility support for Autism and Dyslexia (unhurried, sensory-friendly design)"
        ]'''

new_content, count = pattern.subn(replacement, content)
print(f"Replaced {count} instances.")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
