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

// Auto-imports for supported library classes that require explicit imports in Java
export const AUTO_IMPORTS = [
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
  'import static org.junit.jupiter.api.Assertions.*;',
  'import org.junit.jupiter.api.Test;',
]
