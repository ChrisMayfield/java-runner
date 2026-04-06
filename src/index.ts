// Entry point: auto-init <script type="text/x-java"> and <script type="text/x-java-repl"> elements

import { Widget } from './ui/widget';
import { ReplWidget } from './ui/repl';

const widgets: Widget[] = [];
const repls: ReplWidget[] = [];

function initAll(): void {
  const elements = document.querySelectorAll('script[type="text/x-java"]');

  elements.forEach((el) => {
    // Extract the code from the element's text content
    const code = (el as HTMLElement).textContent || '';
    if (!code.trim()) return;

    // Create widget and replace the element
    const widget = new Widget(code);
    el.replaceWith(widget.element);
    widgets.push(widget);
  });

  const replElements = document.querySelectorAll('script[type="text/x-java-repl"]');

  replElements.forEach((el) => {
    const code = (el as HTMLElement).textContent || '';

    // Create REPL widget (may have empty code)
    const repl = new ReplWidget(code);
    el.replaceWith(repl.element);
    repls.push(repl);
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
export { ReplWidget };
export function init(selector?: string): Widget[] {
  const created: Widget[] = [];
  const elements = document.querySelectorAll(selector || 'script[type="text/x-java"]');

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
