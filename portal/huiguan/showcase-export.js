/* Render a script-free copy in the host. The live saved HTML remains opaque. */
(function () {
  let sourceFrame, snapshot = '', loading, busy = false;
  const tags = new Set('HTML HEAD TITLE STYLE BODY DIV SPAN P H1 H2 H3 H4 H5 H6 BR HR TABLE THEAD TBODY TFOOT TR TH TD UL OL LI STRONG B EM I SMALL DETAILS SUMMARY A IMG BUTTON NAV FOOTER SECTION'.split(' '));
  function safeDocument(html, colors) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const node of [...doc.querySelectorAll('*')]) {
      if (!tags.has(node.tagName)) { node.remove(); continue; }
      for (const attribute of [...node.attributes]) {
        if (/^on/i.test(attribute.name) || ['srcdoc', 'srcset', 'href', 'action', 'formaction', 'form'].includes(attribute.name.toLowerCase())) node.removeAttribute(attribute.name);
      }
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src') || '';
        if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)) continue;
        try {
          const url = new URL(src, location.href);
          if (url.origin !== location.origin || !/^\/assets\/uploads\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(url.pathname)) throw new Error('unsupported image');
          node.src = url.href;
        } catch { node.removeAttribute('src'); }
      }
    }
    const csp = doc.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-src 'self' about:";
    doc.head.prepend(csp);
    if (HuiguanColors.valid(colors?.primary) && HuiguanColors.valid(colors?.accent)) {
      const theme = HuiguanColors.build(colors.primary, colors.accent);
      if (HuiguanColors.valid(colors.background)) theme.primaryDark = colors.background;
      const style = doc.createElement('style');
      style.textContent = ':root:not([data-theme="cream"]){' + Object.entries(HuiguanColors.tokens(theme)).map(([key, value]) => key + ':' + value).join(';') + '}';
      doc.head.appendChild(style);
    }
    if (colors?.cream === true) doc.documentElement.setAttribute('data-theme', 'cream');
    const staticStyle = doc.createElement('style');
    staticStyle.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}.reveal,.hero{opacity:1!important;transform:none!important}#saveImgBtn,#themeToggle{visibility:hidden}';
    doc.head.appendChild(staticStyle);
    return '<!doctype html>' + doc.documentElement.outerHTML;
  }
  function loadRenderer() {
    if (window.html2canvas) return Promise.resolve();
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = () => { loading = null; reject(new Error('图片库加载失败，请稍后重试')); };
      document.head.appendChild(script);
    });
    return loading;
  }
  async function exportImage(colors) {
    await loadRenderer();
    const frame = document.createElement('iframe');
    // This copy has no scripts, events, forms or non-gallery images; scripts stay disabled.
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;border:0;pointer-events:none';
    frame.width = Math.max(320, Math.min(1920, sourceFrame.clientWidth));
    frame.height = Math.max(600, sourceFrame.clientHeight);
    const ready = new Promise(resolve => { frame.onload = resolve; });
    frame.srcdoc = safeDocument(snapshot, colors);
    document.body.appendChild(frame);
    try {
      await ready;
      const doc = frame.contentDocument;
      await Promise.all([...doc.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = image.onerror = resolve; })));
      await doc.fonts.ready;
      const page = doc.querySelector('.page') || doc.body;
      const bounds = page.getBoundingClientRect();
      const scale = Math.min(2, Math.sqrt(16000000 / Math.max(1, bounds.width * bounds.height)), 16384 / Math.max(1, bounds.height));
      const canvas = await html2canvas(page, { backgroundColor: getComputedStyle(doc.body).backgroundColor, scale, useCORS: true });
      HuiguanImages.download(await HuiguanImages.canvasBlob(canvas), (doc.title || '人设表') + '.png');
    } finally { frame.remove(); }
  }
  window.addEventListener('message', async event => {
    if (event.source !== sourceFrame?.contentWindow || event.data?.type !== 'huiguan-showcase-export' || typeof event.data.requestId !== 'string' || event.data.requestId.length > 128 || busy) return;
    const { requestId, colors } = event.data;
    busy = true;
    let error = '';
    try { await exportImage(colors); } catch (failure) { error = failure.message || '生成图片失败，请重试'; }
    finally { busy = false; }
    sourceFrame.contentWindow.postMessage({ type: 'huiguan-showcase-export-result', requestId, error }, '*');
  });
  window.HuiguanShowcaseExport = {
    mount(frame, html) {
      sourceFrame = frame; snapshot = html;
      const script = '<script src="/showcase-download.js?v=20261014"></script>';
      return html.includes('</body>') ? html.replace('</body>', script + '</body>') : html + script;
    }
  };
})();
