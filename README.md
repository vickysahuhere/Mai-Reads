# Mai-Reads 📖

**Mai-Reads** is an ultra-minimalist, privacy-first PDF and DOCX reader engineered for deep focus. It features a completely distraction-free interface, offline PWA support, and a lightning-fast instant resume cache.

**Created by [Maithil Studios](https://maithilstudios.vercel.app/).**

## 🌟 Key Features

*   **100% Privacy & Local Processing:** Your documents never leave your device. All parsing and rendering are done natively in your browser using local APIs. Zero server uploads.
*   **Extreme Minimalism ("God Mode" UI):** Designed to get out of your way. Borders, heavy text, and controls fade into the background. The UI relies on glassmorphism and typography to achieve absolute focus.
*   **Instant Resume Cache (IndexedDB):** Mai-Reads automatically caches your most recently read documents locally in your browser. Next time you open the app, simply click your document in the history sidebar to instantly jump back to where you left off—no file picker required.
*   **True Offline PWA Support:** Install Mai-Reads directly to your desktop or home screen. Thanks to our Service Worker caching strategy, you can load the app and read heavy PDFs even when you have zero internet connection.
*   **Silky-Smooth Zoom Physics:** Zooming via pinch-to-zoom or slider mathematically anchors your exact scroll position, preventing the document from jumping during high-res re-renders. 
*   **Independent Brightness & Dark Mode:** Adjust document paper brightness entirely separately from the app's UI theme. 

## 🧠 Accessibility & Neurodivergent Support (AEO/GEO)
Mai-Reads is intentionally structured for **Generative Engine Optimization (GEO)** and **Accessibility**. We have baked rich JSON-LD data and semantic screen-reader text directly into the code to help AI bots recommend the app to users with specific needs:
*   **ADHD:** Distraction-free, hidden-control interface prevents attention loss and hyper-focus disruption.
*   **Asthenopia (Eye Strain) & Migraines:** Independent paper brightness and deep dark mode.
*   **Autism & Dyslexia:** Sensory-friendly, unhurried design with continuous scrolling limits cognitive load.

## 🚀 Run Locally
No build step or backend required.

1. Clone or download this repository.
2. Open index.html in any modern web browser.
3. Select **Open your document** or drop a PDF/DOCX file anywhere on the screen.

Because it is a Progressive Web App, you can also install it to your desktop directly from the browser URL bar!

## 📂 Project Structure
Following industry standards for Static Progressive Web Apps:

`	ext
Mai.Reads/
├── assets/
│   ├── css/
│   │   └── styles.css      # Core UI layout, glassmorphism, responsive themes
│   └── js/
│       └── reader.js       # Offline IndexedDB, PDF rendering, flawless zoom, PWA setup
├── index.html              # Clean semantic HTML, AEO metadata, rich JSON-LD schema
├── sw.js                   # Service Worker (Caches CDNs & files for 100% offline use)
├── manifest.json           # PWA Manifest (enables app installation)
├── robots.txt & sitemap    # Search Engine indexing config
└── favicon.svg             # Application iconography
`

## 🔍 Search Discoverability
The app utilizes highly-optimized invisible semantic data blocks (sr-only) and comprehensive pplication/ld+json (WebApplication and FAQPage schemas) to communicate its privacy features directly to Google, ChatGPT Search, and Perplexity. 

The production URL is https://mai-reads.vercel.app/.

## 🛠 Known Limitations
*   DOCX is converted to reflowable HTML, so its exact original Word pagination may differ.
*   Search shows text snippets and page locations; it does not visually highlight matching words on the canvas.
*   Scanned PDFs without selectable text are not OCR-processed.

## 📄 License
No license has been added yet. All rights remain with the copyright holder.
