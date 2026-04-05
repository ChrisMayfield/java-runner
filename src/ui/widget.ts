// Widget: orchestrates editor + console + run button

import { Editor } from './editor';
import { ConsolePanel } from './console';
import { parseSnippet } from '../parser/snippet';
import { Interpreter, InterpreterIO } from '../interpreter/interpreter';
import { registerSystem } from '../runtime/system';
import { registerScanner } from '../runtime/scanner';
import { registerMath } from '../runtime/math';
import { registerCollections } from '../runtime/collections';
import { registerWrappers } from '../runtime/wrappers';
import { registerArrays } from '../runtime/arrays';
import { registerRandom } from '../runtime/random';
import { registerFileIO } from '../runtime/fileio';
import { JavaException, StepLimitExceeded, ExecutionCancelled, RuntimeError } from '../interpreter/errors';
import { ParseError } from '../parser/index';

export class Widget {
  readonly element: HTMLElement;
  private editor: Editor;
  private console: ConsolePanel;
  private toolbar: HTMLElement;
  private runBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private currentInterpreter: Interpreter | null = null;
  private originalCode: string;

  constructor(code: string) {
    this.originalCode = code.trim();

    this.element = document.createElement('div');
    this.element.className = 'jr-widget';

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'jr-toolbar';

    this.runBtn = document.createElement('button');
    this.runBtn.className = 'jr-btn jr-btn-run';
    this.runBtn.textContent = '▶ Run';

    this.stopBtn = document.createElement('button');
    this.stopBtn.className = 'jr-btn jr-btn-stop';
    this.stopBtn.textContent = '■ Stop';
    this.stopBtn.style.display = 'none';

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'jr-btn jr-btn-reset';
    this.resetBtn.textContent = '↺ Reset';

    this.toolbar.appendChild(this.runBtn);
    this.toolbar.appendChild(this.stopBtn);
    this.toolbar.appendChild(this.resetBtn);

    // Editor
    this.editor = new Editor(this.originalCode);

    // Console
    this.console = new ConsolePanel();
    this.console.hide();

    // Assemble
    this.element.appendChild(this.toolbar);
    this.element.appendChild(this.editor.element);
    this.element.appendChild(this.console.element);

    // Events
    this.runBtn.addEventListener('click', () => this.run());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.resetBtn.addEventListener('click', () => this.reset());
  }

  async run(): Promise<void> {
    const source = this.editor.getCode();

    // UI state: running
    this.runBtn.style.display = 'none';
    this.stopBtn.style.display = '';
    this.console.clear();
    this.console.show();

    // Brief delay so user notices the console cleared/appeared
    await new Promise(r => setTimeout(r, 200));

    try {
      // Parse (wraps bare snippets in class + main automatically)
      const { ast } = parseSnippet(source);

      // Create interpreter with IO wired to console
      const io: InterpreterIO = {
        print: (text) => this.console.print(text),
        println: (text) => this.console.println(text),
        requestInput: (prompt) => this.console.requestInput(prompt),
      };

      const interp = new Interpreter(io);
      this.currentInterpreter = interp;

      // Register all runtime libraries
      registerSystem(interp, io);
      registerScanner(interp, io);
      registerMath(interp);
      registerCollections(interp);
      registerWrappers(interp);
      registerArrays(interp);
      registerRandom(interp);
      registerFileIO(interp);

      // Run
      await interp.run(ast);
    } catch (e: unknown) {
      if (e instanceof ExecutionCancelled) {
        this.console.appendError('\n--- Execution cancelled ---\n');
      } else if (e instanceof StepLimitExceeded) {
        this.console.appendError('\n--- Step limit exceeded (possible infinite loop) ---\n');
      } else if (e instanceof JavaException) {
        this.console.appendError(`\nException: ${e.message}`);
        if (e.line) this.console.appendError(` (line ${e.line})`);
        this.console.appendError('\n');
        if (e.stackTrace.length > 0) {
          for (const frame of e.stackTrace) {
            this.console.appendError(`  at ${frame.className}.${frame.methodName} (line ${frame.line})\n`);
          }
        }
      } else if (e instanceof ParseError) {
        this.console.appendError(`\nCompilation error: ${e.message}`);
        if (e.line) this.console.appendError(` (line ${e.line})`);
        this.console.appendError('\n');
      } else if (e instanceof RuntimeError) {
        this.console.appendError(`\nRuntime error: ${e.message}`);
        if ((e as any).line) this.console.appendError(` (line ${(e as any).line})`);
        this.console.appendError('\n');
      } else if (e instanceof Error) {
        this.console.appendError(`\nError: ${e.message}\n`);
      }
    } finally {
      this.currentInterpreter = null;
      this.runBtn.style.display = '';
      this.stopBtn.style.display = 'none';
    }
  }

  stop(): void {
    if (this.currentInterpreter) {
      this.currentInterpreter.cancelled = true;
      this.console.abortInput();
    }
    this.runBtn.style.display = '';
    this.stopBtn.style.display = 'none';
  }

  reset(): void {
    this.stop();
    this.editor.setCode(this.originalCode);
    this.console.clear();
    this.console.hide();
    this.runBtn.style.display = '';
    this.stopBtn.style.display = 'none';
  }

  destroy(): void {
    this.stop();
    this.editor.destroy();
  }
}
