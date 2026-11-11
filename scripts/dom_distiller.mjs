/**
 * Build a compact map of visible interactive controls, including controls in
 * open shadow roots. The returned object is safe to serialize into model prompts.
 */
export async function distillDOM(page, maxElements = 120) {
  const limit = Math.max(0, Math.min(500, Number(maxElements) || 0));
  return page.evaluate((max) => {
    const selector = [
      'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="menuitem"]', '[role="tab"]', '[role="combobox"]',
      '[contenteditable="true"]'
    ].join(',');
    const found = [];
    const seen = new Set();
    const visit = (root) => {
      for (const el of root.querySelectorAll(selector)) {
        if (!seen.has(el)) { seen.add(el); found.push(el); }
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    };
    const quote = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const selectorFor = (el) => {
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-qa');
      if (testId) return `[data-testid="${quote(testId.slice(0, 120))}"]`;
      if (el.id && !/\d{4,}/.test(el.id)) return `#${CSS.escape(el.id.slice(0, 120))}`;
      for (const attr of ['aria-label', 'name', 'placeholder']) {
        const value = el.getAttribute(attr);
        if (value) return `${tag}[${attr}="${quote(value.slice(0, 120))}"]`;
      }
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && text.length <= 35 && (tag === 'button' || tag === 'a')) return `${tag}:has-text("${quote(text)}")`;
      return tag;
    };

    visit(document);
    const items = [];
    const lines = [];
    for (const el of found) {
      if (items.length >= max) break;
      if (!visible(el)) continue;
      const text = (el.innerText || el.value || el.getAttribute('placeholder') ||
        el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 55);
      const item = {
        index: items.length,
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        role: (el.getAttribute('role') || '').slice(0, 80),
        type: (el.getAttribute('type') || '').slice(0, 40),
        text,
        visible: true,
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        selector: selectorFor(el)
      };
      const line = `[${item.index}] <${item.tag}${item.role ? ` role="${item.role}"` : ''}${item.type ? ` type="${item.type}"` : ''}>${item.disabled ? ' [DISABLED]' : ''} text="${item.text}" | selector=${JSON.stringify(item.selector)}`;
      // Six thousand characters is a conservative ~1,500-token prompt budget.
      if (lines.join('\n').length + line.length + (lines.length ? 1 : 0) > 6000) break;
      items.push(item);
      lines.push(line);
    }
    const snapshotText = lines.join('\n');
    return { url: location.href, title: document.title, elementCount: items.length, items, snapshotText };
  }, limit);
}
