import re

with open('reader.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix beginZoomGesture
begin_zoom_old = '''function beginZoomGesture(startZoom = Number(zoomInput.value)) {
    pinchState = { startZoom };'''
begin_zoom_new = '''function beginZoomGesture(startZoom = Number(zoomInput.value)) {
    pinchState = { startZoom, startScrollTop: surface.scrollTop };'''

content = content.replace(begin_zoom_old, begin_zoom_new)

# Fix setZoomPreview
set_zoom_old = '''updateSinglePageSlots();
    }
  }'''
set_zoom_new = '''updateSinglePageSlots();
      if (pinchState.startScrollTop !== undefined) {
        surface.scrollTop = pinchState.startScrollTop * ratio;
      }
    }
  }'''

content = content.replace(set_zoom_old, set_zoom_new)

# Fix redrawPdf
redraw_old = '''async function redrawPdf() {
    const token = ++renderToken;
    const pageToRestore = Number(page-current.textContent) || 1;
    for (let i = 0; i < pageNodes.length; i++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(i + 1);
      await drawPdfPage(page, pageNodes[i].querySelector('canvas'), pageNodes[i], page.getViewport({ scale: 1 }));
    }
    updateSinglePageSlots();
    scrollToPage(pageToRestore, false);
    updateCurrentPage();
  }'''

redraw_new = '''async function redrawPdf() {
    const token = ++renderToken;
    const oldScrollTop = surface.scrollTop;
    const oldScrollHeight = surface.scrollHeight || 1;
    const scrollRatio = oldScrollTop / oldScrollHeight;

    for (let i = 0; i < pageNodes.length; i++) {
      if (token !== renderToken) return;
      const page = await pdf.getPage(i + 1);
      await drawPdfPage(page, pageNodes[i].querySelector('canvas'), pageNodes[i], page.getViewport({ scale: 1 }));
      if (mode === 'continuous') surface.scrollTop = scrollRatio * surface.scrollHeight;
    }
    updateSinglePageSlots();
    if (mode === 'continuous') surface.scrollTop = scrollRatio * surface.scrollHeight;
    else scrollToPage(Number(page-current.textContent) || 1, false);
    updateCurrentPage();
  }'''

content = content.replace(redraw_old, redraw_new)

with open('reader.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
