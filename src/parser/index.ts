// Parser entry point: source code → AST

import { parse as javaParse } from 'java-parser';
import { convertCompilationUnit } from './converter';
import { CompilationUnit } from './ast';

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export function parse(source: string): CompilationUnit {
  const cst = javaParse(source);

  // java-parser doesn't throw on errors; check for lexing/parsing errors
  // It uses the chevrotain error recovery, so CST may be partial
  // We check if the CST is valid by looking at standard structure
  if (!cst || !cst.children) {
    throw new ParseError('Failed to parse source code', 1, 1);
  }

  try {
    return convertCompilationUnit(cst);
  } catch (e: any) {
    throw new ParseError(
      `Parse error: ${e.message}`,
      e.line || 1,
      e.column || 1
    );
  }
}

export { CompilationUnit } from './ast';
