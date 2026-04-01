// Console panel: output area + input prompt

export class ConsolePanel {
  readonly element: HTMLElement;
  private outputEl: HTMLElement;
  private inputLine: HTMLElement;
  private inputField: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private pendingResolve: ((value: string) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'jr-console';

    this.outputEl = document.createElement('pre');
    this.outputEl.className = 'jr-console-output';
    this.element.appendChild(this.outputEl);

    this.inputLine = document.createElement('div');
    this.inputLine.className = 'jr-console-input';
    this.inputLine.style.display = 'none';

    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.className = 'jr-console-input-field';
    this.inputField.autocomplete = 'off';
    this.inputField.spellcheck = false;

    this.submitBtn = document.createElement('button');
    this.submitBtn.className = 'jr-console-submit';
    this.submitBtn.textContent = 'Enter';

    this.inputLine.appendChild(this.inputField);
    this.inputLine.appendChild(this.submitBtn);
    this.element.appendChild(this.inputLine);

    this.submitBtn.addEventListener('click', () => this.submitInput());
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitInput();
      }
    });
  }

  clear(): void {
    this.outputEl.textContent = '';
    this.hideInput();
  }

  print(text: string): void {
    this.outputEl.textContent += text;
    this.scrollToBottom();
  }

  println(text: string): void {
    this.outputEl.textContent += text + '\n';
    this.scrollToBottom();
  }

  appendError(text: string): void {
    const span = document.createElement('span');
    span.className = 'jr-error';
    span.textContent = text;
    this.outputEl.appendChild(span);
    this.scrollToBottom();
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
    this.println(value); // echo input
    this.hideInput();
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve(value);
  }

  abortInput(): void {
    if (this.pendingResolve) {
      this.hideInput();
      this.pendingResolve = null;
    }
  }

  private hideInput(): void {
    this.inputLine.style.display = 'none';
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
