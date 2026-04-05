// Widget: orchestrates editor tabs + console + run button

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

interface SourceFile {
  name: string
  code: string
}

/** Split code into separate files by top-level class declarations. */
function parseFiles(code: string): SourceFile[] {
  const trimmed = code.trim()
  // Match top-level class/interface/enum declarations (not indented)
  const classRe = /^(?:(?:public|abstract|final)\s+)*(?:class|interface|enum)\s+(\w+)/gm
  const matches: { name: string, index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = classRe.exec(trimmed)) !== null) {
    // Only consider matches at column 0 (top-level)
    const lineStart = trimmed.lastIndexOf('\n', m.index) + 1
    if (m.index === lineStart) {
      matches.push({ name: m[1], index: m.index })
    }
  }

  if (matches.length <= 1) {
    const name = matches.length === 1 ? matches[0].name + '.java' : 'Main.java'
    return [{ name, code: trimmed }]
  }

  const files: SourceFile[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : trimmed.length
    // Include any imports/comments before the first class in the first file
    const fileCode = (i === 0 ? trimmed.substring(0, end) : trimmed.substring(start, end)).trim()
    files.push({ name: matches[i].name + '.java', code: fileCode })
  }
  return files
}

export class Widget {
  readonly element: HTMLElement;
  private files: SourceFile[];
  private originalFiles: SourceFile[];
  private editors: Map<string, Editor> = new Map();
  private activeFile: string;
  private isSnippet: boolean;
  private tabBar: HTMLElement;
  private editorContainer: HTMLElement;
  private toolbar: HTMLElement;
  private console: ConsolePanel;
  private runBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private currentInterpreter: Interpreter | null = null;
  private dragSrcName: string | null = null;
  private resizeObserver: ResizeObserver;
  private syncing = false;

  constructor(code: string) {
    const trimmed = code.trim();
    this.files = parseFiles(trimmed);
    this.originalFiles = this.files.map(f => ({ ...f }));
    this.isSnippet = this.files.length === 1 && !/\bclass\s+\w+/.test(trimmed);
    this.activeFile = this.files[0].name;

    this.element = document.createElement('div');
    this.element.className = 'jr-widget';

    // Tab bar (hidden in snippet mode)
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'jr-tab-bar';
    if (this.isSnippet) this.tabBar.style.display = 'none';
    this.buildTabBar();

    // Editor container
    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'jr-editor-container';
    for (const file of this.files) {
      const editor = new Editor(file.code);
      this.editors.set(file.name, editor);
      this.editorContainer.appendChild(editor.element);
      if (file.name !== this.activeFile) editor.element.style.display = 'none';
    }

    // Toolbar (between editor and console)
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

    // Console
    this.console = new ConsolePanel();
    this.console.hide();

    // Assemble: tabs → editor → toolbar → console
    this.element.appendChild(this.tabBar);
    this.element.appendChild(this.editorContainer);
    this.element.appendChild(this.toolbar);
    this.element.appendChild(this.console.element);

    // Events
    this.runBtn.addEventListener('click', () => this.run());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.resetBtn.addEventListener('click', () => this.reset());

    // Observe editor resizes to keep heights in sync
    this.resizeObserver = new ResizeObserver(() => this.syncEditorHeights());
    for (const [, editor] of this.editors) {
      this.resizeObserver.observe(editor.contentElement);
    }
  }

  private syncEditorHeights(): void {
    if (this.syncing) return;
    this.syncing = true;

    // Reset all minHeight so we measure natural heights
    for (const [, editor] of this.editors) {
      editor.element.style.minHeight = '';
    }

    if (this.editors.size <= 1) {
      this.syncing = false;
      return;
    }

    // Briefly show all editors to measure, then restore
    const hidden: HTMLElement[] = [];
    for (const [name, editor] of this.editors) {
      if (name !== this.activeFile) {
        editor.element.style.display = '';
        editor.element.style.position = 'absolute';
        editor.element.style.visibility = 'hidden';
        hidden.push(editor.element);
      }
    }
    let maxH = 0;
    for (const [, editor] of this.editors) {
      maxH = Math.max(maxH, editor.element.offsetHeight);
    }
    for (const el of hidden) {
      el.style.display = 'none';
      el.style.position = '';
      el.style.visibility = '';
    }
    const minH = maxH > 0 ? maxH + 'px' : '';
    for (const [, editor] of this.editors) {
      editor.element.style.minHeight = minH;
    }

    this.syncing = false;
  }

  private buildTabBar(): void {
    this.tabBar.innerHTML = '';
    for (const file of this.files) {
      const tab = document.createElement('div');
      tab.className = 'jr-tab' + (file.name === this.activeFile ? ' jr-tab-active' : '');
      tab.draggable = true;
      tab.dataset.fileName = file.name;

      const label = document.createElement('span');
      label.className = 'jr-tab-label';
      label.textContent = file.name;
      tab.appendChild(label);

      const closeBtn = document.createElement('span');
      closeBtn.className = 'jr-tab-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeFile(file.name);
      });
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => this.switchTab(file.name));

      // Drag-and-drop for reordering
      tab.addEventListener('dragstart', (e) => {
        this.dragSrcName = file.name;
        tab.classList.add('jr-tab-dragging');
        e.dataTransfer!.effectAllowed = 'move';
      });
      tab.addEventListener('dragend', () => {
        this.dragSrcName = null;
        tab.classList.remove('jr-tab-dragging');
        // Clean up any drop indicators
        this.tabBar.querySelectorAll('.jr-tab-dragover').forEach(el => el.classList.remove('jr-tab-dragover'));
      });
      tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        tab.classList.add('jr-tab-dragover');
      });
      tab.addEventListener('dragleave', () => {
        tab.classList.remove('jr-tab-dragover');
      });
      tab.addEventListener('drop', (e) => {
        e.preventDefault();
        tab.classList.remove('jr-tab-dragover');
        if (!this.dragSrcName || this.dragSrcName === file.name) return;
        const srcIdx = this.files.findIndex(f => f.name === this.dragSrcName);
        const dstIdx = this.files.findIndex(f => f.name === file.name);
        if (srcIdx === -1 || dstIdx === -1) return;
        const [moved] = this.files.splice(srcIdx, 1);
        this.files.splice(dstIdx, 0, moved);
        this.buildTabBar();
      });

      this.tabBar.appendChild(tab);
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'jr-tab jr-tab-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.addFile());
    this.tabBar.appendChild(addBtn);
  }

  private switchTab(name: string): void {
    if (name === this.activeFile) return;
    const oldEditor = this.editors.get(this.activeFile);
    if (oldEditor) oldEditor.element.style.display = 'none';
    this.activeFile = name;
    const newEditor = this.editors.get(name);
    if (newEditor) newEditor.element.style.display = '';
    this.buildTabBar();
  }

  private addFile(): void {
    const input = prompt('Enter class name:');
    if (!input) return;
    const className = input.trim().replace(/\.java$/, '');
    if (!className) return;
    const fileName = className + '.java';
    if (this.files.some(f => f.name === fileName)) return;
    const code = `public class ${className} {\n\n}`;
    this.files.push({ name: fileName, code });
    const editor = new Editor(code);
    this.editors.set(fileName, editor);
    editor.element.style.display = 'none';
    this.editorContainer.appendChild(editor.element);
    this.resizeObserver.observe(editor.contentElement);
    this.switchTab(fileName);
  }

  private closeFile(name: string): void {
    const idx = this.files.findIndex(f => f.name === name);
    if (idx === -1) return;
    this.files.splice(idx, 1);
    const editor = this.editors.get(name);
    if (editor) {
      this.resizeObserver.unobserve(editor.contentElement);
      editor.destroy();
      editor.element.remove();
      this.editors.delete(name);
    }
    if (this.files.length === 0) {
      // All files closed — create a new Main class
      const code = `public class Main {\n\n}`;
      const file: SourceFile = { name: 'Main.java', code };
      this.files.push(file);
      const newEditor = new Editor(code);
      this.editors.set(file.name, newEditor);
      this.editorContainer.appendChild(newEditor.element);
      this.resizeObserver.observe(newEditor.contentElement);
      this.activeFile = file.name;
    } else if (this.activeFile === name) {
      this.activeFile = this.files[Math.min(idx, this.files.length - 1)].name;
      const newEditor = this.editors.get(this.activeFile);
      if (newEditor) newEditor.element.style.display = '';
    }
    this.buildTabBar();
  }

  async run(): Promise<void> {
    // Sync editor contents back to file objects
    for (const file of this.files) {
      const editor = this.editors.get(file.name);
      if (editor) file.code = editor.getCode();
    }

    const source = this.files.map(f => f.code).join('\n\n');

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
    // Destroy all current editors
    for (const [, editor] of this.editors) {
      this.resizeObserver.unobserve(editor.contentElement);
      editor.destroy();
      editor.element.remove();
    }
    this.editors.clear();
    // Restore original files
    this.files = this.originalFiles.map(f => ({ ...f }));
    this.activeFile = this.files[0].name;
    // Recreate editors
    for (const file of this.files) {
      const editor = new Editor(file.code);
      this.editors.set(file.name, editor);
      this.editorContainer.appendChild(editor.element);
      this.resizeObserver.observe(editor.contentElement);
      if (file.name !== this.activeFile) editor.element.style.display = 'none';
    }
    this.buildTabBar();
    this.console.clear();
    this.console.hide();
    this.runBtn.style.display = '';
    this.stopBtn.style.display = 'none';
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    for (const [, editor] of this.editors) {
      editor.destroy();
    }
  }
}
