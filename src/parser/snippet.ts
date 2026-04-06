// Pre-processing for Java code snippets: wraps bare statements in a class + main method

import { parse, ParseError, AUTO_IMPORTS } from './index'
import { CompilationUnit } from './ast'

export interface SnippetResult {
  ast: CompilationUnit
  lineOffset: number
}

// Matches method signatures at the start of a line (not inside a class)
const METHOD_RE = /^\s*(public\s+|private\s+|protected\s+)*(static\s+)?(void|int|long|double|float|char|boolean|byte|short|String|[A-Z]\w*(\s*\[\s*\])*)\s+[a-z]\w*\s*\(/m

type WrapLevel = 'none' | 'class' | 'class+main'

function detectWrapLevel(source: string): WrapLevel {
  if (/\bclass\s+\w+/.test(source)) return 'none'
  if (METHOD_RE.test(source)) return 'class'
  return 'class+main'
}

export function parseSnippet(source: string): SnippetResult {
  const level = detectWrapLevel(source)

  if (level === 'none') {
    return { ast: parse(source), lineOffset: 0 }
  }

  const imports = AUTO_IMPORTS.join('\n')
  let prefix: string
  let suffix: string
  let lineOffset: number

  if (level === 'class') {
    prefix = imports + '\npublic class Main {\n'
    suffix = '\n}'
    lineOffset = AUTO_IMPORTS.length + 1 // import lines + class line
  } else {
    prefix = imports + '\npublic class Main {\npublic static void main(String[] args) throws Exception {\n'
    suffix = '\n}\n}'
    lineOffset = AUTO_IMPORTS.length + 2 // import lines + class line + main line
  }

  const wrapped = prefix + source + suffix

  try {
    const ast = parse(wrapped)
    adjustPositions(ast, lineOffset)
    return { ast, lineOffset: 0 } // positions already adjusted
  } catch (e) {
    if (e instanceof ParseError && e.line > lineOffset) {
      throw new ParseError(e.message, e.line - lineOffset, e.column)
    }
    throw e
  }
}

// Recursively subtract lineOffset from all Position objects in the AST
function adjustPositions(node: any, offset: number): void {
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) adjustPositions(item, offset)
    return
  }
  if (node.pos && typeof node.pos.line === 'number') {
    node.pos.line = Math.max(1, node.pos.line - offset)
  }
  for (const key of Object.keys(node)) {
    if (key === 'pos') continue
    const val = node[key]
    if (val && typeof val === 'object') {
      adjustPositions(val, offset)
    }
  }
}
