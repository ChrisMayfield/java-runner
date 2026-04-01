// System.out.print / println / printf runtime
// Also System.err (maps to same console)

import { Interpreter, InterpreterIO } from '../interpreter/interpreter';
import {
  JavaValue, JavaObject, makeString, makeObject, toJavaString, toNumber,
  isNull, VOID, makeInt, makeDouble
} from '../interpreter/types';
import { RuntimeError } from '../interpreter/errors';

export function registerSystem(interp: Interpreter, io: InterpreterIO): void {
  const registry = interp.getRegistry();

  // System class
  registry.register({
    name: 'System',
    superClass: null,
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'final'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // PrintStream class (for System.out)
  registry.register({
    name: 'PrintStream',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // InputStream class (for System.in)
  registry.register({
    name: 'InputStream',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // System.exit
  registry.registerStaticMethod('System', 'exit', async (_obj, args, _line) => {
    throw new RuntimeError(`Program exited with code ${toNumber(args[0])}`);
  });

  // System.currentTimeMillis
  registry.registerStaticMethod('System', 'currentTimeMillis', async () => {
    return { type: 'long', value: Date.now() };
  });

  // PrintStream methods
  registry.registerMethod('PrintStream', 'print', async (_obj, args, _line) => {
    io.print(await interp.valueToString(args[0]));
    return VOID;
  });

  registry.registerMethod('PrintStream', 'println', async (_obj, args, _line) => {
    if (args.length === 0) {
      io.println('');
    } else {
      io.println(await interp.valueToString(args[0]));
    }
    return VOID;
  });

  registry.registerMethod('PrintStream', 'printf', async (_obj, args, line) => {
    if (args.length === 0) throw new RuntimeError('printf requires at least a format string', line);
    const format = args[0].value as string;
    const fmtArgs = args.slice(1);
    const result = formatString(format, fmtArgs);
    io.print(result);
    return VOID;
  });

  registry.registerMethod('PrintStream', 'format', async (_obj, args, line) => {
    if (args.length === 0) throw new RuntimeError('format requires at least a format string', line);
    const format = args[0].value as string;
    const fmtArgs = args.slice(1);
    const result = formatString(format, fmtArgs);
    io.print(result);
    return VOID;
  });

  // String.format (static)
  registry.registerStaticMethod('String', 'format', async (_obj, args, line) => {
    if (args.length === 0) throw new RuntimeError('String.format requires at least a format string', line);
    const format = args[0].value as string;
    const fmtArgs = args.slice(1);
    return makeString(formatString(format, fmtArgs));
  });

  // String.valueOf (static)
  registry.registerStaticMethod('String', 'valueOf', async (_obj, args, _line) => {
    if (args.length === 0) return makeString('null');
    return makeString(toJavaString(args[0]));
  });

  // String.join (static)
  registry.registerStaticMethod('String', 'join', async (_obj, args, _line) => {
    const delim = toJavaString(args[0]);
    const parts = args.slice(1).map(a => toJavaString(a));
    return makeString(parts.join(delim));
  });
}

// ============================================================
// Printf-style format string parser
// Supports: %d, %f, %s, %c, %b, %n, %%, %e, %g, %h, %o, %x
// With flags: -, +, 0, ' ', (, #
// With width and precision: %10.2f, %-20s, %05d
// ============================================================

function formatString(format: string, args: JavaValue[]): string {
  let result = '';
  let argIdx = 0;

  for (let i = 0; i < format.length; i++) {
    if (format[i] !== '%') {
      result += format[i];
      continue;
    }

    i++; // skip %
    if (i >= format.length) break;

    // %% → literal %
    if (format[i] === '%') {
      result += '%';
      continue;
    }

    // %n → newline
    if (format[i] === 'n') {
      result += '\n';
      continue;
    }

    // Parse format specifier: [flags][width][.precision]conversion
    let flags = '';
    let width = '';
    let precision = '';
    let conversion = '';

    // Flags: -, +, 0, ' ', (, #
    while (i < format.length && '-+0 (#,'.includes(format[i])) {
      flags += format[i];
      i++;
    }

    // Width
    while (i < format.length && format[i] >= '0' && format[i] <= '9') {
      width += format[i];
      i++;
    }

    // Precision
    if (i < format.length && format[i] === '.') {
      i++;
      while (i < format.length && format[i] >= '0' && format[i] <= '9') {
        precision += format[i];
        i++;
      }
    }

    if (i < format.length) {
      conversion = format[i];
    }

    const arg = argIdx < args.length ? args[argIdx] : null;
    argIdx++;

    result += formatValue(arg, conversion, flags, width ? parseInt(width) : 0, precision ? parseInt(precision) : -1);
  }

  return result;
}

function formatValue(
  arg: JavaValue | null,
  conversion: string,
  flags: string,
  width: number,
  precision: number
): string {
  let text = '';

  switch (conversion) {
    case 'd': {
      const n = arg ? Math.trunc(toNumber(arg)) : 0;
      text = String(Math.abs(n));
      if (flags.includes(',')) {
        text = addGroupingSeparators(text);
      }
      if (n < 0) text = '-' + text;
      else if (flags.includes('+')) text = '+' + text;
      else if (flags.includes(' ')) text = ' ' + text;
      break;
    }
    case 'f': {
      const n = arg ? toNumber(arg) : 0.0;
      const p = precision >= 0 ? precision : 6;
      text = Math.abs(n).toFixed(p);
      if (flags.includes(',')) {
        const [intPart, decPart] = text.split('.');
        text = addGroupingSeparators(intPart) + (decPart !== undefined ? '.' + decPart : '');
      }
      if (n < 0) text = '-' + text;
      else if (flags.includes('+')) text = '+' + text;
      else if (flags.includes(' ')) text = ' ' + text;
      break;
    }
    case 'e': case 'E': {
      const n = arg ? toNumber(arg) : 0.0;
      const p = precision >= 0 ? precision : 6;
      text = n.toExponential(p);
      if (conversion === 'E') text = text.toUpperCase();
      break;
    }
    case 'g': case 'G': {
      const n = arg ? toNumber(arg) : 0.0;
      const p = precision >= 0 ? precision : 6;
      text = n.toPrecision(p);
      // Remove trailing zeros after decimal point
      if (text.includes('.')) {
        text = text.replace(/0+$/, '').replace(/\.$/, '');
      }
      if (conversion === 'G') text = text.toUpperCase();
      break;
    }
    case 's': case 'S': {
      text = arg ? toJavaString(arg) : 'null';
      if (precision >= 0) text = text.substring(0, precision);
      if (conversion === 'S') text = text.toUpperCase();
      break;
    }
    case 'c': case 'C': {
      if (arg) {
        if (arg.type === 'char') text = arg.value as string;
        else text = String.fromCharCode(toNumber(arg));
      }
      if (conversion === 'C') text = text.toUpperCase();
      break;
    }
    case 'b': case 'B': {
      text = arg ? String(arg.type === 'boolean' ? arg.value : !isNull(arg)) : 'false';
      if (conversion === 'B') text = text.toUpperCase();
      break;
    }
    case 'h': case 'H': {
      if (arg && !isNull(arg)) {
        text = (arg.value && typeof arg.value === 'object' && 'id' in arg.value)
          ? (arg.value as any).id.toString(16)
          : '0';
      } else {
        text = 'null';
      }
      if (conversion === 'H') text = text.toUpperCase();
      break;
    }
    case 'o': {
      const n = arg ? toNumber(arg) : 0;
      text = (n >>> 0).toString(8);
      if (flags.includes('#')) text = '0' + text;
      break;
    }
    case 'x': case 'X': {
      const n = arg ? toNumber(arg) : 0;
      text = (n >>> 0).toString(16);
      if (flags.includes('#')) text = '0x' + text;
      if (conversion === 'X') text = text.toUpperCase();
      break;
    }
    default:
      text = arg ? toJavaString(arg) : '';
  }

  // Apply width padding
  if (width > 0 && text.length < width) {
    const padChar = flags.includes('0') && !flags.includes('-') ? '0' : ' ';
    if (flags.includes('-')) {
      text = text.padEnd(width, ' ');
    } else {
      // For zero-padding, pad after sign
      if (padChar === '0' && (text.startsWith('-') || text.startsWith('+') || text.startsWith(' '))) {
        const sign = text[0];
        text = sign + text.substring(1).padStart(width - 1, '0');
      } else {
        text = text.padStart(width, padChar);
      }
    }
  }

  return text;
}

function addGroupingSeparators(intStr: string): string {
  const parts: string[] = [];
  for (let i = intStr.length; i > 0; i -= 3) {
    parts.unshift(intStr.substring(Math.max(0, i - 3), i));
  }
  return parts.join(',');
}
