import re

with open('reader.js', 'r', encoding='utf-8') as f:
    content = f.read()

injection = '''
  const studioBtn = document.getElementById('studio-link-btn');
  if (studioBtn) {
    studioBtn.addEventListener('click', () => {
      if (confirm('Would you like to visit Maithil Studios in a new tab?')) {
        window.open('https://maithilstudios.vercel.app/', '_blank');
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed'));
    });
  }

  let resizeTimer;
'''

content = content.replace('  let resizeTimer;', injection)

with open('reader.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
