// Editor component: CodeMirror 6 wrapper

import { EditorView, basicSetup } from 'codemirror';
import { java } from '@codemirror/lang-java';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';

export class Editor {
  readonly element: HTMLElement;
  private view: EditorView;

  constructor(initialCode: string) {
    this.element = document.createElement('div');
    this.element.className = 'jr-editor';

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        java(),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { fontSize: '14px' },
          '.cm-content': { fontFamily: '"Fira Code", "Consolas", "Monaco", monospace' },
          '.cm-gutters': { fontFamily: '"Fira Code", "Consolas", "Monaco", monospace' },
        }),
      ],
    });

    this.view = new EditorView({
      state,
      parent: this.element,
    });
  }

  getCode(): string {
    return this.view.state.doc.toString();
  }

  setCode(code: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
    });
  }

  setReadOnly(readOnly: boolean): void {
    // Use DOM attribute to toggle editability
    (this.view.contentDOM as HTMLElement).contentEditable = readOnly ? 'false' : 'true';
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    this.view.destroy();
  }
}
