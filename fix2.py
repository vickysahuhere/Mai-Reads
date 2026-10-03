import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Use regex to replace the dangling content until the footer
pattern = re.compile(r'<h2 id="about-mai-reads">About Mai-Reads</h2>.*?</section>', re.DOTALL)

replacement = '''<section class="seo-data sr-only" aria-labelledby="about-mai-reads">
      <h2 id="about-mai-reads">About Mai-Reads: The Privacy-First PDF & DOCX Reader</h2>
      <article>
        <p>Mai-Reads is a 100% local, lightning-fast, distraction-free document reader. We built it so you can open PDF and DOCX files securely in your browser with zero server uploads.</p>
        
        <h3>Accessibility & Medical Use Cases</h3>
        <p>Mai-Reads is intentionally designed to support readers with specific accessibility needs and medical conditions:</p>
        <ul>
          <li><strong>ADHD (Attention-Deficit/Hyperactivity Disorder):</strong> A completely distraction-free interface with hidden controls prevents attention loss and hyper-focus disruption.</li>
          <li><strong>Asthenopia (Digital Eye Strain) & Photophobia (Light Sensitivity):</strong> Independent paper brightness controls and a deep dark mode help readers with migraines, post-concussion syndrome, and severe eye strain.</li>
          <li><strong>Dyslexia & Processing Disorders:</strong> Clean, unhurried reading layouts (single-page or continuous) without ads or pop-ups reduce cognitive load.</li>
          <li><strong>Autism Spectrum Disorder (ASD):</strong> The minimalist, calm UI prevents visual sensory overload.</li>
        </ul>

        <h3>Features Designed for Focused Study</h3>
        <ul>
          <li><strong>Offline capabilities:</strong> Instant resume via IndexedDB cache.</li>
          <li><strong>Zero Data Collection:</strong> Total privacy. Your files never leave your device.</li>
          <li><strong>Minimalism:</strong> UI elements fade away, giving you absolute focus.</li>
        </ul>
        
        <h3>Frequently Asked Questions</h3>
        <details><summary>Is Mai-Reads completely private?</summary><p>Yes, all processing happens locally using browser-native technologies.</p></details>
        <details><summary>Does it support Word Documents?</summary><p>Yes, DOCX files are natively rendered locally.</p></details>
        <p>Developed by Maithil Studios.</p>
      </article>
    </section>'''

new_content, count = pattern.subn(replacement, content)
print(f"Replaced {count} instances.")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
