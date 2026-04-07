// Console panel: output area + input prompt

export class ConsolePanel {
  readonly element: HTMLElement;
  private outputEl: HTMLElement;
  private inputLine: HTMLFormElement;
  private inputField: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private pendingResolve: ((value: string) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'jr-console';
    this.element.setAttribute('tabindex', '0');
    this.element.setAttribute('aria-label', 'Console output');

    this.outputEl = document.createElement('pre');
    this.outputEl.className = 'jr-console-output';
    this.element.appendChild(this.outputEl);

    this.inputLine = document.createElement('form');
    this.inputLine.className = 'jr-console-input';
    this.inputLine.setAttribute('action', '');
    this.inputLine.style.display = 'none';

    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.className = 'jr-console-input-field';
    this.inputField.name = 'console';
    this.inputField.autocomplete = 'off';
    this.inputField.spellcheck = false;
    this.inputField.setAttribute('autocapitalize', 'off');
    this.inputField.setAttribute('aria-label', 'Console input');
    this.inputField.setAttribute('enterkeyhint', 'send');
    this.inputField.setAttribute('inputmode', 'text');

    this.submitBtn = document.createElement('button');
    this.submitBtn.className = 'jr-console-submit';
    this.submitBtn.type = 'submit';
    this.submitBtn.textContent = 'Enter';

    this.inputLine.appendChild(this.inputField);
    this.inputLine.appendChild(this.submitBtn);
    this.element.appendChild(this.inputLine);

    this.inputLine.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitInput();
    });
  }

  clear(): void {
    this.outputEl.textContent = '';
    this.hideInput();
  }

  print(text: string): void {
    this.outputEl.appendChild(document.createTextNode(text));
  }

  println(text: string): void {
    this.outputEl.appendChild(document.createTextNode(text + '\n'));
  }

  appendError(text: string): void {
    const span = document.createElement('span');
    span.className = 'jr-error';
    span.textContent = text;
    this.outputEl.appendChild(span);
  }

  requestInput(prompt?: string): Promise<string> {
    if (prompt) {
      this.print(prompt);
    }
    this.inputLine.style.display = 'flex';
    this.inputField.value = '';
    this.inputField.focus();
    this.scrollToBottom();
    return new Promise<string>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  private submitInput(): void {
    if (!this.pendingResolve) return;
    const value = this.inputField.value;
    this.printInput(value); // echo input in cyan
    this.hideInput();
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve(value);
  }

  abortInput(): void {
    if (this.pendingResolve) {
      this.hideInput();
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve('');
    }
  }

  private hideInput(): void {
    this.inputLine.style.display = 'none';
  }

  printInput(text: string): void {
    const span = document.createElement('span');
    span.className = 'jr-input-echo';
    span.textContent = text + '\n';
    this.outputEl.appendChild(span);
  }

  private scrollToBottom(): void {
    this.element.scrollTop = this.element.scrollHeight;
  }

  show(): void {
    this.element.style.display = 'block';
  }

  hide(): void {
    this.element.style.display = 'none';
  }
}
