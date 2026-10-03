# Mai-Reads

Mai-Reads is a minimal PDF and DOCX reader for focused reading and study. Open a document from your device and read in a calm interface, with controls available when you need them.

**Created by [Maithil Studios](https://maithilstudios.vercel.app/).**

## Features

- Open PDF and DOCX files using the browser's file picker.
- Read PDFs in continuous or one-page mode; DOCX pages reflow to fit the screen.
- Use the page slider, zoom, fullscreen, and in-document search. Zoom with the slider, a two-finger touchscreen pinch, or a laptop touchpad pinch gesture.
- Adjust document brightness independently of the interface theme.
- Switch the interface between light and dark mode from the welcome screen.
- Save reading positions and page bookmarks in the browser.
- Follow a PDF outline or DOCX heading list when one is available.
- Keep the reading surface quiet: controls hide while you read.

## Run locally

No build step, account, or backend is required.

1. Clone or download this repository.
2. Open `index.html` in a current browser.
3. Select **Open your document** and choose a PDF or DOCX file.

The first load needs an internet connection because PDF.js, Mammoth, and the fonts are loaded from CDNs. If your browser restricts local HTML files, serve the repository with a static file server and open its local address. For example, with Python installed:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Privacy and local data

Mai-Reads has no upload endpoint or document-storage service. The selected document is read in browser memory and the app does not send its contents to a Mai-Reads server. The reader libraries and fonts are fetched from third-party CDNs, so the page does make network requests for those assets.

The browser's local storage keeps display preferences, bookmarks, and reading-position metadata. The position record uses the file name, size, and last-modified time to recognize a document when you select it again. You must reselect the file to resume; the browser does not reopen it automatically. Clear saved data through the reader controls or your browser's site-data settings.

## Known limitations

- DOCX is converted to reflowable HTML, so its original Word pagination and some formatting may differ.
- Search shows text snippets and page locations; it does not highlight matching words on the rendered page.
- Scanned PDFs without selectable text are not searchable and are not OCR-processed.
- Reading and rendering libraries are CDN-hosted, so this version is not fully offline.
- The reader does not edit documents, save annotations into source files, or sync data between devices.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Welcome page, reader structure, metadata, and product FAQ |
| `styles.css` | Reader layout, themes, and responsive styling |
| `reader.js` | Local file loading, rendering, navigation, search, and saved state |
| `robots.txt` | Allows OAI-SearchBot, Googlebot, Bingbot, and general crawlers; points to the sitemap |
| `sitemap.xml` | Lists the production homepage for crawler discovery |
| `favicon.svg` | Orange app icon with an open-book mark |
| `social-preview.svg` | Social sharing preview artwork |
| `PLAN.md` | Product scope and implementation plan |

## Search discoverability

The homepage includes descriptive metadata, canonical and social URLs, WebApplication structured data, visible product information, and an FAQ. `robots.txt` allows OAI-SearchBot, Googlebot, Bingbot, and general crawlers. Search engines and answer engines decide independently whether to crawl, index, or cite a page; these files do not guarantee placement.

The production URL is `https://mai-reads.vercel.app/`. The social preview artwork is in `social-preview.svg` and is referenced by the Open Graph and Twitter metadata.

### Submit the site for indexing

1. Deploy the current project to Vercel and confirm these URLs load publicly: `/`, `/robots.txt`, `/sitemap.xml`, and `/social-preview.svg`.
2. Add and verify `https://mai-reads.vercel.app/` as a URL-prefix property in [Google Search Console](https://search.google.com/search-console/). Submit `https://mai-reads.vercel.app/sitemap.xml` in **Sitemaps**.
3. In Search Console, use **URL inspection** for `https://mai-reads.vercel.app/` and request indexing.
4. Add and verify the site in [Bing Webmaster Tools](https://www.bing.com/webmasters/about). Submit the sitemap and use URL Inspection to check crawl and index status. Bing also offers IndexNow for notifying participating search engines about updates.
5. Keep `OAI-SearchBot` allowed in `robots.txt`; it is OpenAI's crawler for ChatGPT Search. GPTBot is a separate crawler preference.

Submitting a sitemap or requesting a crawl is a discovery request, not a guarantee of indexing or ranking. Allow time for crawlers to revisit the deployed site.

## Roadmap

See [`PLAN.md`](PLAN.md) for the full scope. Future work includes bundling dependencies for offline use, improving search highlighting, and manually checking the reader across documents, browsers, and screen sizes.

## License

No license has been added yet. Until the repository includes one, all rights remain with the copyright holder and reuse is not automatically permitted.
