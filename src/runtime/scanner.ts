// Scanner runtime: interactive input with token buffering

import { Interpreter, InterpreterIO } from '../interpreter/interpreter';
import {
  JavaValue, JavaObject, makeString, makeInt, makeDouble, makeBool,
  makeFloat, makeLong, makeObject, makeChar, VOID, toJavaString
} from '../interpreter/types';
import { inputMismatchException, RuntimeError } from '../interpreter/errors';

interface ScannerState {
  io: InterpreterIO;
  buffer: string;     // Current unconsumed buffer
  tokenBuffer: string[]; // Whitespace-delimited tokens
  hasFullLine: boolean;
  closed: boolean;
  // For string-based scanners
  sourceString?: string;
  sourceOffset?: number;
}

export function registerScanner(interp: Interpreter, io: InterpreterIO): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'Scanner',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // Constructor: new Scanner(System.in) or new Scanner(String)
  registry.registerConstructor('Scanner', async (_obj, args, _line) => {
    let state: ScannerState;

    if (args.length > 0 && args[0].type === 'String') {
      // Scanner reading from a string
      state = {
        io,
        buffer: '',
        tokenBuffer: [],
        hasFullLine: true,
        closed: false,
        sourceString: args[0].value as string,
        sourceOffset: 0,
      };
      // Pre-tokenize the string
      const tokens = (args[0].value as string).trim().split(/\s+/).filter((t: string) => t.length > 0);
      state.tokenBuffer.push(...tokens);
    } else {
      // Scanner reading from System.in (interactive)
      state = {
        io,
        buffer: '',
        tokenBuffer: [],
        hasFullLine: false,
        closed: false,
      };
    }

    const obj = makeObject('Scanner', new Map(), state);
    return obj;
  });

  // nextLine()
  registry.registerMethod('Scanner', 'nextLine', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const result = await readLine(state);
    return makeString(result);
  });

  // next()
  registry.registerMethod('Scanner', 'next', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    return makeString(token);
  });

  // nextInt()
  registry.registerMethod('Scanner', 'nextInt', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    const n = parseInt(token, 10);
    if (isNaN(n)) throw inputMismatchException(line);
    return makeInt(n);
  });

  // nextDouble()
  registry.registerMethod('Scanner', 'nextDouble', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    const n = parseFloat(token);
    if (isNaN(n)) throw inputMismatchException(line);
    return makeDouble(n);
  });

  // nextFloat()
  registry.registerMethod('Scanner', 'nextFloat', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    const n = parseFloat(token);
    if (isNaN(n)) throw inputMismatchException(line);
    return makeFloat(n);
  });

  // nextLong()
  registry.registerMethod('Scanner', 'nextLong', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    const n = parseInt(token, 10);
    if (isNaN(n)) throw inputMismatchException(line);
    return makeLong(n);
  });

  // nextBoolean()
  registry.registerMethod('Scanner', 'nextBoolean', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    const token = await readToken(state);
    if (token.toLowerCase() === 'true') return makeBool(true);
    if (token.toLowerCase() === 'false') return makeBool(false);
    throw inputMismatchException(line);
  });

  // hasNext()
  registry.registerMethod('Scanner', 'hasNext', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    return makeBool(state.tokenBuffer.length > 0 || state.buffer.trim().length > 0 || !state.closed);
  });

  // hasNextLine()
  registry.registerMethod('Scanner', 'hasNextLine', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    return makeBool(state.buffer.length > 0 || !state.closed);
  });

  // hasNextInt()
  registry.registerMethod('Scanner', 'hasNextInt', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    if (state.tokenBuffer.length === 0) {
      if (state.sourceString !== undefined) return makeBool(false);
      if (state.buffer.trim().length === 0) return makeBool(false);
    }
    const token = state.tokenBuffer.length > 0 ? state.tokenBuffer[0] : state.buffer.trim().split(/\s+/)[0];
    return makeBool(!isNaN(parseInt(token, 10)));
  });

  // hasNextDouble()
  registry.registerMethod('Scanner', 'hasNextDouble', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    if (state.tokenBuffer.length === 0) {
      if (state.sourceString !== undefined) return makeBool(false);
      if (state.buffer.trim().length === 0) return makeBool(false);
    }
    const token = state.tokenBuffer.length > 0 ? state.tokenBuffer[0] : state.buffer.trim().split(/\s+/)[0];
    return makeBool(!isNaN(parseFloat(token)));
  });

  // close()
  registry.registerMethod('Scanner', 'close', async (obj, _args, line) => {
    const state = getScannerState(obj!, line);
    state.closed = true;
    return VOID;
  });
}

function getScannerState(obj: JavaValue, line: number): ScannerState {
  if (obj.value && typeof obj.value === 'object' && 'nativeObj' in obj.value) {
    const jObj = obj.value as JavaObject;
    if (jObj.nativeObj) return jObj.nativeObj as ScannerState;
  }
  throw new RuntimeError('Invalid Scanner object', line);
}

function refillTokenBuffer(state: ScannerState): void {
  if (state.buffer.length > 0) {
    const tokens = state.buffer.trim().split(/\s+/).filter(t => t.length > 0);
    state.tokenBuffer.push(...tokens);
  }
}

async function ensureInput(state: ScannerState): Promise<void> {
  if (state.sourceString !== undefined) {
    // String-based scanner doesn't need interactive input
    return;
  }

  while (state.tokenBuffer.length === 0 && state.buffer.length === 0) {
    const input = await state.io.requestInput();
    state.buffer = input;
    state.hasFullLine = true;
    refillTokenBuffer(state);
    state.buffer = ''; // tokens extracted
  }
}

async function readToken(state: ScannerState): Promise<string> {
  // If we have buffered tokens, return the next one
  if (state.tokenBuffer.length > 0) {
    return state.tokenBuffer.shift()!;
  }

  // If this is a string scanner and buffer is empty
  if (state.sourceString !== undefined) {
    // Parse next token from remaining string
    const remaining = state.sourceString.substring(state.sourceOffset || 0);
    const trimmed = remaining.trimStart();
    if (trimmed.length === 0) {
      throw new RuntimeError('No more tokens');
    }
    const match = trimmed.match(/^(\S+)/);
    if (match) {
      const token = match[1];
      state.sourceOffset = state.sourceString.length - trimmed.length + token.length;
      // Skip any whitespace after the token for subsequent reads
      return token;
    }
    throw new RuntimeError('No more tokens');
  }

  // Need interactive input
  await ensureInput(state);
  if (state.tokenBuffer.length > 0) {
    return state.tokenBuffer.shift()!;
  }
  throw new RuntimeError('No input available');
}

async function readLine(state: ScannerState): Promise<string> {
  // If there are leftover tokens from a previously read line, consume them as the "rest of line"
  if (state.tokenBuffer.length > 0) {
    const rest = state.tokenBuffer.join(' ');
    state.tokenBuffer = [];
    state.buffer = '';
    state.hasFullLine = false;
    return rest;
  }

  // If buffer has content (leftover from previous line), return it
  if (state.buffer.length > 0) {
    const line = state.buffer;
    state.buffer = '';
    state.hasFullLine = false;
    return line;
  }

  // String-based scanner
  if (state.sourceString !== undefined) {
    const remaining = state.sourceString.substring(state.sourceOffset || 0);
    const nlIdx = remaining.indexOf('\n');
    if (nlIdx >= 0) {
      state.sourceOffset = (state.sourceOffset || 0) + nlIdx + 1;
      return remaining.substring(0, nlIdx);
    }
    state.sourceOffset = state.sourceString.length;
    return remaining;
  }

  // Need interactive input — if we're here after nextInt()/nextDouble(),
  // this simulates Java's behavior of consuming the leftover newline
  if (!state.hasFullLine) {
    // This handles the classic CS1 gotcha: nextInt() leaves \n in buffer,
    // nextLine() should consume that empty line
    state.hasFullLine = false;
    // Return empty string (the leftover newline was consumed)
    // but only if we just did a token read. In our case, if buffer is empty
    // and no tokens, the newline was already consumed, so ask for new input.
  }

  const input = await state.io.requestInput();
  return input;
}
