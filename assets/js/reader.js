(() => {
  const $ = id => document.getElementById(id);
  const welcome = $('welcome'), reader = $('reader'), picker = $('file-picker');
  const surface = $('reading-surface'), pages = $('pages'), paper = $('paper');
  const controls = $('controls'), toggle = $('control-toggle'), slider = $('page-slider');
  const historyPanel = $('history-panel'), historyBackdrop = $('history-backdrop');
  const STORE = 'mai-reads-v1';
  const DB_NAME = 'mai-reads-store';
  const DB_VERSION = 1;
  const STORE_DOCS = 'documents';

  let pdf = null, pageNodes = [], pdfTexts = [], mode = 'continuous', currentFile = null;
  let fileKey = '', docxMode = false, docxPageCount = 1, outlineItems = [];
  let saveTimer, renderToken = 0, toastTimer = null;

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ── IndexedDB Engine for Storing Local Documents ──────────────────────────
  function getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveDocToDB(key, file, name, type) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      store.put({
        key,
        name,
        type,
        file, // File / Blob is stored natively
        size: file.size,
        savedAt: Date.now()
      });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      pruneOldDocs();
    } catch (err) {
      console.warn('Could not cache document in IndexedDB:', err);
    }
  }

  async function getDocFromDB(key) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DOCS, 'readonly');
        const store = tx.objectStore(STORE_DOCS);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not get document from IndexedDB:', err);
      return null;
    }
  }

  async function deleteDocFromDB(key) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      tx.objectStore(STORE_DOCS).delete(key);
    } catch (err) {}
  }

  async function clearAllDocsFromDB() {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      tx.objectStore(STORE_DOCS).clear();
    } catch (err) {}
  }

  async function pruneOldDocs() {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.getAll();
      req.onsuccess = () => {
        const docs = req.result || [];
        if (docs.length > 20) {
          docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
          docs.slice(20).forEach(d => store.delete(d.key));
        }
      };
    } catch (err) {}
  }

  // ── Storage Helpers ────────────────────────────────────────────────────────
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch { return {}; }
  }
  function saveStore(update) {
    const value = { ...readStore(), ...update };
    try { localStorage.setItem(STORE, JSON.stringify(value)); } catch {}
  }

  const settings = readStore();

  // ── Toast Notifications ───────────────────────────────────────────────────
  function showToast(message, duration = 2400) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 250);
    }, duration);
  }

  // ── Theme Engine ──────────────────────────────────────────────────────────
  const SUN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  const MOON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

  let themePreference = settings.theme || 'system';

  function applyTheme(theme) {
    themePreference = theme;
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
    
    const iconEl = $('theme-icon');
    if (iconEl) iconEl.innerHTML = dark ? SUN_SVG : MOON_SVG;

    const toggleBtn = $('theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
      toggleBtn.title = `Switch to ${dark ? 'light' : 'dark'} mode`;
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = dark ? '#1c1d1a' : '#f6f3ec';
  }

  applyTheme(themePreference);

  $('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.resolvedTheme === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    saveStore({ theme: next });
    showToast(`${next.charAt(0).toUpperCase() + next.slice(1)} mode enabled`, 1800);
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themePreference === 'system') applyTheme('system');
  });

  // ── Paper Brightness ──────────────────────────────────────────────────────
  const savedBrightness = Number(settings.brightness ?? 100);
  if ($('brightness')) {
    $('brightness').value = savedBrightness;
    setBrightness(savedBrightness);
    $('brightness').addEventListener('input', e => {
      setBrightness(e.target.value);
      saveStore({ brightness: Number(e.target.value) });
    });
  }

  function setBrightness(value) {
    paper.style.setProperty('--paper-brightness', Number(value) / 100);
    const label = $('brightness-value');
    if (label) label.textContent = `${value}%`;
  }

  // ── Resume Last Read Button on Welcome View ───────────────────────────────
  async function updateResumeButton() {
    const container = $('resume-container');
    if (!container) return;
    const history = readStore().history || [];
    if (!history.length) {
      container.classList.add('hidden');
      return;
    }

    const latest = history[0];
    const positions = readStore().positions || {};
    const pos = positions[latest.key];
    const page = pos?.page || 1;
    const total = pos?.total || latest.totalPages || 1;

    $('resume-title').textContent = latest.name;
    let meta = `Page ${page} of ${total}`;
    if (total <= 1) meta = `Page ${page}`;
    $('resume-meta').textContent = `${meta} · Resumes instantly`;
    container.classList.remove('hidden');

    $('resume-btn').onclick = async () => {
      showToast(`Opening "${latest.name}"…`, 1500);
      const cached = await getDocFromDB(latest.key);
      if (cached && cached.file) {
        let fileObj = cached.file;
        if (!(fileObj instanceof File)) {
          fileObj = new File([cached.file], cached.name, {
            type: cached.type,
            lastModified: cached.savedAt
          });
        }
        await openFile(fileObj, latest.key);
      } else {
        showToast(`Please select "${latest.name}" to resume`, 3500);
        picker.click();
      }
    };
  }

  // ── History Engine ────────────────────────────────────────────────────────
  function openHistoryPanel() {
    renderHistoryPanel();
    historyPanel.classList.add('open');
    historyPanel.setAttribute('aria-hidden', 'false');
    historyBackdrop.classList.remove('hidden');
    requestAnimationFrame(() => historyBackdrop.classList.add('visible'));
  }

  function closeHistoryPanel() {
    historyPanel.classList.remove('open');
    historyPanel.setAttribute('aria-hidden', 'true');
    historyBackdrop.classList.remove('visible');
    setTimeout(() => historyBackdrop.classList.add('hidden'), 280);
  }

  function updateHistoryBadges() {
    const history = readStore().history || [];
    const count = history.length;
    if ($('history-count')) $('history-count').textContent = String(count);
    if ($('welcome-history-dot')) {
      $('welcome-history-dot').classList.toggle('hidden', count === 0);
    }
  }

  function saveHistoryEntry(name, key, type, totalPages = 1) {
    const store = readStore();
    const history = store.history || [];
    const existingIndex = history.findIndex(h => h.key === key);
    let prev = {};
    if (existingIndex !== -1) {
      prev = history[existingIndex];
      history.splice(existingIndex, 1);
    }
    history.unshift({
      name,
      key,
      type,
      totalPages: totalPages || prev.totalPages || 1,
      opened: Date.now()
    });
    saveStore({ history: history.slice(0, 50) });
    updateHistoryBadges();
    updateResumeButton();
    if (historyPanel.classList.contains('open')) {
      renderHistoryPanel();
    }
  }

  async function deleteHistoryItem(key, name, e) {
    if (e) e.stopPropagation();
    const history = (readStore().history || []).filter(h => h.key !== key);
    saveStore({ history });
    await deleteDocFromDB(key);
    renderHistoryPanel();
    updateHistoryBadges();
    updateResumeButton();
    showToast(`Removed "${name}" from history`);
  }

  function relativeDate(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderHistoryPanel() {
    const list = $('history-list');
    if (!list) return;
    list.replaceChildren();
    const store = readStore();
    const history = store.history || [];
    const positions = store.positions || {};
    updateHistoryBadges();

    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.innerHTML = `
        <div class="history-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div class="history-empty-title">No reading history yet</div>
        <div class="history-empty-desc">Documents you open on this device are saved automatically so you can resume anytime with one click.</div>
        <button class="history-empty-btn" type="button">Choose a document</button>
      `;
      empty.querySelector('.history-empty-btn')?.addEventListener('click', () => {
        closeHistoryPanel();
        picker.click();
      });
      list.append(empty);
      return;
    }

    history.forEach(entry => {
      const pos = positions[entry.key];
      const page = pos?.page || 1;
      const total = pos?.total || entry.totalPages || 1;
      const pct = total > 1 ? Math.min(100, Math.round((page / total) * 100)) : null;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'history-item';
      if (fileKey && entry.key === fileKey && !reader.classList.contains('hidden')) {
        card.classList.add('active');
      }

      // Document format badge
      const badge = document.createElement('span');
      badge.className = `doc-badge doc-badge-${entry.type}`;
      badge.textContent = (entry.type || 'doc').toUpperCase();

      // Info container
      const info = document.createElement('div');
      info.className = 'history-item-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'history-item-name';
      nameEl.textContent = entry.name;
      nameEl.title = entry.name;

      const metaEl = document.createElement('div');
      metaEl.className = 'history-item-meta';

      let progressText = `Page ${page}`;
      if (total > 1) {
        progressText = `Page ${page} of ${total} (${pct}%)`;
      }

      metaEl.innerHTML = `
        <span class="history-progress-pill">${progressText}</span>
        <span>·</span>
        <span>${relativeDate(entry.opened)}</span>
      `;

      info.append(nameEl, metaEl);

      // Single item delete button
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'history-item-del';
      delBtn.title = 'Remove from history';
      delBtn.setAttribute('aria-label', `Remove ${entry.name} from history`);
      delBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      `;
      delBtn.addEventListener('click', e => deleteHistoryItem(entry.key, entry.name, e));

      card.append(badge, info, delBtn);

      // CLICKING A CARD DIRECTLY RE-OPENS THE DOCUMENT FROM LOCAL STORAGE
      card.addEventListener('click', async e => {
        if (e.target.closest('.history-item-del')) return;

        // If this document is currently displayed in the reader:
        if (fileKey && entry.key === fileKey && !reader.classList.contains('hidden')) {
          closeHistoryPanel();
          scrollToPage(page);
          showToast(`Jumped to Page ${page}`);
          return;
        }

        closeHistoryPanel();
        showToast(`Opening "${entry.name}"…`, 1500);

        // Fetch the file from IndexedDB cache
        const cached = await getDocFromDB(entry.key);
        if (cached && cached.file) {
          let fileObj = cached.file;
          if (!(fileObj instanceof File)) {
            fileObj = new File([cached.file], cached.name, {
              type: cached.type,
              lastModified: cached.savedAt
            });
          }
          await openFile(fileObj, entry.key);
        } else {
          // If not in cache (e.g. from an older version), fallback to picker
          showToast(`Please re-select "${entry.name}" once to cache it`, 3500);
          picker.click();
        }
      });

      list.append(card);
    });
  }

  // Hook up history toggles
  [$('history-toggle-welcome'), $('history-toggle-reader'), $('controls-history-toggle')].forEach(btn => {
    btn?.addEventListener('click', () => {
      controls.classList.add('hidden');
      if (historyPanel.classList.contains('open')) closeHistoryPanel();
      else openHistoryPanel();
    });
  });

  $('history-close')?.addEventListener('click', closeHistoryPanel);
  historyBackdrop?.addEventListener('click', closeHistoryPanel);

  $('history-clear')?.addEventListener('click', async () => {
    const history = readStore().history || [];
    if (!history.length) return;
    if (!confirm('Clear your entire reading history and cached documents? (Saved bookmarks will remain preserved)')) return;
    saveStore({ history: [] });
    await clearAllDocsFromDB();
    renderHistoryPanel();
    updateHistoryBadges();
    updateResumeButton();
    showToast('Reading history cleared');
  });

  // Initial badge and resume button check
  updateHistoryBadges();
  updateResumeButton();

  // ── Drag & Drop Engine ────────────────────────────────────────────────────
  let dragCounter = 0;
  const dropOverlay = $('drop-overlay');

  window.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    dropOverlay?.classList.remove('hidden');
  });

  window.addEventListener('dragover', e => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', e => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) {
      dropOverlay?.classList.add('hidden');
    }
  });

  window.addEventListener('drop', async e => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay?.classList.add('hidden');
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (/\.(pdf|docx)$/i.test(file.name) || file.type.includes('pdf') || file.type.includes('wordprocessingml')) {
        await openFile(file);
      } else {
        showToast('Please select a PDF or DOCX document.');
      }
    }
  });

  // ── Welcome & Reader Navigation ───────────────────────────────────────────
  $('welcome-open')?.addEventListener('click', () => picker.click());
  $('open-another')?.addEventListener('click', () => {
    controls.classList.add('hidden');
    picker.click();
  });

  $('back-to-home')?.addEventListener('click', async () => {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    controls.classList.add('hidden');
    reader.classList.add('hidden');
    welcome.classList.remove('hidden');
    updateHistoryBadges();
    updateResumeButton();
  });

  picker.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (file) await openFile(file);
    e.target.value = '';
  });

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    controls.classList.toggle('hidden');
  });

  $('close-controls')?.addEventListener('click', () => controls.classList.add('hidden'));

  // Clicking on reading surface closes reading controls if open
  surface.addEventListener('click', e => {
    if (!controls.classList.contains('hidden') && !e.target.closest('#controls') && !e.target.closest('#control-toggle')) {
      controls.classList.add('hidden');
    }
  });

  document.querySelectorAll('.mode-button').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  $('fullscreen')?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await reader.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  });

  slider.addEventListener('input', () => scrollToPage(Number(slider.value)));

  // ── Document Zoom & Gestures ──────────────────────────────────────────────
  const zoomInput = $('zoom');
  let pinchState = null, zoomCommitTimer = 0, safariGestureZoom = null;
  const touchPointers = new Map();

  function setZoomPreview(value) {
    const next = Math.max(Number(zoomInput.min), Math.min(Number(zoomInput.max), value));
    zoomInput.value = String(Math.round(next));
    zoomInput.dispatchEvent(new Event('input', { bubbles: true }));
    if (pdf && pinchState?.pageSizes) {
      const ratio = next / pinchState.startZoom;
      pinchState.pageSizes.forEach(({ node, canvas, width, height, canvasWidth, canvasHeight }) => {
        node.style.width = `${width * ratio}px`;
        node.style.height = `${height * ratio}px`;
        canvas.style.width = `${canvasWidth * ratio}px`;
        canvas.style.height = `${canvasHeight * ratio}px`;
      });
      updateSinglePageSlots();
      if (pinchState.startScrollTop !== undefined) {
        surface.scrollTop = pinchState.startScrollTop * ratio;
      }
    }
  }

  function beginZoomGesture(startZoom = Number(zoomInput.value)) {
    pinchState = { startZoom, startScrollTop: surface.scrollTop };
    if (pdf) {
      pinchState.pageSizes = pageNodes.map(node => {
        const canvas = node.querySelector('canvas');
        return {
          node, canvas,
          width: node.offsetWidth, height: node.offsetHeight,
          canvasWidth: canvas.offsetWidth, canvasHeight: canvas.offsetHeight
        };
      });
    }
  }

  function finishZoomGesture() {
    if (!pinchState) return;
    pinchState = null;
    zoomInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function scheduleZoomFinish() {
    clearTimeout(zoomCommitTimer);
    zoomCommitTimer = setTimeout(finishZoomGesture, 160);
  }

  zoomInput.addEventListener('input', e => {
    $('zoom-value').textContent = `${e.target.value}%`;
    paper.style.setProperty('--doc-zoom', Number(e.target.value) / 100);
  });

  zoomInput.addEventListener('change', () => {
    if (pdf) redrawPdf();
    else { updateDocxPageCount(); updateCurrentPage(); }
  });

  surface.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPointers.size === 2) {
      const [a, b] = [...touchPointers.values()];
      beginZoomGesture(Number(zoomInput.value));
      pinchState.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  surface.addEventListener('pointermove', e => {
    if (!touchPointers.has(e.pointerId)) return;
    touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPointers.size < 2 || !pinchState?.startDistance) return;
    const [a, b] = [...touchPointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (!distance) return;
    e.preventDefault();
    setZoomPreview(pinchState.startZoom * distance / pinchState.startDistance);
  }, { passive: false });

  function endTouchPointer(e) {
    touchPointers.delete(e.pointerId);
    if (pinchState?.startDistance) {
      touchPointers.clear();
      finishZoomGesture();
    }
  }

  surface.addEventListener('pointerup', endTouchPointer);
  surface.addEventListener('pointercancel', endTouchPointer);

  surface.addEventListener('wheel', e => {
    if (!e.ctrlKey || reader.classList.contains('hidden')) return;
    e.preventDefault();
    if (!pinchState) beginZoomGesture(Number(zoomInput.value));
    setZoomPreview(Number(zoomInput.value) * Math.exp(-e.deltaY * 0.002));
    scheduleZoomFinish();
  }, { passive: false });

  surface.addEventListener('gesturestart', e => {
    if (reader.classList.contains('hidden') || touchPointers.size >= 2) return;
    e.preventDefault();
    safariGestureZoom = Number(zoomInput.value);
    beginZoomGesture(safariGestureZoom);
  }, { passive: false });

  surface.addEventListener('gesturechange', e => {
    if (safariGestureZoom === null || !pinchState) return;
    e.preventDefault();
    setZoomPreview(safariGestureZoom * e.scale);
  }, { passive: false });

  surface.addEventListener('gestureend', e => {
    if (safariGestureZoom === null) return;
    e.preventDefault();
    safariGestureZoom = null;
    finishZoomGesture();
  }, { passive: false });

  // ── Search & Bookmarks ────────────────────────────────────────────────────
  $('search-toggle')?.addEventListener('click', () => {
    const box = $('search-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) $('search-input').focus();
  });

  $('search-input')?.addEventListener('input', runSearch);
  $('bookmark-add')?.addEventListener('click', addBookmark);

  $('clear-data')?.addEventListener('click', async () => {
    if (!confirm('Clear saved theme, paper brightness, reading positions, bookmarks, and history for Mai-Reads?')) return;
    try { localStorage.removeItem(STORE); } catch {}
    await clearAllDocsFromDB();
    applyTheme('system');
    $('brightness').value = '100';
    setBrightness(100);
    $('bookmark-list').replaceChildren();
    updateHistoryBadges();
    updateResumeButton();
    showToast('All local data cleared');
  });

  surface.addEventListener('scroll', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      updateCurrentPage();
      savePosition();
    }, 100);
  }, { passive: true });

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

    if (e.key === 'Escape') {
      if (historyPanel.classList.contains('open')) { closeHistoryPanel(); return; }
      if (!controls.classList.contains('hidden')) { controls.classList.add('hidden'); return; }
      if (!$('search-box').classList.contains('hidden')) { $('search-box').classList.add('hidden'); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !reader.classList.contains('hidden')) {
      e.preventDefault();
      controls.classList.remove('hidden');
      $('search-box').classList.remove('hidden');
      $('search-input').focus();
    }

    if (!inInput && (e.key === 'h' || e.key === 'H')) {
      if (historyPanel.classList.contains('open')) closeHistoryPanel();
      else openHistoryPanel();
    }
  });

  // ── Open & Render Document ────────────────────────────────────────────────
  async function openFile(file, overrideKey = '') {
    const token = ++renderToken;
    currentFile = file;
    fileKey = overrideKey || `${file.name.toLowerCase()}|${file.size}|${file.lastModified || 0}`;

    welcome.classList.add('hidden');
    reader.classList.remove('hidden');
    $('loading').classList.remove('hidden');
    $('error').classList.add('hidden');

    if (pdf && typeof pdf.destroy === 'function') { try { pdf.destroy(); } catch (e) {} }
    pages.replaceChildren();
    pageNodes = [];
    pdfTexts = [];
    pdf = null;
    outlineItems = [];
    docxMode = false;
    surface.scrollTop = 0;

    const titleEl = $('doc-title-text');
    if (titleEl) titleEl.textContent = file.name;

    $('outline').classList.add('hidden');
    $('bookmark-list').replaceChildren();
    $('search-results').replaceChildren();
    $('search-input').value = '';

    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    const isDocx = /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml');

    try {
      const bytes = await file.arrayBuffer();
      if (isPdf) await renderPdf(bytes, token);
      else if (isDocx) await renderDocx(bytes, token);
      else throw new Error('Please choose a PDF or DOCX document.');

      if (token !== renderToken) return;

      await new Promise(resolve => requestAnimationFrame(resolve));
      const total = pdf ? pdf.numPages : Math.max(1, docxPageCount);
      slider.min = '1';
      slider.max = String(total);
      slider.value = '1';

      updateDocxPageCount();
      renderOutline();
      renderBookmarks();

      const saved = readStore().positions?.[fileKey];
      if (saved) {
        requestAnimationFrame(() => scrollToPage(saved.page || 1, false));
        showToast(`Resumed at Page ${saved.page || 1}`);
      }

      $('loading').classList.add('hidden');
      updateCurrentPage();

      // Cache document locally so it can be reopened anytime from history
      await saveDocToDB(fileKey, file, file.name, isPdf ? 'pdf' : 'docx');
      saveHistoryEntry(file.name, fileKey, isPdf ? 'pdf' : 'docx', total);
      updateResumeButton();
    } catch (error) {
      if (token !== renderToken) return;
      $('loading').classList.add('hidden');
      $('error').textContent = error.message || 'This document could not be opened.';
      $('error').classList.remove('hidden');
    }
  }

  let globalPdfBytes = null;
  let documentHighlights = [];
  let isHighlighting = false;
  
  async function renderPdf(bytes, token) {
    globalPdfBytes = bytes;
    documentHighlights = JSON.parse(localStorage.getItem('mai-highlights-' + fileKey) || '[]');
    if (documentHighlights.length > 0) $('download-pdf')?.classList.remove('hidden');
    else $('download-pdf')?.classList.add('hidden');

    if (!window.pdfjsLib) throw new Error('PDF support could not load. Check your internet connection and reload this page.');
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    $('page-total').textContent = pdf.numPages;

    for (let n = 1; n <= pdf.numPages; n++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(n);
      const text = await page.getTextContent();
      pdfTexts.push(text.items.map(item => item.str).join(' '));
      const base = page.getViewport({ scale: 1 });
      const node = document.createElement('div');
      node.className = 'document-page pdf-page';
      node.dataset.page = n;
      const canvas = document.createElement('canvas');
      node.append(canvas);
      pages.append(node);
      pageNodes.push(node);
      await drawPdfPage(page, canvas, node, base);
        renderPageHighlights(n, node);
    }

    try {
      const entries = await pdf.getOutline() || [];
      const flatten = async (items, level = 0) => {
        for (const entry of items) {
          let page = 1;
          try {
            const dest = typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest;
            if (dest?.[0]) page = (await pdf.getPageIndex(dest[0])) + 1;
          } catch {}
          outlineItems.push({ title: entry.title, page, level });
          if (entry.items?.length) await flatten(entry.items, level + 1);
        }
      };
      await flatten(entries);
    } catch {}
  }

  async function drawPdfPage(page, canvas, node, base) {
    const width = Math.min(window.innerWidth - 48, 920);
    const maxHeight = window.innerHeight - 36;
    let scale = Math.min(width / base.width, maxHeight / base.height);
    if (mode === 'single') scale = Math.min(scale, (window.innerHeight - 30) / base.height);
    scale *= Number($('zoom').value || 100) / 100;

    const viewport = page.getViewport({ scale });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    node.style.width = `${viewport.width}px`;
    node.style.height = `${viewport.height}px`;

    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0]
    }).promise;

    // Render Text Layer for real text selection & highlighting
    try {
      let textLayerDiv = node.querySelector('.textLayer');
      if (!textLayerDiv) {
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        node.appendChild(textLayerDiv);
      } else {
        textLayerDiv.replaceChildren();
      }
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);

      const textContent = await page.getTextContent();
      const textTask = pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport
      });
      await textTask.promise;
    } catch (err) {
      console.warn('Text layer render failed:', err);
    }
  }

  async function renderDocx(bytes, token) {
    if (!window.mammoth) throw new Error('DOCX support could not load. Check your internet connection and reload this page.');
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
    if (token !== renderToken) return;

    const article = document.createElement('article');
    article.className = 'document-page docx-page';
    article.dataset.page = '1';
    article.innerHTML = result.value || '<p>This document has no readable text.</p>';
    sanitizeDocx(article);

    pages.append(article);
    pageNodes.push(article);
    docxMode = true;
    documentHighlights = JSON.parse(localStorage.getItem('mai-highlights-' + fileKey) || '[]');
    updateHighlightUi();
    renderPageHighlights(1, article);

    outlineItems = [...article.querySelectorAll('h1,h2,h3,h4')].map((h, i) => ({
      title: h.textContent,
      page: 1,
      targetId: `docx-heading-${i}`,
      level: Number(h.tagName.slice(1))
    }));

    outlineItems.forEach(item => {
      const h = article.querySelectorAll('h1,h2,h3,h4')[outlineItems.indexOf(item)];
      if (h) h.id = item.targetId;
    });
  }

  function sanitizeDocx(root) {
    root.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach(node => node.remove());
    root.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || (['href', 'src', 'xlink:href'].includes(name) && /^(javascript:|https?:|\/\/)/i.test(val))) {
        node.removeAttribute(attr.name);
      }
    }));
  }

  function setMode(next) {
    mode = next;
    surface.classList.toggle('mode-single', mode === 'single');
    surface.classList.toggle('mode-continuous', mode === 'continuous');
    document.querySelectorAll('.mode-button').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
    if (pdf) redrawPdf();
    else { updateDocxPageCount(); updateCurrentPage(); }
  }

  async function redrawPdf() {
    const token = ++renderToken;
    const oldScrollTop = surface.scrollTop;
    const oldScrollHeight = surface.scrollHeight || 1;
    const scrollRatio = oldScrollTop / oldScrollHeight;

    for (let i = 0; i < pageNodes.length; i++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(i + 1);
      await drawPdfPage(page, pageNodes[i].querySelector('canvas'), pageNodes[i], page.getViewport({ scale: 1 }));
      if (mode === 'continuous') surface.scrollTop = scrollRatio * surface.scrollHeight;
      
      renderPageHighlights(i + 1, pageNodes[i]);

    }
    updateSinglePageSlots();
    if (mode === 'continuous') surface.scrollTop = scrollRatio * surface.scrollHeight;
    else scrollToPage(Number($('page-current').textContent) || 1, false);
    updateCurrentPage();
  }

  function updateSinglePageSlots() {
    if (!pdf) return;
    pageNodes.forEach(node => {
      if (mode === 'single') {
        const spacer = Math.max(0, surface.clientHeight - node.offsetHeight);
        node.style.marginTop = `${spacer / 2}px`;
        node.style.marginBottom = `${spacer / 2}px`;
      } else {
        node.style.marginTop = '';
        node.style.marginBottom = '';
      }
    });
  }

  function updateDocxPageCount() {
    if (!docxMode || !pageNodes[0]) return;
    const count = Math.max(1, Math.ceil(pageNodes[0].scrollHeight / Math.max(1, surface.clientHeight)));
    if (count !== docxPageCount) {
      docxPageCount = count;
      pageNodes[0].querySelectorAll('.docx-snap-marker').forEach(node => node.remove());
      for (let n = 1; n < docxPageCount; n++) {
        const marker = document.createElement('span');
        marker.className = 'docx-snap-marker';
        marker.setAttribute('aria-hidden', 'true');
        marker.style.top = `${n * surface.clientHeight}px`;
        pageNodes[0].append(marker);
      }
    }
    $('page-total').textContent = docxPageCount;
    slider.max = String(docxPageCount);
  }

  function updateCurrentPage() {
    if (!pageNodes.length) return;
    let best = 1;
    if (docxMode) {
      updateDocxPageCount();
      best = Math.min(docxPageCount, Math.floor(surface.scrollTop / Math.max(1, surface.clientHeight)) + 1);
    } else {
      let distance = Infinity;
      pageNodes.forEach((node, i) => {
        const r = node.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - surface.clientHeight / 2);
        if (d < distance) { best = i + 1; distance = d; }
      });
    }
    $('page-current').textContent = best;
    slider.value = best;
    slider.dispatchEvent(new Event('input'));
  }

  function scrollToPage(number, smooth = true) {
    const target = Math.max(1, Number(number) || 1);
    if (docxMode) {
      surface.scrollTo({ top: (target - 1) * surface.clientHeight, behavior: smooth ? 'smooth' : 'instant' });
      return;
    }
    const node = pageNodes[Math.min(pageNodes.length - 1, target - 1)];
    if (node) {
      node.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: mode === 'single' ? 'start' : 'center' });
    }
  }

  function savePosition() {
    if (!fileKey || !pageNodes.length) return;
    const positions = readStore().positions || {};
    const page = Number($('page-current').textContent) || 1;
    const total = Number($('page-total').textContent) || (pdf ? pdf.numPages : docxPageCount) || 1;

    positions[fileKey] = {
      page,
      total,
      scrollRatio: surface.scrollHeight ? surface.scrollTop / surface.scrollHeight : 0,
      updated: Date.now()
    };

    const keys = Object.keys(positions).sort((a, b) => positions[b].updated - positions[a].updated).slice(0, 30);
    saveStore({ positions: Object.fromEntries(keys.map(k => [k, positions[k]])) });

    // Update total pages in history entry as well
    const history = readStore().history || [];
    const item = history.find(h => h.key === fileKey);
    if (item && total) {
      item.totalPages = total;
      saveStore({ history });
    }
  }

  function addBookmark() {
    if (!fileKey) return;
    const page = Number($('page-current').textContent) || 1;
    const all = readStore().bookmarks || {};
    const items = all[fileKey] || [];
    if (items.some(item => item.page === page)) {
      showToast(`Page ${page} is already bookmarked`);
      return;
    }
    items.push({ page, name: `Page ${page}` });
    all[fileKey] = items;
    saveStore({ bookmarks: all });
    renderBookmarks();
    showToast(`Bookmarked Page ${page}`);
  }

  function renderBookmarks() {
    const list = $('bookmark-list');
    list.replaceChildren();
    const items = (readStore().bookmarks || {})[fileKey] || [];
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'bookmark-item';

      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'text-button';
      jump.textContent = `Bookmark · ${item.name}`;
      jump.addEventListener('click', () => scrollToPage(item.page));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-bookmark';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove bookmark for ${item.name}`);
      remove.addEventListener('click', () => {
        const all = readStore().bookmarks || {};
        all[fileKey].splice(index, 1);
        saveStore({ bookmarks: all });
        renderBookmarks();
        showToast('Bookmark removed');
      });

      row.append(jump, remove);
      list.append(row);
    });
  }

  function renderOutline() {
    if (!outlineItems.length) return;
    const root = $('outline-list');
    root.replaceChildren();
    $('outline').classList.remove('hidden');

    outlineItems.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'outline-link';
      btn.textContent = item.title || 'Untitled section';
      btn.style.paddingLeft = `${10 + Math.min(4, item.level || 0) * 10}px`;
      btn.addEventListener('click', () => {
        if (item.targetId) {
          document.getElementById(item.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          scrollToPage(item.page || 1);
        }
      });
      root.append(btn);
    });
  }

  async function runSearch() {
    const query = $('search-input').value.trim().toLocaleLowerCase();
    const resultBox = $('search-results');
    resultBox.replaceChildren();
    if (!query) return;

    let matches = [];
    if (pdf) {
      pdfTexts.forEach((text, i) => {
        const lower = text.toLocaleLowerCase();
        let at = 0;
        while ((at = lower.indexOf(query, at)) >= 0 && matches.length < 200) {
          matches.push({
            page: i + 1,
            snippet: text.slice(Math.max(0, at - 45), at + query.length + 65).trim()
          });
          at += query.length;
        }
      });
    } else if (docxMode && pageNodes[0]) {
      const text = pageNodes[0].innerText;
      const lower = text.toLocaleLowerCase();
      let at = 0;
      while ((at = lower.indexOf(query, at)) >= 0 && matches.length < 200) {
        matches.push({
          page: Math.min(docxPageCount, Math.floor(at / Math.max(1, text.length) * docxPageCount) + 1),
          snippet: text.slice(Math.max(0, at - 45), at + query.length + 65).trim()
        });
        at += query.length;
      }
    }

    const summary = document.createElement('div');
    summary.className = 'search-summary';
    summary.textContent = `${matches.length}${matches.length === 200 ? '+' : ''} match${matches.length === 1 ? '' : 'es'}`;
    resultBox.append(summary);

    matches.slice(0, 25).forEach(match => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-result';
      btn.textContent = `Page ${match.page} · ${match.snippet}`;
      btn.addEventListener('click', () => scrollToPage(match.page));
      resultBox.append(btn);
    });
  }


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

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (pdf) redrawPdf();
      else { updateDocxPageCount(); updateCurrentPage(); }
    }, 150);
  });

  
  function renderPageHighlights(pageNum, node) {
    if (!node) return;
    node.querySelectorAll('.highlight-box:not(.highlight-drawing)').forEach(el => el.remove());
    const pageHighlights = documentHighlights.filter(h => h.page === pageNum);
    pageHighlights.forEach(h => {
      const box = document.createElement('div');
      box.className = 'highlight-box';
      box.style.left = `${h.x}%`;
      box.style.top = `${h.y}%`;
      box.style.width = `${h.w}%`;
      box.style.height = `${h.h}%`;
      node.appendChild(box);
    });
  }

  
  // --- Professional Text Selection & Highlighter System ---
  function saveHighlights() {
    try {
      localStorage.setItem('mai-highlights-' + fileKey, JSON.stringify(documentHighlights));
    } catch {}
    updateHighlightUi();
  }

  function updateHighlightUi() {
    const hasHighlights = documentHighlights.length > 0;
    $('download-pdf')?.classList.toggle('hidden', !hasHighlights);
    $('highlight-clear')?.classList.toggle('hidden', !hasHighlights);
    const toggleBtn = $('highlight-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('selected', isHighlighting);
      toggleBtn.textContent = isHighlighting ? 'Done' : 'Draw';
    }
  }

  function renderPageHighlights(pageNum, node) {
    if (!node) return;
    node.querySelectorAll('.text-highlight-wrap').forEach(el => el.remove());
    node.querySelectorAll('.highlight-box:not(.highlight-drawing)').forEach(el => el.remove());

    const pageHighlights = documentHighlights.filter(h => h.page === pageNum);
    pageHighlights.forEach(h => {
      const wrap = document.createElement('div');
      wrap.className = 'text-highlight-wrap';
      wrap.dataset.id = h.id;

      if (h.rects && h.rects.length) {
        h.rects.forEach(r => {
          const band = document.createElement('div');
          band.className = 'text-highlight-band';
          band.style.left = `${r.x}%`;
          band.style.top = `${r.y}%`;
          band.style.width = `${r.w}%`;
          band.style.height = `${r.h}%`;
          band.title = 'Click to delete highlight';
          band.addEventListener('click', e => {
            e.stopPropagation();
            deleteHighlight(h.id);
          });
          wrap.appendChild(band);
        });
      } else if (h.x !== undefined && h.w !== undefined) {
        const band = document.createElement('div');
        band.className = 'text-highlight-band';
        band.style.left = `${h.x}%`;
        band.style.top = `${h.y}%`;
        band.style.width = `${h.w}%`;
        band.style.height = `${h.h}%`;
        band.title = 'Click to delete highlight';
        band.addEventListener('click', e => {
          e.stopPropagation();
          deleteHighlight(h.id);
        });
        wrap.appendChild(band);
      }

      node.appendChild(wrap);
    });
  }

  function deleteHighlight(id) {
    documentHighlights = documentHighlights.filter(h => h.id !== id);
    saveHighlights();
    document.querySelectorAll(`.text-highlight-wrap[data-id="${id}"]`).forEach(el => el.remove());
    showToast('Highlight deleted');
  }

  function hideSelectionTooltip() {
    $('selection-tooltip')?.classList.add('hidden');
  }

  function handleTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      hideSelectionTooltip();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      hideSelectionTooltip();
      return;
    }

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;
    if (!container.closest('#reading-surface')) {
      hideSelectionTooltip();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      hideSelectionTooltip();
      return;
    }

    const tooltip = $('selection-tooltip');
    if (!tooltip) return;

    const left = Math.max(80, Math.min(window.innerWidth - 80, rect.left + rect.width / 2));
    const top = Math.max(12, rect.top - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove('hidden');
  }

  function applyHighlightToSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;
    const pageNode = container.closest('.document-page');
    if (!pageNode) return;

    const rects = Array.from(range.getClientRects());
    if (!rects.length) return;

    const pageRect = pageNode.getBoundingClientRect();
    const pageNum = Number(pageNode.dataset.page) || 1;

    const highlightRects = rects.map(r => ({
      x: ((r.left - pageRect.left) / pageRect.width) * 100,
      y: ((r.top - pageRect.top) / pageRect.height) * 100,
      w: (r.width / pageRect.width) * 100,
      h: (r.height / pageRect.height) * 100
    })).filter(r => r.w > 0.05 && r.h > 0.05);

    if (!highlightRects.length) return;

    const highlightItem = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      page: pageNum,
      text: selectedText,
      rects: highlightRects
    };

    documentHighlights.push(highlightItem);
    saveHighlights();
    renderPageHighlights(pageNum, pageNode);

    selection.removeAllRanges();
    hideSelectionTooltip();
    showToast('Highlighted!');
  }

  // Selection events
  document.addEventListener('mouseup', () => setTimeout(handleTextSelection, 30));
  document.addEventListener('touchend', () => setTimeout(handleTextSelection, 120));
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#selection-tooltip')) {
      hideSelectionTooltip();
    }
  });

  $('btn-highlight-selection')?.addEventListener('click', applyHighlightToSelection);

  $('btn-copy-selection')?.addEventListener('click', () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard');
        hideSelectionTooltip();
      }).catch(() => {
        showToast('Text copied');
        hideSelectionTooltip();
      });
    }
  });

  // Freehand Draw mode
  function setHighlighterMode(active) {
    if (docxMode && active) {
      showToast('Draw mode is for PDFs; select text directly to highlight');
      return;
    }
    isHighlighting = Boolean(active);
    surface.classList.toggle('highlighting-mode', isHighlighting);
    $('highlight-bar')?.classList.toggle('hidden', !isHighlighting);
    updateHighlightUi();
    if (isHighlighting) {
      showToast('Draw mode active: drag a box over any text');
    }
  }

  $('highlight-toggle')?.addEventListener('click', () => {
    setHighlighterMode(!isHighlighting);
  });

  $('highlight-bar-done')?.addEventListener('click', () => {
    setHighlighterMode(false);
  });

  $('highlight-clear')?.addEventListener('click', () => {
    if (!documentHighlights.length) return;
    if (!confirm('Clear all highlights from this document?')) return;
    documentHighlights = [];
    try { localStorage.removeItem('mai-highlights-' + fileKey); } catch {}
    document.querySelectorAll('.text-highlight-wrap').forEach(el => el.remove());
    document.querySelectorAll('.highlight-box').forEach(el => el.remove());
    updateHighlightUi();
    showToast('All highlights cleared');
  });

  let highlightStart = null;
  let activeHighlightBox = null;
  let activePageNode = null;
  let activePageNum = null;

  surface.addEventListener('pointerdown', e => {
    if (!isHighlighting || !pdf) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const targetNode = e.target.closest('.document-page');
    if (!targetNode) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = targetNode.getBoundingClientRect();
    activePageNode = targetNode;
    activePageNum = Number(targetNode.dataset.page) || (pageNodes.indexOf(targetNode) + 1);

    highlightStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      rectW: rect.width,
      rectH: rect.height
    };

    activeHighlightBox = document.createElement('div');
    activeHighlightBox.className = 'highlight-box highlight-drawing';
    activeHighlightBox.style.left = `${(highlightStart.x / rect.width) * 100}%`;
    activeHighlightBox.style.top = `${(highlightStart.y / rect.height) * 100}%`;
    activeHighlightBox.style.width = '0%';
    activeHighlightBox.style.height = '0%';
    activePageNode.appendChild(activeHighlightBox);
  }, { capture: true, passive: false });

  window.addEventListener('pointermove', e => {
    if (!highlightStart || !activeHighlightBox || !activePageNode) return;
    e.preventDefault();

    const rect = activePageNode.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const minX = Math.min(highlightStart.x, currentX);
    const minY = Math.min(highlightStart.y, currentY);
    const width = Math.abs(currentX - highlightStart.x);
    const height = Math.abs(currentY - highlightStart.y);

    activeHighlightBox.style.left = `${(minX / rect.width) * 100}%`;
    activeHighlightBox.style.top = `${(minY / rect.height) * 100}%`;
    activeHighlightBox.style.width = `${(width / rect.width) * 100}%`;
    activeHighlightBox.style.height = `${(height / rect.height) * 100}%`;
  }, { passive: false });

  window.addEventListener('pointerup', e => {
    if (!highlightStart || !activeHighlightBox || !activePageNode) return;

    const pixelWidth = Math.abs(e.clientX - highlightStart.clientX);
    const pixelHeight = Math.abs(e.clientY - highlightStart.clientY);

    if (pixelWidth > 6 || pixelHeight > 6) {
      activeHighlightBox.classList.remove('highlight-drawing');
      const newHighlight = {
        id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        page: activePageNum,
        x: parseFloat(activeHighlightBox.style.left),
        y: parseFloat(activeHighlightBox.style.top),
        w: parseFloat(activeHighlightBox.style.width),
        h: parseFloat(activeHighlightBox.style.height)
      };
      documentHighlights.push(newHighlight);
      saveHighlights();
      renderPageHighlights(activePageNum, activePageNode);
      showToast('Highlight added');
    } else {
      activeHighlightBox.remove();
    }

    highlightStart = null;
    activeHighlightBox = null;
    activePageNode = null;
    activePageNum = null;
  });

  // Export PDF with burned-in highlights
  $('download-pdf')?.addEventListener('click', async () => {
    if (!globalPdfBytes) {
      showToast('Original PDF data not found');
      return;
    }
    if (!window.PDFLib) {
      showToast('PDF-Lib is still loading. Please retry in a moment.');
      return;
    }
    const downloadPdfBtn = $('download-pdf');
    try {
      if (downloadPdfBtn) {
        downloadPdfBtn.style.opacity = '0.5';
        downloadPdfBtn.textContent = 'Exporting...';
      }

      const { PDFDocument, rgb } = window.PDFLib;
      const pdfDoc = await PDFDocument.load(globalPdfBytes);
      const pages = pdfDoc.getPages();

      documentHighlights.forEach(h => {
        if (h.page <= pages.length) {
          const page = pages[h.page - 1];
          const { width, height } = page.getSize();

          const rectsToDraw = h.rects && h.rects.length ? h.rects : [{ x: h.x, y: h.y, w: h.w, h: h.h }];

          rectsToDraw.forEach(r => {
            const x = (r.x / 100) * width;
            const w = (r.w / 100) * width;
            const hPt = (r.h / 100) * height;
            const y = height - ((r.y / 100) * height) - hPt;

            page.drawRectangle({
              x: x,
              y: y,
              width: w,
              height: hPt,
              color: rgb(1, 0.92, 0.23),
              opacity: 0.45,
            });
          });
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const originalName = $('doc-title-text')?.textContent || 'document';
      a.download = originalName.replace(/\.pdf$/i, '') + '_highlighted.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showToast('Highlighted PDF downloaded!');
    } catch (err) {
      console.error(err);
      showToast('Export failed: ' + err.message);
    } finally {
      if (downloadPdfBtn) {
        downloadPdfBtn.style.opacity = '';
        downloadPdfBtn.textContent = 'Export';
      }
      updateHighlightUi();
    }
  });

})();








