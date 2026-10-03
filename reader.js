(() => {
  const $ = id => document.getElementById(id);
  const welcome = $('welcome'), reader = $('reader'), picker = $('file-picker');
  const surface = $('reading-surface'), pages = $('pages'), paper = $('paper');
  const controls = $('controls'), toggle = $('control-toggle'), slider = $('page-slider');
  const STORE = 'mai-reads-v1';
  let pdf = null, pageNodes = [], pdfTexts = [], mode = 'continuous', currentFile = null;
  let fileKey = '', docxMode = false, docxPageCount = 1, outlineItems = [];
  let saveTimer, renderToken = 0;
  const settings = readStore();
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function readStore() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
  function saveStore(update) { const value = { ...readStore(), ...update }; try { localStorage.setItem(STORE, JSON.stringify(value)); } catch {} }
  let themePreference = settings.theme || 'system';
  function applyTheme(theme) {
    themePreference = theme;
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
    $('theme-icon').textContent = dark ? '☾' : '☼';
    $('theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
    $('theme-toggle').title = `Switch to ${dark ? 'light' : 'dark'} mode`;
    document.querySelector('meta[name="theme-color"]').content = dark ? '#242522' : '#f4f0e8';
  }
  applyTheme(themePreference);
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.resolvedTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next); saveStore({ theme: next });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePreference === 'system') applyTheme('system'); });
  const savedBrightness = Number(settings.brightness ?? 100);
  $('brightness').value = savedBrightness; setBrightness(savedBrightness);
  function setBrightness(value) { paper.style.setProperty('--paper-brightness', Number(value) / 100); $('brightness-value').textContent = `${value}%`; }

  $('welcome-open').addEventListener('click', () => picker.click());
  $('open-another').addEventListener('click', () => picker.click());
  picker.addEventListener('change', async e => { const file = e.target.files?.[0]; if (file) await openFile(file); e.target.value = ''; });
  toggle.addEventListener('click', () => controls.classList.toggle('hidden'));
  $('close-controls').addEventListener('click', () => controls.classList.add('hidden'));
  $('brightness').addEventListener('input', e => { setBrightness(e.target.value); saveStore({ brightness: Number(e.target.value) }); });
  document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('fullscreen').addEventListener('click', async () => { try { if (!document.fullscreenElement) await reader.requestFullscreen(); else await document.exitFullscreen(); } catch {} });
  slider.addEventListener('input', () => scrollToPage(Number(slider.value)));
  $('zoom').addEventListener('input', e => { $('zoom-value').textContent = `${e.target.value}%`; paper.style.setProperty('--doc-zoom', Number(e.target.value) / 100); });
  $('zoom').addEventListener('change', () => { if (pdf) redrawPdf(); });
  $('search-toggle').addEventListener('click', () => { $('search-box').classList.toggle('hidden'); if (!$('search-box').classList.contains('hidden')) $('search-input').focus(); });
  $('search-input').addEventListener('input', runSearch);
  $('bookmark-add').addEventListener('click', addBookmark);
  $('clear-data').addEventListener('click', () => {
    if (!confirm('Clear saved themes, brightness, reading positions, and bookmarks for Mai-Reads?')) return;
    try { localStorage.removeItem(STORE); } catch {}
    applyTheme('system'); $('brightness').value = '100'; setBrightness(100); $('bookmark-list').replaceChildren();
  });
  surface.addEventListener('scroll', () => {
    controls.classList.add('hidden');
    clearTimeout(saveTimer); saveTimer = setTimeout(() => { updateCurrentPage(); savePosition(); }, 160);
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !controls.classList.contains('hidden')) controls.classList.add('hidden');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !reader.classList.contains('hidden')) { e.preventDefault(); $('search-box').classList.remove('hidden'); $('search-input').focus(); }
  });

  async function openFile(file) {
    const token = ++renderToken;
    currentFile = file; fileKey = `${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
    welcome.classList.add('hidden'); reader.classList.remove('hidden'); $('loading').classList.remove('hidden'); $('error').classList.add('hidden');
    pages.replaceChildren(); pageNodes = []; pdfTexts = []; pdf = null; outlineItems = []; docxMode = false;
    surface.scrollTop = 0; $('doc-title').textContent = file.name;
    $('outline').classList.add('hidden'); $('bookmark-list').replaceChildren(); $('search-results').replaceChildren(); $('search-input').value = '';
    try {
      const bytes = await file.arrayBuffer();
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') await renderPdf(bytes, token);
      else if (/\.docx$/i.test(file.name) || file.type.includes('wordprocessingml')) await renderDocx(bytes, token);
      else throw new Error('Please choose a PDF or DOCX document.');
      if (token !== renderToken) return;
      await new Promise(resolve => requestAnimationFrame(resolve));
      slider.min = '1'; slider.max = String(pdf ? pdf.numPages : Math.max(1, docxPageCount)); slider.value = '1';
      updateDocxPageCount(); renderOutline(); renderBookmarks();
      const saved = readStore().positions?.[fileKey];
      if (saved) requestAnimationFrame(() => scrollToPage(saved.page || 1, false));
      $('loading').classList.add('hidden'); updateCurrentPage();
    } catch (error) {
      if (token !== renderToken) return;
      $('loading').classList.add('hidden'); $('error').textContent = error.message || 'This document could not be opened.'; $('error').classList.remove('hidden');
    }
  }
  async function renderPdf(bytes, token) {
    if (!window.pdfjsLib) throw new Error('PDF support could not load. Check your internet connection and reload this page.');
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    $('page-total').textContent = pdf.numPages;
    for (let n = 1; n <= pdf.numPages; n++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(n), text = await page.getTextContent();
      pdfTexts.push(text.items.map(item => item.str).join(' '));
      const base = page.getViewport({ scale: 1 });
      const node = document.createElement('div'); node.className = 'document-page pdf-page'; node.dataset.page = n;
      const canvas = document.createElement('canvas'); node.append(canvas); pages.append(node); pageNodes.push(node);
      await drawPdfPage(page, canvas, node, base);
    }
    try {
      const entries = await pdf.getOutline() || [];
      const flatten = async (items, level = 0) => {
        for (const entry of items) {
          let page = 1;
          try { const destination = typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest; if (destination?.[0]) page = (await pdf.getPageIndex(destination[0])) + 1; } catch {}
          outlineItems.push({ title: entry.title, page, level });
          if (entry.items?.length) await flatten(entry.items, level + 1);
        }
      };
      await flatten(entries);
    } catch {}
  }
  async function drawPdfPage(page, canvas, node, base) {
    const width = Math.min(window.innerWidth - 48, 920), maxHeight = window.innerHeight - 36;
    let scale = Math.min(width / base.width, maxHeight / base.height);
    if (mode === 'single') scale = Math.min(scale, (window.innerHeight - 30) / base.height);
    scale *= Number($('zoom').value || 100) / 100;
    const viewport = page.getViewport({ scale }), ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    node.style.width = `${viewport.width}px`; node.style.height = `${viewport.height}px`;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: ratio === 1 ? null : [ratio,0,0,ratio,0,0] }).promise;
  }
  async function renderDocx(bytes, token) {
    if (!window.mammoth) throw new Error('DOCX support could not load. Check your internet connection and reload this page.');
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
    if (token !== renderToken) return;
    const article = document.createElement('article'); article.className = 'document-page docx-page'; article.dataset.page = '1';
    article.innerHTML = result.value || '<p>This document has no readable text.</p>';
    sanitizeDocx(article);
    pages.append(article); pageNodes.push(article); docxMode = true;
    outlineItems = [...article.querySelectorAll('h1,h2,h3,h4')].map((h, i) => ({ title: h.textContent, page: 1, targetId: `docx-heading-${i}`, level: Number(h.tagName.slice(1)) }));
    outlineItems.forEach(item => { const h = article.querySelectorAll('h1,h2,h3,h4')[outlineItems.indexOf(item)]; h.id = item.targetId; });
  }
  function sanitizeDocx(root) {
    root.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach(node => node.remove());
    root.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase(), value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || (['href','src','xlink:href'].includes(name) && /^(javascript:|https?:|\/\/)/i.test(value))) node.removeAttribute(attr.name);
    }));
  }
  function setMode(next) {
    mode = next; surface.classList.toggle('mode-single', mode === 'single'); surface.classList.toggle('mode-continuous', mode === 'continuous');
    document.querySelectorAll('.mode-button').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
    if (pdf) redrawPdf(); else { updateDocxPageCount(); updateCurrentPage(); }
  }
  async function redrawPdf() {
    const token = ++renderToken;
    for (let i = 0; i < pageNodes.length; i++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(i + 1); await drawPdfPage(page, pageNodes[i].querySelector('canvas'), pageNodes[i], page.getViewport({ scale: 1 }));
    }
    updateCurrentPage();
  }
  function updateDocxPageCount() {
    if (!docxMode || !pageNodes[0]) return;
    const count = Math.max(1, Math.ceil(pageNodes[0].scrollHeight / Math.max(1, surface.clientHeight)));
    if (count !== docxPageCount) {
      docxPageCount = count;
      pageNodes[0].querySelectorAll('.docx-snap-marker').forEach(node => node.remove());
      for (let n = 1; n < docxPageCount; n++) {
        const marker = document.createElement('span'); marker.className = 'docx-snap-marker'; marker.setAttribute('aria-hidden', 'true');
        marker.style.top = `${n * surface.clientHeight}px`; pageNodes[0].append(marker);
      }
    }
    $('page-total').textContent = docxPageCount; slider.max = String(docxPageCount);
  }
  function updateCurrentPage() {
    if (!pageNodes.length) return;
    let best = 1;
    if (docxMode) { updateDocxPageCount(); best = Math.min(docxPageCount, Math.floor(surface.scrollTop / Math.max(1, surface.clientHeight)) + 1); }
    else {
      let distance = Infinity;
      pageNodes.forEach((node, i) => { const r = node.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - surface.clientHeight / 2); if (d < distance) { best = i + 1; distance = d; } });
    }
    $('page-current').textContent = best; slider.value = best;
  }
  function scrollToPage(number, smooth = true) {
    const target = Math.max(1, Number(number) || 1);
    if (docxMode) { surface.scrollTo({ top: (target - 1) * surface.clientHeight, behavior: smooth ? 'smooth' : 'instant' }); return; }
    const node = pageNodes[Math.min(pageNodes.length - 1, target - 1)];
    if (node) node.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: mode === 'single' ? 'start' : 'center' });
  }
  function savePosition() {
    if (!fileKey || !pageNodes.length) return;
    const positions = readStore().positions || {};
    positions[fileKey] = { page: Number($('page-current').textContent) || 1, scrollRatio: surface.scrollHeight ? surface.scrollTop / surface.scrollHeight : 0, updated: Date.now() };
    const keys = Object.keys(positions).sort((a,b) => positions[b].updated - positions[a].updated).slice(0, 30);
    saveStore({ positions: Object.fromEntries(keys.map(key => [key, positions[key]])) });
  }
  function addBookmark() {
    if (!fileKey) return;
    const page = Number($('page-current').textContent) || 1;
    const all = readStore().bookmarks || {}, items = all[fileKey] || [];
    if (items.some(item => item.page === page)) return;
    items.push({ page, name: `Page ${page}` }); all[fileKey] = items; saveStore({ bookmarks: all }); renderBookmarks();
  }
  function renderBookmarks() {
    const list = $('bookmark-list'); list.replaceChildren();
    const items = (readStore().bookmarks || {})[fileKey] || [];
    items.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'bookmark-item';
      const jump = document.createElement('button'); jump.className = 'text-button'; jump.textContent = `Bookmark · ${item.name}`; jump.addEventListener('click', () => scrollToPage(item.page));
      const remove = document.createElement('button'); remove.className = 'remove-bookmark'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove bookmark');
      remove.addEventListener('click', () => { const all = readStore().bookmarks || {}; all[fileKey].splice(index, 1); saveStore({ bookmarks: all }); renderBookmarks(); });
      row.append(jump, remove); list.append(row);
    });
  }
  function renderOutline() {
    if (!outlineItems.length) return;
    const root = $('outline-list'); root.replaceChildren(); $('outline').classList.remove('hidden');
    outlineItems.forEach(item => {
      const button = document.createElement('button'); button.className = 'outline-link'; button.textContent = item.title || 'Untitled section';
      button.style.paddingLeft = `${8 + Math.min(4, item.level || 0) * 8}px`;
      button.addEventListener('click', () => { if (item.targetId) document.getElementById(item.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else scrollToPage(item.page || 1); }); root.append(button);
    });
  }
  async function runSearch() {
    const query = $('search-input').value.trim().toLocaleLowerCase(), resultBox = $('search-results'); resultBox.replaceChildren();
    if (!query) return;
    let matches = [];
    if (pdf) pdfTexts.forEach((text, i) => { const lower = text.toLocaleLowerCase(); let at = 0; while ((at = lower.indexOf(query, at)) >= 0 && matches.length < 200) { matches.push({ page: i + 1, snippet: text.slice(Math.max(0, at - 45), at + query.length + 65).trim() }); at += query.length; } });
    else if (docxMode) {
      const text = pageNodes[0].innerText, lower = text.toLocaleLowerCase(); let at = 0;
      while ((at = lower.indexOf(query, at)) >= 0 && matches.length < 200) { matches.push({ page: Math.min(docxPageCount, Math.floor(at / Math.max(1, text.length) * docxPageCount) + 1), snippet: text.slice(Math.max(0, at - 45), at + query.length + 65).trim() }); at += query.length; }
    }
    const summary = document.createElement('div'); summary.className = 'search-summary'; summary.textContent = `${matches.length}${matches.length === 200 ? '+' : ''} page match${matches.length === 1 ? '' : 'es'}`; resultBox.append(summary);
    matches.slice(0, 20).forEach(match => { const button = document.createElement('button'); button.className = 'search-result'; button.textContent = `Page ${match.page} · ${match.snippet}`; button.addEventListener('click', () => scrollToPage(match.page)); resultBox.append(button); });
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdf) redrawPdf(); else { updateDocxPageCount(); updateCurrentPage(); } }, 150); });
})();
