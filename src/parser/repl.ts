// Parser for REPL input: tries multiple strategies to parse user input

import { parse, ParseError } from './index'
import { Statement, Expression, ClassDeclaration } from './ast'

const AUTO_IMPORTS = [
  'import java.util.Scanner;',
  'import java.util.Random;',
  'import java.util.ArrayList;',
  'import java.util.HashMap;',
  'import java.util.HashSet;',
  'import java.util.Arrays;',
  'import java.util.Collections;',
  'import java.util.List;',
  'import java.util.Map;',
  'import java.util.Set;',
  'import java.io.File;',
  'import java.io.PrintWriter;',
  'import java.io.FileWriter;',
  'import java.io.BufferedReader;',
  'import java.io.FileReader;',
]

export type ReplParseResult =
  | { kind: 'expression', expression: Expression }
  | { kind: 'statements', statements: Statement[] }
  | { kind: 'classes', classes: ClassDeclaration[] }
  | { kind: 'import' }

const IMPORTS_TEXT = AUTO_IMPORTS.join('\n')
const WRAPPER_OFFSET = AUTO_IMPORTS.length + 2 // imports + class line + method line

export function parseReplInput(input: string): ReplParseResult {
  const trimmed = input.trim()
  if (!trimmed) throw new ParseError('Empty input', 1, 1)

  // Handle import statements (auto-imports cover supported classes)
  if (/^\s*import\s+/.test(trimmed)) {
    return { kind: 'import' }
  }

  // Try as class/interface/enum declaration
  if (/^\s*(public\s+|abstract\s+|final\s+)*(class|interface|enum)\s+\w+/.test(trimmed)) {
    try {
      const ast = parse(IMPORTS_TEXT + '\n' + trimmed)
      return { kind: 'classes', classes: ast.classes }
    } catch {
      // Fall through to try as statement
    }
  }

  // Try as statement(s) inside a method
  let stmtError: unknown = null
  try {
    const wrapped = `${IMPORTS_TEXT}\npublic class __Repl__ {\npublic static void __repl__() throws Exception {\n${trimmed}\n}\n}`
    const ast = parse(wrapped)
    const cls = ast.classes[0]
    const method = cls.members.find(
      m => m.kind === 'MethodDeclaration' && m.name === '__repl__'
    )
    if (method && method.kind === 'MethodDeclaration' && method.body) {
      const stmts = method.body.statements
      for (const stmt of stmts) {
        adjustPositions(stmt, WRAPPER_OFFSET)
      }
      // Single ExpressionStatement → return as expression for value display
      if (stmts.length === 1 && stmts[0].kind === 'ExpressionStatement') {
        return { kind: 'expression', expression: stmts[0].expression }
      }
      return { kind: 'statements', statements: stmts }
    }
    throw new ParseError('Failed to parse REPL input', 1, 1)
  } catch (e) {
    stmtError = e
  }

  // Try as bare expression (e.g., `x + 3` or `Math.PI`)
  try {
    const exprInput = trimmed.replace(/;+\s*$/, '') // strip trailing semicolons
    const wrapped = `${IMPORTS_TEXT}\npublic class __Repl__ {\nstatic Object __repl__() throws Exception {\nreturn (${exprInput});\n}\n}`
    const ast = parse(wrapped)
    const cls = ast.classes[0]
    const method = cls.members.find(
      m => m.kind === 'MethodDeclaration' && m.name === '__repl__'
    )
    if (method && method.kind === 'MethodDeclaration' && method.body) {
      const retStmt = method.body.statements[0]
      if (retStmt.kind === 'ReturnStatement' && retStmt.value) {
        let expr = retStmt.value
        if (expr.kind === 'ParenExpression') {
          expr = expr.expression
        }
        adjustPositions(expr, WRAPPER_OFFSET)
        return { kind: 'expression', expression: expr }
      }
    }
  } catch {
    // Expression parse also failed
  }

  // All strategies failed — throw the original statement error
  if (stmtError instanceof ParseError) throw stmtError
  if (stmtError instanceof Error) throw new ParseError(stmtError.message, 1, 1)
  throw new ParseError('Failed to parse input', 1, 1)
}

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
