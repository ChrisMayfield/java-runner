// Editor component: CodeMirror 6 wrapper

import { EditorView, basicSetup } from 'codemirror';
import { java } from '@codemirror/lang-java';
import { EditorState, Range } from '@codemirror/state';
import { Decoration, DecorationSet, keymap, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit, syntaxTree } from "@codemirror/language";

const annotationMark = Decoration.mark({ class: 'jr-annotation' });

/** Highlight @Annotation nodes (MarkerAnnotation / Annotation) from the syntax tree. */
const annotationHighlight = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view);
  }
  build(view: EditorView): DecorationSet {
    const ranges: Range<Decoration>[] = [];
    syntaxTree(view.state).iterate({
      enter(node) {
        if (node.name === 'MarkerAnnotation' || node.name === 'Annotation') {
          ranges.push(annotationMark.range(node.from, node.to));
        }
      }
    });
    return Decoration.set(ranges, true);
  }
}, { decorations: v => v.decorations });

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
        keymap.of([indentWithTab]),
        indentUnit.of("    "),
        EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
        annotationHighlight,
        EditorView.theme({
          '&': { fontSize: '14px' },
          '.cm-content': { fontFamily: '"Fira Code", "Consolas", "Monaco", monospace' },
          '.cm-gutters': { fontFamily: '"Fira Code", "Consolas", "Monaco", monospace' },
          '.ͼi': { color: '#007744' },
          '.jr-annotation': { color: '#7c3aed' },
        }),
      ],
    });

    this.view = new EditorView({
      state,
      parent: this.element,
    });

    // Ensure scrollable region is keyboard-accessible (WCAG 2.4.7)
    this.view.scrollDOM.setAttribute('tabindex', '0');
    this.view.scrollDOM.setAttribute('aria-label', 'Code editor scrollable region');
  }

  /** The inner CodeMirror element (resizes with content, unaffected by wrapper minHeight). */
  get contentElement(): HTMLElement {
    return this.view.dom;
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
