# Mai-Reads: UI redesign spec (for Antigravity)

Goal: restyle the existing Mai-Reads app to a minimal, premium look. Same features, same JS logic. Reference design: https://claude.ai/artifact/5Q68xR1NTT78NfNCsVyDAj (8 artboards).

## 0. Rules for the agent

1. Do not rename or remove existing element IDs, `data-*` attributes, or class names that `reader.js` / `notebook.js` / `sw.js` use. Restyle and re-nest only. If markup must move, keep the IDs.
2. Keep all existing SEO and PWA parts: `<title>`, meta description, Open Graph and Twitter tags, canonical, JSON-LD, `manifest.json`, `robots.txt` (no `noindex`), `sitemap.xml`, service worker. Move the long SEO article text on the home page into a collapsed `<details>` or into `docs.html`; do not delete it.
3. Vanilla HTML/CSS/JS only. No new framework. Self-host fonts or keep the Google Fonts `<link>` with `display=swap`.
4. Replace the contents of `assets/css/styles.css` and `assets/css/notebook.css` (and trim `docs.css` to the same tokens). Delete unused effects: ambient glow, dock blur islands, gradients, spring easing.
5. Respect `prefers-reduced-motion`. All transitions 150-200ms, `cubic-bezier(0.16,1,0.3,1)`.
6. Every interactive element: real `<button>` or `<a>`, visible focus ring (`outline: 2px solid var(--ink); outline-offset: 2px`), min hit area 44x44px, `aria-label` on icon-only buttons.
7. Mark logic that does not exist yet as NEW (section 8).

## 1. Design tokens

```css
:root {
  --bg: #F6F5F1;          /* app background */
  --surface: #FFFFFF;     /* cards, lists */
  --surface-2: #F1EFE8;   /* segmented track, skeletons */
  --reader-bg: #E8E6DF;   /* area around the paper */
  --paper: #FDFCF9;
  --paper-ink: #26241E;
  --ink: #15140F;
  --ink-2: #4F4D45;
  --muted: #6B685E;
  --line: #E3E0D6;
  --line-strong: #DAD7CC;
  --hl: #F3D56B;          /* highlighter */
  --danger: #A23B2B;      /* always paired with an icon + text */
  --radius-sm: 12px; --radius-md: 16px; --radius-lg: 20px; --radius-xl: 24px; --radius-pill: 999px;
  --shadow-paper: 0 1px 2px rgba(21,20,15,.06), 0 12px 40px rgba(21,20,15,.08);
  --shadow-float: 0 12px 32px rgba(21,20,15,.12);
  --font-ui: 'Geist', system-ui, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px); --sar: env(safe-area-inset-right, 0px);
}
:root[data-resolved-theme="dark"] {
  --bg: #151613; --surface: #1F201C; --surface-2: #292A25; --reader-bg: #121310;
  --paper: #22231E; --paper-ink: #DCD8CB;
  --ink: #E6E2D6; --ink-2: #C2BDB2; --muted: #A8A498;
  --line: #34352F; --line-strong: #44463E;
  --hl-dark-bg: rgba(243,213,107,.28); --hl-dark-ink: #F4EBCB;
  --shadow-paper: none; --shadow-float: 0 12px 32px rgba(0,0,0,.5);
}
```

Fonts: `Geist` 400/500/600, `Newsreader` 400/500 (opsz 6..72) plus italic 400.

Type scale (px): display 60 (mobile 44) serif 400, -0.025em, lh 1.04 / page title 48 (mobile 34) / card title 24 serif 500 / body 15-17 / label 13 / eyebrow 12 uppercase, 0.06em, `--muted`.

Paper text: serif 17px, lh 1.7 (mobile 16px / 1.65), color `--paper-ink`.

Brightness slider (55-100%) applies only to the paper via `filter: brightness(var(--paper-brightness))`. Theme and brightness stay independent. Keep both persisted in the existing `mai-reads-v1` localStorage object.

## 2. Shared components

| Component | Spec |
|---|---|
| Primary button | h 52 (mobile 56, radius 16), pill radius on desktop, bg `--ink`, text `--bg`, 15px/500, optional 17px icon left |
| Secondary button | same size, transparent, 1px `--line-strong`, text `--ink` |
| Icon button | 44x44, radius 12, transparent, hover `--surface-2`, 1.6px stroke icons 17-19px |
| Segmented control | track `--surface-2`, padding 3, radius 13; items h 38 (mobile 42), radius 10; selected = `--surface` (dark: `#3A3B34`) + 1px shadow, 500 weight; use `aria-pressed` |
| Range input | `accent-color: var(--ink)`, full width, always has `aria-label` or `<label for>` |
| Card | `--surface`, 1px `--line`, radius 18-20, no shadow |
| Key hint | mono 11px, 1px border, radius 6, `--muted`; desktop only |
| File badge | 34-36 x 42-44, radius 6, `--bg` fill, 1px `--line`, text `PDF`/`DOC` 10px/600 |
| Progress hairline | 3px high, track `#E9E6DC`, fill `--ink` |
| Toast | `#15140F` bg, light text, radius 14, bottom-center above safe area, `role="status"` |
| Wordmark | 26px rounded-square mark (ink fill, light "M" glyph) + "Mai-Reads" Newsreader 22/500 |

## 3. Home (`index.html` #welcome)

Desktop (fluid page, content max 640px centered):
- Header row (padding 20/40): wordmark left; right: History (`#history-toggle-welcome`, key hint H), Notebooks (link to `notebook.html`, key hint N), theme icon button (`#theme-toggle`). Remove the floating dock island and the Feedback/Install buttons from here.
- Hero: `h1` "Open a document." (display size), one-line sub "PDF or Word. It stays on this device, always.", then buttons: **Choose file** (primary, triggers `#welcome-open` / `#file-picker`) and **New notebook** (secondary, link). Under them: "or drop a file anywhere on this page" in 13px muted.
- "Continue reading" (eyebrow + "View all" text button that opens `#history-panel`): one white card with up to 3 rows: file badge, name (ellipsis), meta ("Page 42 of 310" / "Section 4 of 9" / "Finished"), 56px progress hairline, relative time. Rows are buttons that resume that document (existing history click handler).
- Under the list, one line with a lock icon: "Saved in this browser only. Reselect a file to resume if your browser clears it."
- Footer: Guide, Feedback, Install app (`.pwa-install-btn`, hidden when installed), Maithil Studios. Wrap on narrow screens.

Mobile (390x844):
- Header: wordmark + theme button, top padding `calc(var(--sat) + 12px)`.
- Hero left-aligned, display 44, full-width primary "Choose file" (h 56, radius 16).
- Continue reading list: 2 rows, each shows the hairline inline in the meta line.
- Bottom nav (Open / History / Notebooks), icon 21px over 11px label, item min-height 52, bottom padding `calc(var(--sab) + 6px)`, top border `--line`.

Empty state (no history): hide "Continue reading" entirely; show only the hero and the lock line.

## 4. Reader (`#reader`)

Desktop (>= 1100px): two-column flex. Left `#reading-surface` (flex 1, bg `--reader-bg`), right `#controls` docked panel 344px wide, `--bg`, 1px left border. When the panel is open the paper is centered in the remaining space, so the panel never covers text. Below 1100px the panel becomes a floating card/sheet (see mobile).

Reading area elements:
- **Document chip** (`#doc-title`): top-center, h 40, pill, `rgba(bg, .92)`, 1px `--line-strong`; file name (500, ellipsis, max 520px) and "42 / 310".
- **Paper** (`#paper`): width 620-720px on desktop, shadow `--shadow-paper`, padding 64/72. DOCX reflow uses the same typography.
- **Dock** (bottom-center, pill container radius 20, padding 6): icon buttons 44x44 for History, Find (`#search-toggle`), Highlighter, Bookmark (`#bookmark-add`), a 1px divider, then Controls toggle (`#control-toggle`, filled `--ink` when the panel is open). Auto-hides while scrolling, returns on tap/mouse move or Esc.
- **Selection toolbar** (`#selection-tooltip`): `--ink` bg, radius 14, padding 4; buttons "Highlight" (12px `--hl` swatch + label) and "Copy", h 36. Position above the selection; if there is less than 56px above, place it below.
- **Highlight bar** (`#highlight-bar`): replaces the old text bar; slim pill "Highlighter on" + **Done**.
- Highlights: `background: var(--hl)` on text; dark theme uses `--hl-dark-bg` with `--hl-dark-ink`.

Controls panel contents, in this exact order (padding 24, gap 22, scrolls vertically if the viewport is short):
1. Page readout: serif 34px current page + "of 310" muted, close icon button (`#close-controls`).
2. Page slider (`#page-slider`).
3. Zoom: label; `−` / `100%` (reset) / `+` as 44px buttons (`#zoom-out-btn`, `#zoom-value`, `#zoom-in-btn`); below, two equal chips **Fit width** and **Fit page** (NEW). Keep `#zoom` range (60-200) in the DOM; it may be visually hidden on desktop and shown on mobile sheet if needed.
4. Paper brightness (`#brightness`) with live percent.
5. Layout segmented: One page / Continuous (`.mode-button[data-mode]`).
6. Theme segmented: Light / Dark / System (replaces the single toggle; keep `#reader-theme-toggle` logic by mapping to the three values).
7. Rows (button + chevron, full width, min-height 46): Table of contents (`#outline`, expands inline), Bookmarks (count), Highlights (count, NEW list that jumps to each highlight).
8. Bottom block: primary **Export PDF with highlights** (`#download-pdf`), then three secondary buttons in a row: Full screen (`#fullscreen`), Open another (`#open-another`), Home (`#back-to-home`). Last line: "Read in this browser. Never uploaded." Move "Clear saved reading data" (`#clear-data`) into a small text button under that line.

Mobile reader (bottom sheet):
- Same chip at top (padding-top `calc(var(--sat) + 12px)`), paper margins 12px, side padding 26-28px.
- `#controls` becomes a bottom sheet: radius 24 24 0 0, handle 36x4, max-height 62vh, internal scroll, `padding-bottom: calc(var(--sab) + 14px)`, scrim `rgba(8,8,6,.35)` behind it; tap scrim or drag handle down to close.
- Sheet order: page readout + close, page slider, zoom stepper row with Fit width chip on the right, brightness, Layout segmented, Theme segmented, 4-up tool grid (Find, Highlight, Bookmark, Contents; each 64px tall, icon over 11px label), Export button.
- Controls open only on tap of the floating Controls button (bottom-right, 52x52, above `--sab`); nothing opens on scroll.

## 5. Notebooks library (`notebook.html`)

Desktop 1280:
- Header: back link (chevron + wordmark) to `index.html`, right: Feedback text button, theme icon button.
- Title block: `h1` "Notebooks" (48 serif) + sub "Bundle documents and notes. Stored on this device."; right: primary pill **New notebook**.
- Two columns that wrap (`flex-wrap`, list `flex: 999 1 560px`, detail `flex: 1 1 380px; max-width: 420px`).
- Notebook grid: 2 columns, gap 16. Card min-height 164, radius 20, padding 22: color dot (9px) + color name (12px muted), title serif 24/500, 14px description (2-line clamp), footer row "N documents" left / "Opened today" right. Selected card: 1.5px `--ink` border. Final tile: dashed 1.5px `#CFCBBE` border "Create notebook".
- Notebook colors (dots only): amber `#B8893A`, emerald `#4B7A5E`, indigo `#5560A8`, rose `#B45C6B`, slate `#5C6670`.
- Detail pane (white card, radius 24, padding 28): color + "Notebook", title serif 28, tabs segmented **Documents · N** / **Scratchpad**, document rows (badge, name, progress text), **Add documents** secondary button, bottom primary **Open notebook**, helper text. Below 900px the pane stacks under the grid.
- Create-notebook modal keeps existing fields (name, description, 5 color swatches); restyle: radius 24, 48px inputs, Cancel (secondary) + Save notebook (primary). Focus is trapped in the modal and Esc closes it.
- Empty state: centered serif "No notebooks yet", one-line sub, primary **Create notebook**.

## 6. Notebook reader (inside `#reader`, mobile reference)

- Tab strip (`#notebook-tabs-bar`): top, `--bg`, bottom border `--line`, padding-top `calc(var(--sat) + 12px)`. Tabs 44px high, radius 12, max-width 168 with ellipsis; active = `--ink` fill with light text. Horizontal scroll, scrollbar hidden, right-edge mask fade (`mask-image: linear-gradient(90deg,#000 85%,transparent)`). Add-document button 44x44 with 1px border sits outside the scroller.
- Binder (`#notebook-binder-panel`): bottom sheet on mobile, right-side 360px panel on desktop. Header: notebook color dot + "Notebook", title serif 22. Segmented Documents / Scratchpad. Scratchpad: textarea (`#binder-notes-area`, 16px font so iOS does not zoom, radius 16, white, 1px `--line-strong`), footer "Saved on this device" (`#binder-notes-status`) + **Download notes** (`#binder-export-notes-btn`).

## 7. Edge cases (implement all)

Desktop and mobile:
1. **Drag over window** (`#drop-overlay`): full-window `rgba(bg,.92)` with a 1.5px dashed ink rounded box, serif "Drop to open", "PDF or DOCX. Stays on your device." Hide on drag leave or drop.
2. **Unsupported file** (`#error`, `role="alert"`): alert icon + "Can't open <name>", "Mai-Reads reads PDF and Word (.docx) files. Export this one as PDF and try again.", **Choose another file**. Reject by extension and MIME before parsing.
3. **Password-protected PDF** (NEW): password input (labelled, show/hide) + **Unlock**. Wrong password: inline text error, keep field. Say "Used on this device only. Never saved." Never persist the password.
4. **One page fails to render**: inline placeholder in that page slot with "Page 12 couldn't be drawn" + **Try page again**; the rest stays scrollable.
5. **Large file** (`#loading`): show "Opening <name>" + 4px progress bar; render pages as they are ready and show **Read now** after the first pages exist.
6. **Scanned PDF** (NEW): when a page has no text layer, search shows "No text found. This PDF looks scanned, so Find and select-to-highlight can't read it. Draw still works." Select-to-highlight is disabled; freehand Draw stays available.
7. **Offline**: `navigator.onLine` false -> toast pill "You're offline. Reading and highlights still work." Dismiss when back online. App shell must load from the service worker.
8. **Storage full / IndexedDB write fails**: alert "Couldn't save for resume" + "Your browser is out of space. You can keep reading; reselect the file next time to pick up where you left off." Buttons **Clear old history** and **Dismiss**. Never block reading.
9. **Word document**: show "Reflowed from Word. Page numbers are estimates." in the controls panel; Export PDF button is `disabled` with `aria-describedby` text "Export works for PDF files. Highlights on Word files stay in the reader."
10. **Mobile keyboard**: Find bar pins above the on-screen keyboard using `visualViewport` (bottom offset = `innerHeight - visualViewport.height - visualViewport.offsetTop`). Result count "3 / 12" and prev/next 44px buttons live inside this bar only.
11. **Selection near top**: toolbar flips below the selection (see section 4).
12. **Pinch zoom**: while pinching show a centered pill with the live percent (e.g. "140%"), hide 600ms after release; keep the existing anchor-lock scroll math.
13. **Landscape + notch**: padding uses `--sal` / `--sar`; in landscape under 500px height the controls become a 96-120px right side panel instead of a bottom sheet.
14. **Very long file names**: single line with ellipsis everywhere; full name in `title` and as the sheet/panel heading (wrap to 2 lines max there).
15. **iOS install**: no `beforeinstallprompt` on iOS Safari. Show a small sheet "Add Mai-Reads to your Home Screen": 1) tap Share in Safari, 2) choose Add to Home Screen, **Got it**. Only show on iOS Safari when not standalone.
16. **Short viewports / zoomed browser**: panels scroll internally (`overflow-y: auto`), never clip. Use `100dvh`, not `100vh`.
17. **Reduced motion**: disable slide/fade transitions, keep instant state changes.

## 8. New logic needed (not just CSS)

- Fit width / Fit page zoom modes.
- Theme control with three values (light / dark / system), persisted.
- Highlights list in the controls panel.
- Password prompt for encrypted PDFs.
- Scanned-PDF detection (no text content) and its search message.
- Storage-failure handling and **Clear old history**.
- iOS install sheet.
- Dock auto-hide while scrolling and the mobile bottom sheet drag-to-close.
- Pinch-zoom percent indicator.

## 9. Acceptance checklist

- Lighthouse accessibility >= 95, no `noindex`, existing meta/JSON-LD intact.
- No horizontal scroll at 320px, 390px, 768px, 1280px, 1920px.
- All controls reachable by keyboard; Esc closes the panel/sheet/modal; Tab order follows visual order.
- Light, dark, and system themes all pass 4.5:1 text contrast.
- Every ID listed in section 0 rule 1 still exists and still works.
- Reader works fully offline after first load.

---

# PART 2: Design system rules for all future development

Everything below applies to any new feature, screen, or component added after the redesign. Treat this as the standing brief. If a request conflicts with it, follow this file and say so.

## 10. Design principles (in priority order)

1. **The document is the hero.** Reading space and the paper always win. Chrome (buttons, panels) is quiet, hides when not needed, and never covers text.
2. **One primary action per screen.** Exactly one filled `--ink` button visible at a time. Everything else is secondary (outlined) or a text button.
3. **Fewer things, better.** Before adding UI, try: remove something, merge two controls, or move it into an existing panel. New top-level buttons need a strong reason.
4. **Calm, not decorated.** No gradients, glow, glassmorphism, neon, emoji in UI, drop-shadow stacks, or animated backgrounds. Depth comes from 1px borders and one soft shadow on floating things only.
5. **Never a dead end.** Every error, empty, loading, and offline state has a message, a next action, and leaves reading usable.
6. **Private by default.** Nothing is uploaded. New features that touch data must keep that promise or must say clearly, before the action, what leaves the device.
7. **Same on every screen size.** Design phone first, then enlarge. Every feature must work with a thumb, a mouse, and a keyboard.

## 11. How to build something new (workflow for the AI)

Follow these steps in order for every new feature:

1. **Restate** the feature in one sentence and name the single primary action.
2. **Find the home**: pick the existing place it belongs (see 12). Only create a new screen if no home fits.
3. **Reuse components** from section 2. Compose new ones from the same tokens. Do not invent new colors, radii, font sizes, or shadows.
4. **Fill the state matrix** (section 13) before writing code.
5. **Design mobile first** (390x844), then desktop (1280x800). Check 320px width and 1920px width.
6. **Write the copy** using section 15.
7. **Implement** with semantic HTML, tokens only, no inline hex colors.
8. **Run the checklist** (section 17) and fix before finishing.
9. If you add or change a component, **update this file** (section 2 table or a new subsection).

## 12. Where new things go

| New thing | Goes in |
|---|---|
| Reading setting (font, margins, line height, spacing) | Reader controls panel, new row in the Layout area. Never a new floating button |
| Document action (share, print, rotate, extract) | Reader controls panel, bottom action block or overflow row |
| Quick, frequent tool (annotate, measure, bookmark-like) | Reader dock, only if used in most sessions; max 6 dock items total. Otherwise the panel |
| Selection action (define, translate, note) | Selection toolbar, max 4 buttons. More go into an overflow "..." button |
| List of things (notes, highlights, bookmarks) | Row in the panel that opens an inline list, or a sheet on mobile |
| Account, sync, or app-wide setting | A Settings sheet opened from the home header. Do not add a settings tab to the reader |
| New content type (EPUB, images, web pages) | Same file picker, same file badge with a new 3-4 letter code, same reader surface |
| Onboarding or tips | One dismissible toast or one-time sheet. Never a multi-step tour |
| Long explanation | `docs.html`, linked from a footer or a "Learn more" text button |

If a feature does not fit any row, ask the owner before inventing a new surface.

## 13. State matrix (required for every new feature)

Design and build all of these. A feature is not done until each cell has a decision.

| State | Must define |
|---|---|
| Default / idle | What shows before the user acts |
| Empty | No data yet: one line + one action |
| Loading | Skeleton or progress. Show only after 200ms. Reading never blocked |
| Success | Quiet confirmation (toast or inline check), auto-dismiss 3s |
| Error | What failed, why in plain words, one fix action, reading still works |
| Offline | Works offline, or says plainly what needs a connection |
| Permission denied / unavailable | Browser lacks the API: hide or disable the control with an explanation, never fail silently |
| Large data | 1,000+ items, 500+ pages, very long names: virtualize or paginate, ellipsis, no layout shift |
| Interrupted | Tab closed, refresh, storage cleared: state restores or degrades gracefully |
| Touch / mouse / keyboard | Hit targets 44px, hover only as enhancement, full keyboard path |
| Dark and light | Both checked for contrast |
| Reduced motion | Animations replaced by instant changes |

## 14. Layout and responsive rules

- Breakpoints: `<=520` phone, `521-899` tablet, `>=900` desktop, `>=1100` docked side panels.
- Phone: one column, bottom sheets for secondary UI (max 62vh, handle, scrim, drag to close), floating buttons sit above `env(safe-area-inset-bottom)`.
- Desktop: side panels dock beside content and reflow the page. They never overlay text.
- Content max widths: reading paper 620-720px, forms 480px, home hero 640px, grids up to 1100px.
- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 48, 64. Use only these.
- Use `min-height: 100dvh`, never `100vh`. Use flex/grid with `min-width: 0` so ellipsis works. Never fixed pixel widths on text containers.
- No horizontal page scroll at any width. Wide content (tables, code) scrolls inside its own container.
- Sticky and fixed elements account for notch and home indicator using the `--sat/--sab/--sal/--sar` tokens.
- Inputs use 16px font minimum so iOS does not auto-zoom.
- Keyboard open on mobile: pin the active input row above the keyboard with `visualViewport`; never let it hide behind it.

## 15. Copy and voice

- Plain, short, human. Sentence case everywhere (no Title Case, no ALL CAPS except the 12px eyebrow labels).
- Buttons are verbs: "Choose file", "Open notebook", "Try page again". Not "OK", "Submit", "Click here".
- Errors: say what happened, then what to do. "Can't open slides.pptx. Export it as PDF and try again." No error codes, no blame, no exclamation marks.
- Empty states: one fact + one action. "No bookmarks yet. Tap the bookmark icon on any page."
- Numbers and units: "42 of 310", "100%", "2h ago". Relative time up to 7 days, then a short date.
- Privacy line wording stays consistent: "Saved in this browser only." / "Never uploaded."
- No emoji, no slang, no hype words ("awesome", "magic", "supercharge").
- Confirm destructive actions with a specific label ("Delete notebook"), never a generic "Yes".

## 16. Components: how to extend

- **New button style?** No. Use primary, secondary, or text.
- **New icon?** 24px grid, 1.6px stroke, round caps and joins, `currentColor`, drawn inline as SVG. No icon fonts, no filled icons except the active dock item.
- **New list?** Card container, rows min-height 60px, 1px `--line` dividers between rows, file badge on the left, text block, meta on the right.
- **New sheet or modal?** Radius 24, padding 20-28, title serif 22-28, one primary + one secondary action at the bottom, focus trapped, Esc closes, returns focus to the trigger.
- **New segmented control?** Use for 2-4 mutually exclusive options. 5+ options use a list or select.
- **New toggle/switch?** 44x26 track, `--ink` when on, with a visible text label. Never a toggle without a label.
- **New form field?** Visible label above (13px), 46-48px high, radius 12, 1px `--line-strong`, focus border `--ink`, inline error text below with an icon.
- **New menu?** Max 7 items, 44px rows, icons optional, destructive item last and in `--danger`.
- **New toast?** One at a time, 3-5s, never covers the dock or the bottom sheet handle, has an action only if the action is essential (Undo).
- **Accent color:** the only accent is `--hl` (highlighter yellow), used for highlights and nothing else. UI chrome stays ink and neutrals. `--danger` always has an icon and text.
- **Notebook colors** are dots and small swatches only, never full backgrounds.

## 17. Quality checklist (run on every change)

Visual
- [ ] Only tokens used; no raw hex in components
- [ ] One primary button on screen
- [ ] Looks calm: nothing glows, bounces, or competes with the paper
- [ ] Consistent radii (12 / 16 / 20 / 24) and the spacing scale

Responsive
- [ ] 320, 390, 768, 1280, 1920 widths: no overflow, no clipped text, no overlaps
- [ ] Portrait and landscape phone, notch safe areas respected
- [ ] Short viewport (height 500px) and browser zoom 200%: panels scroll, nothing unreachable
- [ ] Mobile keyboard open: input visible

Behaviour
- [ ] Every state in section 13 handled
- [ ] Works offline after first load; no uncaught errors in console
- [ ] Large inputs (500-page PDF, 200-character file name) do not break layout or freeze the UI
- [ ] Back button, refresh, and reopening the app restore a sane state

Accessibility
- [ ] Keyboard-only path works; visible focus ring; logical tab order
- [ ] Icon buttons have `aria-label`; state buttons use `aria-pressed` / `aria-selected`
- [ ] Dynamic messages use `role="status"` or `role="alert"`
- [ ] 4.5:1 text contrast in light and dark; meaning never conveyed by color alone
- [ ] `prefers-reduced-motion` respected; touch targets >= 44px

Privacy and SEO
- [ ] Nothing uploaded; any new network call is documented here
- [ ] Meta tags, Open Graph, JSON-LD, `robots.txt` (no `noindex`), sitemap still valid
- [ ] New public pages get unique `<title>`, meta description, canonical, and Open Graph image

## 18. Motion

- Durations: 120ms for hover/press, 180ms for panels and sheets, 240ms max for anything. Easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- Allowed: fade, short slide (<= 16px for popovers, full height for sheets), width change on progress bars.
- Not allowed: bounce, spring overshoot, parallax, looping animations, auto-playing anything, animated backgrounds.
- Loading spinners only when progress is unknown and after 200ms; otherwise use a progress bar or skeleton.
- Always honor `prefers-reduced-motion: reduce` (instant state changes).

## 19. Performance rules

- First paint of home < 1s on a mid phone; defer heavy libraries (PDF.js, DOCX parser) until a file is chosen.
- Render only visible pages plus 1-2 neighbors; release canvases for far pages.
- Debounce slider and zoom work; use `requestAnimationFrame` for scroll handlers.
- Images and icons are inline SVG or tiny assets; no layout shift (reserve space).
- Fonts: `display=swap`, preload the two weights used above the fold.
- Never block the main thread for > 50ms on user input; move parsing to a Worker when possible.

## 20. Things the AI must never do

- Add sidebars, always-on toolbars, or banners that shrink the reading area.
- Add dashboards, stats, streaks, badges, or gamification.
- Use modals for things a toast, inline message, or sheet can do.
- Auto-open panels, tips, or popups on load or while the user is reading.
- Add colors, fonts, or shadows outside the tokens.
- Use placeholder-only labels, tiny (< 12px) text, or low-contrast gray text.
- Ship a feature without its empty, error, and offline states.
- Remove or rename working element IDs without updating all JS and this file.
- Add trackers, analytics, ads, or any request that sends document contents anywhere.
- Add dark patterns: fake urgency, pre-checked consent, hidden close buttons.

## 21. Prompt template for future requests

Copy this when asking an AI to build something new:

```
Read MAI-READS-UI-SPEC.md fully and follow Part 2 (sections 10-21).

Feature: <one sentence>
Primary action: <the one thing the user does>
Where it lives: <screen/panel, per section 12>
Platforms: phone and desktop
New data stored: <none / what, and where in the browser>
Needs network: <no / yes, why>

Do this in order:
1. Propose the placement and the state matrix (section 13) in a short table. Wait for my OK if anything is ambiguous.
2. Implement using only existing tokens and components.
3. Show me a before/after description and the files changed.
4. Run the section 17 checklist and report any item you could not verify.
5. Update MAI-READS-UI-SPEC.md if you added or changed a component.
```

## 22. Ready-made patterns for likely future features

Use these as defaults so new features look native.

- **Text size / font controls:** two rows in the controls panel: a stepper (A- / size / A+) and a segmented Serif / Sans. Applies to DOCX and reflowable content; PDF keeps zoom only.
- **Search across a notebook:** same Find bar, results grouped by document with file badge, tap jumps and highlights.
- **Notes attached to a highlight:** tap a highlight -> small popover (radius 14, `--surface`, 1px border) with a textarea and Delete. Notes appear in the Highlights list.
- **Sync / backup (optional):** a Settings sheet row "Back up to a file" first (export/import JSON). Cloud sync only if the owner asks, with explicit consent copy.
- **Reading stats:** one quiet line in History rows (progress hairline only). No charts or streaks.
- **Share:** native `navigator.share` on mobile, "Copy link" on desktop, as a row in the controls panel. Never share document contents.
- **New file types (EPUB, images, text):** same file badge style with a new code, same reader chrome, same edge cases (section 7), plus a "what this type can't do" line like the Word note.
- **Settings sheet:** sections as simple lists (Appearance, Reading, Data, About). Each row is a label + control; destructive items at the bottom with a confirmation.
- **Onboarding for a new feature:** one toast, once, with a "Got it" button. Remember dismissal in localStorage.
- **Keyboard shortcuts:** list in a sheet opened with `?`. Shortcuts shown as key hints on desktop only.
