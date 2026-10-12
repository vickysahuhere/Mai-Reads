(() => {
  const $ = id => document.getElementById(id);

  const STORE = 'mai-reads-v1';
  const DB_NAME = 'mai-reads-store';
  const DB_VERSION = 2;
  const STORE_DOCS = 'documents';
  const STORE_NOTEBOOKS = 'notebooks';

  let queuedFiles = [];
  let editingNotebookId = null;
  let selectedColor = 'amber';
  let toastTimer = null;

  // ── IndexedDB Engine ──────────────────────────────────────────────────────
  function getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
          db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllNotebooks() {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
        const store = tx.objectStore(STORE_NOTEBOOKS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not load notebooks from IndexedDB:', err);
      return [];
    }
  }

  async function getNotebookById(id) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
        const store = tx.objectStore(STORE_NOTEBOOKS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return null;
    }
  }

  async function saveNotebookToDB(notebook) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
      const store = tx.objectStore(STORE_NOTEBOOKS);
      store.put(notebook);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Could not save notebook:', err);
      return false;
    }
  }

  async function deleteNotebookFromDB(id) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
      const store = tx.objectStore(STORE_NOTEBOOKS);
      store.delete(id);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      return false;
    }
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
        file,
        size: file.size,
        savedAt: Date.now()
      });
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not cache file in IndexedDB:', err);
      return false;
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
      return null;
    }
  }

  // ── Storage & Preferences ─────────────────────────────────────────────────
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch { return {}; }
  }

  function saveStore(update) {
    const value = { ...readStore(), ...update };
    try { localStorage.setItem(STORE, JSON.stringify(value)); } catch {}
  }

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

  function applyTheme(theme) {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
    const iconEl = $('docs-theme-icon');
    if (iconEl) iconEl.innerHTML = dark ? SUN_SVG : MOON_SVG;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = dark ? '#1c1d1a' : '#f6f3ec';
  }

  const currentTheme = readStore().theme || 'system';
  applyTheme(currentTheme);

  $('docs-theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.resolvedTheme === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    saveStore({ theme: next });
    showToast(`${next.charAt(0).toUpperCase() + next.slice(1)} mode enabled`, 1800);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatBytes(bytes, decimals = 1) {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function relativeDate(ts) {
    if (!ts) return 'Recently';
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

  // ── UI Rendering ──────────────────────────────────────────────────────────
  async function loadAndRenderNotebooks() {
    const notebooks = await getAllNotebooks();
    const grid = $('notebook-grid');
    const empty = $('notebook-empty');
    const statsContainer = $('notebook-stats');
    if (!grid) return;

    grid.replaceChildren();

    // Calculate total stats
    const totalCount = notebooks.length;
    let totalDocs = 0;
    notebooks.forEach(nb => {
      totalDocs += (nb.files || []).length;
    });

    if (statsContainer) {
      statsContainer.innerHTML = `
        <span class="nb-stat-pill"><strong>${totalCount}</strong> Notebook${totalCount === 1 ? '' : 's'}</span>
        <span class="nb-stat-pill"><strong>${totalDocs}</strong> Document${totalDocs === 1 ? '' : 's'}</span>
      `;
    }

    if (totalCount === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    notebooks.forEach(nb => {
      const card = document.createElement('div');
      card.className = 'nb-card';

      const fileCount = (nb.files || []).length;
      const accentColor = nb.color || 'amber';

      let filesHtml = '';
      if (fileCount > 0) {
        filesHtml = (nb.files || []).map(f => {
          const ext = f.type || (f.name.endsWith('.docx') ? 'docx' : 'pdf');
          return `
            <div class="nb-card-file-item" title="${f.name}">
              <span class="nb-file-badge nb-file-badge-${ext}">${ext.toUpperCase()}</span>
              <span class="nb-card-file-name">${f.name}</span>
              <span class="nb-card-meta">${formatBytes(f.size)}</span>
            </div>
          `;
        }).join('');
      } else {
        filesHtml = `<div class="nb-card-file-item" style="color:var(--muted);font-style:italic;">No documents yet</div>`;
      }

      card.innerHTML = `
        <div class="nb-card-accent color-${accentColor}"></div>
        <div class="nb-card-header">
          <div class="nb-card-title-group">
            <h3 class="nb-card-title">${nb.title}</h3>
            ${nb.description ? `<p class="nb-card-desc">${nb.description}</p>` : ''}
          </div>
          <button class="nb-card-menu-btn" type="button" aria-label="Notebook options" title="Notebook options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
            </svg>
          </button>
        </div>

        <div class="nb-card-files-section">
          <div class="nb-card-files-label">${fileCount} Document${fileCount === 1 ? '' : 's'}</div>
          <div class="nb-card-file-list">
            ${filesHtml}
          </div>
        </div>

        <div class="nb-card-footer">
          <span class="nb-card-meta">Updated ${relativeDate(nb.updatedAt)}</span>
          <div class="nb-card-actions">
            <button class="nb-card-share-btn" type="button" aria-label="Share ${nb.title}" title="Share notebook">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span>Share</span>
            </button>
            <a href="index.html?notebook=${encodeURIComponent(nb.id)}" class="nb-card-open-btn" aria-label="Open ${nb.title} in Reader">
              <span>Open in Reader</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </div>
        </div>
      `;

      // Share button interaction
      const shareBtn = card.querySelector('.nb-card-share-btn');
      shareBtn?.addEventListener('click', e => {
        e.stopPropagation();
        openShareModal(nb);
      });

      // Menu button interactions (Edit / Delete / Share / Notes)
      const menuBtn = card.querySelector('.nb-card-menu-btn');
      menuBtn?.addEventListener('click', e => {
        e.stopPropagation();
        const action = prompt(`Notebook "${nb.title}":\nType "share" to share or export\nType "edit" to rename/add files\nType "delete" to remove\nType "notes" to view scratchpad`);
        if (action === 'delete') {
          if (confirm(`Are you sure you want to delete "${nb.title}"? Your documents will remain safe in storage.`)) {
            deleteNotebookFromDB(nb.id).then(() => {
              showToast(`Deleted "${nb.title}"`);
              loadAndRenderNotebooks();
            });
          }
        } else if (action === 'share') {
          openShareModal(nb);
        } else if (action === 'edit') {
          openEditModal(nb);
        } else if (action === 'notes') {
          alert(`Scratchpad notes for ${nb.title}:\n\n${nb.notes || '(No notes yet)'}`);
        }
      });

      grid.append(card);
    });
  }

  // ── Modal & File Queue Management ─────────────────────────────────────────
  const modalBackdrop = $('notebook-modal-backdrop');
  const modalTitle = $('modal-title');
  const titleInput = $('nb-title-input');
  const descInput = $('nb-desc-input');
  const queuedFilesContainer = $('nb-queued-files');
  const filePicker = $('nb-file-picker');
  const dropzone = $('nb-dropzone');

  function openCreateModal() {
    editingNotebookId = null;
    modalTitle.textContent = 'Create Study Notebook';
    titleInput.value = '';
    descInput.value = '';
    selectedColor = 'amber';
    updateColorSelection();
    queuedFiles = [];
    renderQueuedFiles();
    modalBackdrop.classList.add('open');
    titleInput.focus();
  }

  async function openEditModal(nb) {
    editingNotebookId = nb.id;
    modalTitle.textContent = 'Edit Study Notebook';
    titleInput.value = nb.title || '';
    descInput.value = nb.description || '';
    selectedColor = nb.color || 'amber';
    updateColorSelection();
    queuedFiles = []; // For adding new files
    renderQueuedFiles();
    modalBackdrop.classList.add('open');
    titleInput.focus();
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
    queuedFiles = [];
  }

  function updateColorSelection() {
    document.querySelectorAll('.nb-color-choice').forEach(el => {
      el.classList.toggle('selected', el.dataset.color === selectedColor);
    });
  }

  document.querySelectorAll('.nb-color-choice').forEach(el => {
    el.addEventListener('click', () => {
      selectedColor = el.dataset.color;
      updateColorSelection();
    });
  });

  function renderQueuedFiles() {
    queuedFilesContainer.replaceChildren();
    if (queuedFiles.length === 0) {
      queuedFilesContainer.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:6px 0;">No new files queued yet</div>`;
      return;
    }

    queuedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'nb-queued-file';
      item.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${file.name} (${formatBytes(file.size)})</span>
        <button class="nb-queued-remove-btn" type="button" aria-label="Remove ${file.name}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      item.querySelector('.nb-queued-remove-btn').addEventListener('click', () => {
        queuedFiles.splice(index, 1);
        renderQueuedFiles();
      });
      queuedFilesContainer.append(item);
    });
  }

  function handleFilesAdded(fileList) {
    const valid = Array.from(fileList).filter(f => {
      return /\.(pdf|docx)$/i.test(f.name) || f.type.includes('pdf') || f.type.includes('wordprocessingml');
    });

    if (valid.length === 0) {
      showToast('Please select PDF or DOCX files.');
      return;
    }

    queuedFiles.push(...valid);
    renderQueuedFiles();
    showToast(`Added ${valid.length} file${valid.length === 1 ? '' : 's'} to queue`);
  }

  dropzone?.addEventListener('click', () => filePicker.click());
  filePicker?.addEventListener('change', e => {
    if (e.target.files) handleFilesAdded(e.target.files);
    e.target.value = '';
  });

  // Dropzone drag-and-drop
  dropzone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  });

  $('modal-close-btn')?.addEventListener('click', closeModal);
  $('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Save Notebook Form Submit
  $('nb-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      showToast('Please enter a notebook title.');
      return;
    }

    const saveBtn = $('modal-save-btn');
    if (saveBtn) saveBtn.textContent = 'Saving…';

    let notebook;
    if (editingNotebookId) {
      notebook = await getNotebookById(editingNotebookId);
      if (!notebook) {
        showToast('Notebook not found.');
        closeModal();
        return;
      }
      notebook.title = title;
      notebook.description = descInput.value.trim();
      notebook.color = selectedColor;
      notebook.updatedAt = Date.now();
    } else {
      notebook = {
        id: 'nb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title,
        description: descInput.value.trim(),
        color: selectedColor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes: '',
        activeFileKey: '',
        files: []
      };
    }

    // Save newly queued files to IndexedDB
    for (const file of queuedFiles) {
      const key = `${file.name.toLowerCase()}|${file.size}|${file.lastModified || 0}`;
      const isPdf = /\.pdf$/i.test(file.name) || file.type.includes('pdf');
      const type = isPdf ? 'pdf' : 'docx';

      // Cache document binary
      await saveDocToDB(key, file, file.name, type);

      // Check if file already exists in notebook
      const exists = (notebook.files || []).some(f => f.key === key);
      if (!exists) {
        notebook.files.push({
          key,
          name: file.name,
          type,
          size: file.size,
          addedAt: Date.now()
        });
      }

      if (!notebook.activeFileKey) {
        notebook.activeFileKey = key;
      }
    }

    await saveNotebookToDB(notebook);

    if (saveBtn) saveBtn.textContent = 'Save Notebook';
    closeModal();
    showToast(`Notebook "${notebook.title}" saved!`);
    loadAndRenderNotebooks();
  });

  // ── Global Actions ────────────────────────────────────────────────────────
  $('create-notebook-btn')?.addEventListener('click', openCreateModal);
  $('empty-create-btn')?.addEventListener('click', openCreateModal);

  // ── Feedback & Suggestions Engine ─────────────────────────────────────────
  const feedbackBackdrop = $('feedback-modal-backdrop');
  const feedbackForm = $('feedback-form');
  const feedbackFormContainer = $('feedback-form-container');
  const feedbackSuccessContainer = $('feedback-success-container');
  const feedbackMessageInput = $('feedback-message-input');
  const feedbackEmailInput = $('feedback-email-input');
  const feedbackSubmitBtn = $('feedback-submit-btn');
  let selectedFeedbackCategory = 'Feature Request';

  function openFeedbackModal() {
    if (!feedbackBackdrop) return;
    feedbackFormContainer?.classList.remove('hidden');
    feedbackSuccessContainer?.classList.add('hidden');
    if (feedbackMessageInput) feedbackMessageInput.value = '';
    feedbackBackdrop.classList.add('open');
    setTimeout(() => feedbackMessageInput?.focus(), 100);
  }

  function closeFeedbackModal() {
    feedbackBackdrop?.classList.remove('open');
  }

  document.querySelectorAll('.feedback-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.feedback-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      selectedFeedbackCategory = pill.dataset.cat || 'Feature Request';
    });
  });

  $('feedback-toggle-nb')?.addEventListener('click', openFeedbackModal);
  $('feedback-close-btn')?.addEventListener('click', closeFeedbackModal);
  $('feedback-cancel-btn')?.addEventListener('click', closeFeedbackModal);
  $('feedback-success-done-btn')?.addEventListener('click', closeFeedbackModal);

  feedbackBackdrop?.addEventListener('click', e => {
    if (e.target === feedbackBackdrop) closeFeedbackModal();
  });

  feedbackForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const message = feedbackMessageInput?.value.trim();
    if (!message) return;

    const email = feedbackEmailInput?.value.trim() || 'Anonymous';
    if (feedbackSubmitBtn) {
      feedbackSubmitBtn.disabled = true;
      feedbackSubmitBtn.innerHTML = `<span>Sending…</span>`;
    }

    try {
      await fetch('https://formsubmit.co/ajax/your-email@example.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `Mai-Reads Feedback: ${selectedFeedbackCategory}`,
          category: selectedFeedbackCategory,
          message: message,
          email: email,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('FormSubmit AJAX fallback:', err);
    } finally {
      if (feedbackSubmitBtn) {
        feedbackSubmitBtn.disabled = false;
        feedbackSubmitBtn.innerHTML = `<span>Send Feedback</span>`;
      }
      feedbackFormContainer?.classList.add('hidden');
      feedbackSuccessContainer?.classList.remove('hidden');
      showToast('Thank you! We appreciate your feedback.', 3000);
    }
  });

  // ── PWA Desktop/Mobile App Installation ──────────────────────────────────
  const PWA_INSTALLED_KEY = 'mai_reads_pwa_installed';
  let deferredInstallPrompt = null;

  function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
  }

  function hideAllInstallTriggers() {
    document.documentElement.classList.add('pwa-installed');
    document.querySelectorAll('.pwa-install-btn').forEach(btn => btn.classList.add('hidden'));
    const modalBackdrop = $('pwa-install-modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  }

  function markAppAsInstalled() {
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
    } catch (e) {}
    hideAllInstallTriggers();
  }

  function initPwaInstall() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    const installButtons = document.querySelectorAll('.pwa-install-btn');
    const modalBackdrop = $('pwa-install-modal-backdrop');
    const nativeSection = $('pwa-native-prompt-section');
    const triggerBtn = $('pwa-trigger-install-btn');
    const closeBtn = $('pwa-install-close-btn');
    const dismissBtn = $('pwa-install-dismiss-btn');

    if (isAppInstalled()) {
      markAppAsInstalled();
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (nativeSection) nativeSection.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      markAppAsInstalled();
      showToast('Mai-Reads installed to your system', 3200);
    });

    async function handleInstallAction() {
      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            deferredInstallPrompt = null;
            markAppAsInstalled();
            showToast('Mai-Reads installed to your system', 3200);
          }
        } catch (err) {
          openInstallModal();
        }
      } else {
        openInstallModal();
      }
    }

    function openInstallModal() {
      if (!modalBackdrop) return;
      if (deferredInstallPrompt && nativeSection) {
        nativeSection.classList.remove('hidden');
      }
      modalBackdrop.classList.add('open');
    }

    function closeInstallModal() {
      if (!modalBackdrop) return;
      modalBackdrop.classList.remove('open');
    }

    installButtons.forEach(btn => {
      btn.addEventListener('click', handleInstallAction);
    });

    triggerBtn?.addEventListener('click', handleInstallAction);
    closeBtn?.addEventListener('click', closeInstallModal);
    dismissBtn?.addEventListener('click', closeInstallModal);
    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeInstallModal();
    });
  }

  // ── Compression & Codec Utilities (Zero-Server) ───────────────────────────
  async function compressStringToBase64Url(str) {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(str));
    writer.close();
    const blob = await new Response(cs.readable).blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function decompressBase64UrlToString(b64url) {
    let stdB64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (stdB64.length % 4) stdB64 += '=';
    const binary = atob(stdB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Response(ds.readable).text();
  }

  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // ── Serverless Sharing Engine ──────────────────────────────────────────────
  let activeSharingNotebook = null;
  const shareModalBackdrop = $('share-modal-backdrop');
  const shareLinkInput = $('share-link-input');
  const shareCopyLinkBtn = $('share-copy-link-btn');
  const shareExportBundleBtn = $('share-export-bundle-btn');
  const shareExportBundleText = $('share-export-bundle-text');
  const shareModalCloseBtn = $('share-modal-close-btn');
  const shareModalDismissBtn = $('share-modal-dismiss-btn');

  async function openShareModal(nb) {
    activeSharingNotebook = nb;
    if (!shareModalBackdrop) return;

    if (shareCopyLinkBtn) shareCopyLinkBtn.textContent = 'Copy Link';
    if (shareExportBundleText) shareExportBundleText.textContent = 'Download .mainotebook File';
    if (shareExportBundleBtn) shareExportBundleBtn.disabled = false;

    // Generate compact URL payload
    const sharePayload = {
      v: 1,
      type: 'mai-notebook-share',
      title: nb.title,
      description: nb.description || '',
      color: nb.color || 'amber',
      notes: nb.notes || '',
      files: (nb.files || []).map(f => ({ name: f.name, type: f.type, size: f.size }))
    };

    try {
      const b64url = await compressStringToBase64Url(JSON.stringify(sharePayload));
      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${b64url}`;
      if (shareLinkInput) shareLinkInput.value = shareUrl;
    } catch (err) {
      console.warn('Could not compress share payload:', err);
      if (shareLinkInput) shareLinkInput.value = window.location.href;
    }

    shareModalBackdrop.classList.add('open');
  }

  function closeShareModal() {
    shareModalBackdrop?.classList.remove('open');
    activeSharingNotebook = null;
  }

  shareModalCloseBtn?.addEventListener('click', closeShareModal);
  shareModalDismissBtn?.addEventListener('click', closeShareModal);
  shareModalBackdrop?.addEventListener('click', e => {
    if (e.target === shareModalBackdrop) closeShareModal();
  });

  shareCopyLinkBtn?.addEventListener('click', async () => {
    if (!shareLinkInput?.value) return;
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      shareCopyLinkBtn.textContent = 'Copied!';
      showToast('Shareable link copied to clipboard', 2200);
      setTimeout(() => {
        if (shareCopyLinkBtn) shareCopyLinkBtn.textContent = 'Copy Link';
      }, 2000);
    } catch (e) {
      shareLinkInput.select();
      document.execCommand('copy');
      shareCopyLinkBtn.textContent = 'Copied!';
      showToast('Link copied to clipboard', 2200);
      setTimeout(() => {
        if (shareCopyLinkBtn) shareCopyLinkBtn.textContent = 'Copy Link';
      }, 2000);
    }
  });

  shareExportBundleBtn?.addEventListener('click', async () => {
    if (!activeSharingNotebook) return;
    if (shareExportBundleBtn) shareExportBundleBtn.disabled = true;
    if (shareExportBundleText) shareExportBundleText.textContent = 'Packing bundle…';

    try {
      await exportNotebookBundle(activeSharingNotebook);
      showToast(`Exported "${activeSharingNotebook.title}.mainotebook"`, 3000);
    } catch (err) {
      console.error('Failed to export bundle:', err);
      showToast('Export failed. Please try again.', 2600);
    } finally {
      if (shareExportBundleBtn) shareExportBundleBtn.disabled = false;
      if (shareExportBundleText) shareExportBundleText.textContent = 'Download .mainotebook File';
    }
  });

  async function exportNotebookBundle(nb) {
    const embeddedDocs = [];
    for (const f of (nb.files || [])) {
      const docRecord = await getDocFromDB(f.key);
      if (docRecord && docRecord.file) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(docRecord.file);
        });
        embeddedDocs.push({
          key: f.key,
          name: f.name,
          type: f.type,
          size: f.size,
          dataUrl
        });
      }
    }

    const bundle = {
      format: 'mai-notebook-bundle',
      version: 1,
      exportedAt: Date.now(),
      notebook: {
        id: nb.id,
        title: nb.title,
        description: nb.description || '',
        color: nb.color || 'amber',
        notes: nb.notes || '',
        activeFileKey: nb.activeFileKey || '',
        files: nb.files || []
      },
      documents: embeddedDocs
    };

    const jsonStr = JSON.stringify(bundle);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(jsonStr));
    writer.close();
    const compressedBlob = await new Response(cs.readable).blob();

    const cleanName = (nb.title || 'study-notebook').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const blob = new Blob([compressedBlob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.mainotebook`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Import Confirmation & Processing Engine ───────────────────────────────
  let pendingImportData = null;
  const importModalBackdrop = $('import-modal-backdrop');
  const importModalCloseBtn = $('import-modal-close-btn');
  const importModalCancelBtn = $('import-modal-cancel-btn');
  const importModalConfirmBtn = $('import-modal-confirm-btn');
  const importPreviewTitle = $('import-preview-title');
  const importPreviewDesc = $('import-preview-desc');
  const importPreviewBadge = $('import-preview-badge');
  const importPreviewMeta = $('import-preview-meta');
  const importPreviewNotesWrap = $('import-preview-notes-wrap');
  const importPreviewNotes = $('import-preview-notes');
  const importNotebookBtn = $('import-notebook-btn');
  const importBundlePicker = $('import-bundle-picker');

  function openImportModal(data) {
    pendingImportData = data;
    if (!importModalBackdrop) return;

    const isBundle = data.mode === 'bundle';
    const nbInfo = isBundle ? data.payload.notebook : data.payload;
    const fileList = isBundle ? (data.payload.notebook.files || []) : (data.payload.files || []);

    if (importPreviewTitle) importPreviewTitle.textContent = nbInfo.title || 'Untitled Notebook';
    if (importPreviewDesc) {
      importPreviewDesc.textContent = nbInfo.description || 'No description provided';
      importPreviewDesc.style.display = nbInfo.description ? 'block' : 'none';
    }
    if (importPreviewBadge) {
      importPreviewBadge.textContent = isBundle ? 'Portable Archive' : 'Serverless Link';
    }

    if (importPreviewMeta) {
      let metaHtml = `<div style="font-weight:600;margin-bottom:4px;">${fileList.length} Document${fileList.length === 1 ? '' : 's'} included${isBundle ? ' (full binaries ready)' : ''}</div>`;
      if (fileList.length > 0) {
        metaHtml += fileList.map(f => `
          <div class="nb-import-file-row">
            <span class="nb-file-badge nb-file-badge-${f.type || 'pdf'}">${(f.type || 'pdf').toUpperCase()}</span>
            <span style="font-weight:500;">${f.name}</span>
            <span class="nb-card-meta">${formatBytes(f.size)}</span>
          </div>
        `).join('');
      } else {
        metaHtml += `<div style="color:var(--muted);font-style:italic;">No attached documents</div>`;
      }
      importPreviewMeta.innerHTML = metaHtml;
    }

    if (nbInfo.notes && nbInfo.notes.trim()) {
      if (importPreviewNotesWrap) importPreviewNotesWrap.classList.remove('hidden');
      if (importPreviewNotes) importPreviewNotes.textContent = nbInfo.notes;
    } else {
      if (importPreviewNotesWrap) importPreviewNotesWrap.classList.add('hidden');
    }

    importModalBackdrop.classList.add('open');
  }

  function closeImportModal() {
    importModalBackdrop?.classList.remove('open');
    pendingImportData = null;
  }

  importModalCloseBtn?.addEventListener('click', closeImportModal);
  importModalCancelBtn?.addEventListener('click', closeImportModal);
  importModalBackdrop?.addEventListener('click', e => {
    if (e.target === importModalBackdrop) closeImportModal();
  });

  importModalConfirmBtn?.addEventListener('click', async () => {
    if (!pendingImportData) return;
    if (importModalConfirmBtn) {
      importModalConfirmBtn.disabled = true;
      importModalConfirmBtn.innerHTML = `<span>Importing…</span>`;
    }

    try {
      if (pendingImportData.mode === 'bundle') {
        const bundle = pendingImportData.payload;
        for (const doc of (bundle.documents || [])) {
          if (doc.dataUrl) {
            const fileObj = dataURLtoFile(doc.dataUrl, doc.name);
            await saveDocToDB(doc.key, fileObj, doc.name, doc.type);
          }
        }
        const targetNb = {
          ...bundle.notebook,
          id: 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          updatedAt: Date.now()
        };
        await saveNotebookToDB(targetNb);
        showToast(`Imported "${targetNb.title}" with ${(bundle.documents || []).length} document(s)`, 3000);
      } else if (pendingImportData.mode === 'hash') {
        const payload = pendingImportData.payload;
        const targetNb = {
          id: 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          title: payload.title,
          description: payload.description || '',
          color: payload.color || 'amber',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          notes: payload.notes || '',
          activeFileKey: '',
          files: (payload.files || []).map(f => ({
            key: `${f.name.toLowerCase()}|${f.size}|0`,
            name: f.name,
            type: f.type || 'pdf',
            size: f.size || 0,
            addedAt: Date.now()
          }))
        };
        await saveNotebookToDB(targetNb);
        showToast(`Imported "${targetNb.title}" to your notebooks`, 3000);
        if (window.location.hash) {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }

      closeImportModal();
      await loadAndRenderNotebooks();
    } catch (err) {
      console.error('Import confirmation failed:', err);
      showToast('Import failed. Please check the file.', 2800);
    } finally {
      if (importModalConfirmBtn) {
        importModalConfirmBtn.disabled = false;
        importModalConfirmBtn.innerHTML = `<span>Import to My Notebooks</span>`;
      }
    }
  });

  importNotebookBtn?.addEventListener('click', () => {
    importBundlePicker?.click();
  });

  async function handleBundleFile(file) {
    if (!file) return;
    try {
      let jsonText = '';
      try {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = file.stream().pipeThrough(ds);
        jsonText = await new Response(decompressedStream).text();
      } catch (gzipErr) {
        jsonText = await file.text();
      }
      const bundle = JSON.parse(jsonText);
      if (!bundle || (!bundle.notebook && !bundle.title)) {
        throw new Error('Not a valid notebook bundle');
      }
      openImportModal({ mode: 'bundle', payload: bundle });
    } catch (err) {
      console.error('Could not parse imported bundle:', err);
      showToast('Invalid .mainotebook bundle file', 2600);
    }
  }

  importBundlePicker?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (file) {
      await handleBundleFile(file);
    }
    if (importBundlePicker) importBundlePicker.value = '';
  });

  // Enable drag and drop of .mainotebook files anywhere on the page
  window.addEventListener('dragover', e => {
    e.preventDefault();
  });

  window.addEventListener('drop', async e => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const bundleFile = Array.from(files).find(f => f.name.endsWith('.mainotebook') || f.name.endsWith('.json'));
      if (bundleFile) {
        await handleBundleFile(bundleFile);
      }
    }
  });

  async function checkShareHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#share=')) {
      const b64url = hash.slice('#share='.length);
      if (!b64url) return;
      try {
        const jsonText = await decompressBase64UrlToString(b64url);
        const payload = JSON.parse(jsonText);
        if (payload && payload.title) {
          openImportModal({ mode: 'hash', payload });
        }
      } catch (err) {
        console.warn('Could not unpack share link from hash:', err);
        showToast('Invalid or corrupted notebook share link', 2800);
      }
    }
  }

  window.addEventListener('hashchange', checkShareHash);

  // Initialize
  initPwaInstall();
  loadAndRenderNotebooks();
  checkShareHash();
})();
