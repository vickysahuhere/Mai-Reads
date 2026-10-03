# Mai-Reads — product and implementation plan

## Product goal

Mai-Reads is a quiet, local-first reader for a person's own PDF and DOCX files. Opening a file should feel immediate; while reading, the document is the interface. The user chooses the file through the browser's file picker. Its contents are parsed and displayed on the device, without an account, server upload, or cloud library.

## Product principles

1. **Reading comes first.** Keep the welcome screen spare and hide the reader controls while the user scrolls.
2. **Local by default.** Keep document bytes in browser memory. Persist only reader preferences and small reading-position/bookmark metadata in local browser storage. Never send document contents to a service.
3. **Simple on the surface, useful on demand.** One floating control opens page, display, navigation, and file actions.
4. **Comfort belongs to the page.** Light/dark themes change the reading surface and controls; paper brightness is an independent setting that affects the document surface only.
5. **Accessible and predictable.** Keyboard operation, visible focus, useful labels, readable contrast, and reduced-motion support are part of the base experience.

## Visual direction

- Keep the existing warm paper palette and calm serif welcome heading.
- Welcome screen: “Mai-Reads”, a rounded/curved plus control, and “Open your document”. Do not add a file dashboard.
- Reader: centered paper, generous margins, muted surfaces, no persistent toolbar. During scrolling, controls close; the small control button remains available.
- Add a theme control in the expanded panel: **Light / Dark / System**. Save the user's choice locally. Dark mode should use a deep, warm charcoal reading surround and a soft charcoal paper with softened text, not invert colors blindly. Keep the paper-brightness slider available and independent in both themes.
- Use the existing labels and control style where possible; avoid icons without accessible names.

## Feature scope and order

### P0 — dependable first release

- Open local PDF and DOCX through one file picker; allow opening another document.
- Render PDFs with preserved page geometry and DOCX as readable, reflowable content.
- Continuous scroll and one-page-at-a-time scroll/snap modes.
- Current page/total and a page slider; no previous/next buttons.
- Floating compact control that expands to the full controls panel; panel hides when reading resumes.
- Paper-only brightness/dimming, with a clear percentage/value and no effect on the surrounding screen.
- Light, dark, and system theme choice; persist theme and brightness locally.
- Fullscreen reading mode, responsive layout, loading/error states, and clear unsupported-file feedback.
- Keyboard support: Tab/Shift+Tab through controls, Enter/Space activates buttons, Escape closes the panel/exits fullscreen, and browser scrolling keys continue to work.
- Privacy copy that accurately states files are processed on this device and are not uploaded.

### P1 — expected reader essentials

- **Find in document:** search extracted PDF/DOCX text, show result count, jump to and mark the matching text. Provide next/previous result actions only inside the search UI, not as page-navigation buttons.
- **Reading position:** restore the last page/scroll location for a previously opened file when the user selects it again. Key the local metadata using a stable file fingerprint where practical; explain that browsers require the user to reselect a local file and do not grant silent access to its storage.
- **Bookmarks:** save named page/position bookmarks locally, list and jump to them, and remove them.
- **Document outline:** expose PDF outline/table of contents when present and DOCX headings as a navigable outline.
- **Zoom and fit:** fit width / fit page and a simple zoom control, especially useful for PDFs and small screens.
- **DOCX page progress:** provide meaningful virtual page/position progress for reflowed DOCX content; do not claim Word's original page count is preserved.
- **Accessibility and comfort:** screen-reader semantics for pages and controls; respect system reduced-motion; provide text-size/line-width adjustments for reflowable DOCX content.

### P2 — only after the quiet core works well

- Optional read-aloud using browser speech services, with play/pause and speed controls.
- Optional PDF text selection and copy improvements; link and form handling where supported by the renderer.
- Optional installable offline app packaging and bundled dependencies, so the initial library fetch is not a runtime requirement.
- Optional import/export of bookmarks and preferences as a user-controlled local file.

### Explicitly out of scope for this reader

- Accounts, cloud sync, remote document storage, analytics, or server-side document processing.
- Editing DOCX/PDF, OCR for scanned pages, handwriting, annotations/highlighting, collaboration, or AI document chat in the first release.
- A complex library, folder browser, or automatic access to the user's storage. A website can only open files the user explicitly selects unless they grant browser-managed file access.

## User flows

### Open and read

1. User sees only the welcome title and curved plus/open-document control.
2. The operating system's file picker opens; user selects PDF or DOCX.
3. Mai-Reads parses the selected file locally, shows a short loading state, and opens directly into the document.
4. Scroll moves through pages. Reader controls hide during reading; the floating button reopens them.
5. User can move to a page with the slider, change layout, dim only the paper, change theme, enter fullscreen, or open another file.

### Resume later (P1)

1. On close/unload or at safe intervals, save a small local record of file fingerprint, position, and last-opened time.
2. On reselecting that same file, offer “Resume where you left off” and restore position.
3. Never store document bytes or claim that the browser can reopen an unselected file automatically.

## Technical approach

- Keep a static client-side app; no application server is required for document handling.
- Use Mozilla PDF.js for PDF parsing/rendering and Mammoth for DOCX-to-HTML conversion. Pin library versions; prefer bundling them for an offline-capable release and avoid sending file bytes to third-party services.
- Treat DOCX-to-HTML as untrusted content: sanitize generated markup, block remote images/content by default, and do not execute embedded scripts.
- Render large PDFs progressively and release canvas/render resources for far-off pages to control memory use.
- Use localStorage/IndexedDB only for UI preferences, position metadata, and bookmarks. Provide a “Clear saved reading data” option.
- Keep theme and page brightness separate in CSS/state. Store theme preference as `light`, `dark`, or `system`; store paper brightness independently.
- Use semantic HTML, accessible labels, focus management, and reduced-motion CSS.

## Acceptance checklist for P0

- [ ] Opening screen contains the welcome title and one prominent rounded plus/open control.
- [ ] Selecting a valid local PDF opens it and shows correctly rendered pages; selecting DOCX shows readable text and images supported by the converter.
- [ ] No document bytes are transmitted; the app has no upload/account flow.
- [ ] Scrolling changes the reading position and page readout; panel closes without interrupting scroll.
- [ ] Slider jumps to the selected page/position; no dedicated previous/next page buttons exist.
- [ ] One-page and continuous modes work at desktop and mobile widths.
- [ ] Brightness changes the page only; light/dark/system choices change the full app theme and persist after reload.
- [ ] Fullscreen works where supported and degrades gracefully where not.
- [ ] Unsupported/corrupt files produce a recoverable message and allow another selection.
- [ ] Controls are usable with keyboard, have accessible names, and remain legible in both themes.

## Delivery sequence

1. **Plan and decisions** — captured here; keep scope centered on local reading.
2. **P0 implementation** — stabilize the existing draft, add the dark/system theme, and fix document progress/layout behavior.
3. **P0 verification** — manually check representative short/long PDFs and DOCX files, keyboard interaction, both themes, resize, and local-only behavior.
4. **P1 essentials** — add search, position restore, bookmarks, outline, and zoom as separate small changes.
5. **Offline packaging** — bundle pinned dependencies and provide straightforward local launch instructions.

## Research references

- Mozilla PDF.js documents PDF page navigation, text search, zoom, and document outline behavior in its [viewer FAQ](https://github.com/mozilla/pdf.js/wiki/frequently-asked-questions) and describes its parsing/rendering layers in [Getting Started](https://mozilla.github.io/pdf.js/getting_started/?lang=en).
- Adobe's [PDF navigation and search guide](https://www.adobe.com/devnet-docs/acrobat/android/en/navigatesearch.html?highlight=recent) covers in-document search, immersive viewing, bookmarks, and table of contents. Its [bookmark guide](https://helpx.adobe.com/acrobat/mobile/view-manage-files/bookmark-page.html) describes bookmarks as a way to return to pages.
- Microsoft Word's [Immersive Reader guide](https://support.microsoft.com/en-us/accessibility/word/use-immersive-reader-in-word) supports the comfort options in this plan: minimized controls, text size/spacing, page color, line focus, and read-aloud. These are reference patterns, not a requirement to reproduce Word's full feature set.

## Current project state

The project includes a centered open control, increased space before the Maithil Studios card, a top-corner sun/moon theme toggle with interface-only light/dark styling, saved theme and brightness preferences, PDF/DOCX reading, page progress and slider, continuous/one-page layout, local position restore, page bookmarks, PDF/DOCX heading outline, text search, zoom, fullscreen, and safer handling of converted DOCX markup. Its SEO/AEO foundation now includes consistent Mai-Reads identity, descriptive metadata, WebApplication JSON-LD, visible product facts and FAQs, a social preview asset, and robots.txt access for OAI-SearchBot.

Remaining follow-up work: bundle dependencies for true offline use; improve exact PDF text highlighting; add optional read-aloud; set canonical, Open Graph URL/image metadata and create a sitemap after the production domain is known; and manually verify representative documents, browsers, themes, keyboard use, and responsive sizes before calling the release complete.
