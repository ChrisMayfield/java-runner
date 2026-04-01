// Entry point: auto-init <div class="java"> elements into widgets

import { Widget } from './ui/widget';

const widgets: Widget[] = [];

function initAll(): void {
  const elements = document.querySelectorAll('div.java, pre.java, code.java');

  elements.forEach((el) => {
    // Extract the code from the element's text content
    const code = (el as HTMLElement).textContent || '';
    if (!code.trim()) return;

    // Create widget and replace the element
    const widget = new Widget(code);
    el.replaceWith(widget.element);
    widgets.push(widget);
  });
}

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}

// Expose API globally for manual use
export { Widget };
export function init(selector?: string): Widget[] {
  const created: Widget[] = [];
  const elements = document.querySelectorAll(selector || 'div.java, pre.java, code.java');

  elements.forEach((el) => {
    const code = (el as HTMLElement).textContent || '';
    if (!code.trim()) return;

    const widget = new Widget(code);
    el.replaceWith(widget.element);
    created.push(widget);
    widgets.push(widget);
  });

  return created;
}
