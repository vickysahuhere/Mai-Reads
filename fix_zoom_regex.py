import re

with open('reader.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix beginZoomGesture
begin_zoom_old = re.compile(r'function beginZoomGesture\([^)]*\)\s*\{\s*pinchState = \{ startZoom \};')
begin_zoom_new = '''function beginZoomGesture(startZoom = Number(zoomInput.value)) {
    pinchState = { startZoom, startScrollTop: surface.scrollTop };'''
content = begin_zoom_old.sub(begin_zoom_new, content)

# Fix setZoomPreview
set_zoom_old = re.compile(r'updateSinglePageSlots\(\);\s*\}\s*\}')
set_zoom_new = '''updateSinglePageSlots();
      if (pinchState && pinchState.startScrollTop !== undefined) {
        surface.scrollTop = pinchState.startScrollTop * ratio;
      }
    }
  }'''
content = set_zoom_old.sub(set_zoom_new, content)

# Fix redrawPdf
redraw_old = re.compile(r'async function redrawPdf\(\)\s*\{.*?updateCurrentPage\(\);\s*\}', re.DOTALL)
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
content = redraw_old.sub(redraw_new, content)

with open('reader.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
