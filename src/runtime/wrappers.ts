// Wrapper classes: Integer, Double, Character, Boolean, Long, Float, Short, Byte

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, makeInt, makeDouble, makeString, makeBool, makeChar,
  makeObject, toNumber, toJavaString, NULL_VAL, VOID
} from '../interpreter/types';
import { numberFormatException, RuntimeError } from '../interpreter/errors';

export function registerWrappers(interp: Interpreter): void {
  registerInteger(interp);
  registerDouble(interp);
  registerCharacter(interp);
  registerBoolean_(interp);
  registerLong(interp);
  registerFloat(interp);
  registerShort(interp);
  registerByte(interp);
  registerObject(interp);
}

function registerInteger(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Integer',
    superClass: 'Object',
    interfaces: ['Comparable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerStaticMethod('Integer', 'parseInt', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const radix = args.length > 1 ? toNumber(args[1]) : 10;
    const n = parseInt(s, radix);
    if (isNaN(n)) throw numberFormatException(line, s);
    return makeInt(n);
  });

  reg.registerStaticMethod('Integer', 'valueOf', async (_o, args, line) => {
    if (args[0].type === 'String') {
      const n = parseInt(String(args[0].value).trim(), 10);
      if (isNaN(n)) throw numberFormatException(line, String(args[0].value));
      return makeInt(n);
    }
    return makeInt(toNumber(args[0]));
  });

  reg.registerStaticMethod('Integer', 'toString', async (_o, args, _line) => {
    if (args.length > 1) {
      return makeString(toNumber(args[0]).toString(toNumber(args[1])));
    }
    return makeString(String(toNumber(args[0]) | 0));
  });

  reg.registerStaticMethod('Integer', 'toBinaryString', async (_o, args, _line) =>
    makeString(((toNumber(args[0]) | 0) >>> 0).toString(2)));
  reg.registerStaticMethod('Integer', 'toHexString', async (_o, args, _line) =>
    makeString(((toNumber(args[0]) | 0) >>> 0).toString(16)));
  reg.registerStaticMethod('Integer', 'toOctalString', async (_o, args, _line) =>
    makeString(((toNumber(args[0]) | 0) >>> 0).toString(8)));

  reg.registerStaticMethod('Integer', 'max', async (_o, args, _line) =>
    makeInt(Math.max(toNumber(args[0]), toNumber(args[1]))));
  reg.registerStaticMethod('Integer', 'min', async (_o, args, _line) =>
    makeInt(Math.min(toNumber(args[0]), toNumber(args[1]))));
  reg.registerStaticMethod('Integer', 'compare', async (_o, args, _line) => {
    const a = toNumber(args[0]) | 0, b = toNumber(args[1]) | 0;
    return makeInt(a < b ? -1 : a > b ? 1 : 0);
  });

  // Instance methods on boxed Integer
  reg.registerMethod('Integer', 'intValue', async (obj, _a, _l) => makeInt(toNumber(obj!)));
  reg.registerMethod('Integer', 'doubleValue', async (obj, _a, _l) => makeDouble(toNumber(obj!)));
  reg.registerMethod('Integer', 'toString', async (obj, _a, _l) => makeString(String(toNumber(obj!) | 0)));
  reg.registerMethod('Integer', 'equals', async (obj, args, _l) => makeBool(toNumber(obj!) === toNumber(args[0])));
  reg.registerMethod('Integer', 'compareTo', async (obj, args, _l) => {
    const a = toNumber(obj!), b = toNumber(args[0]);
    return makeInt(a < b ? -1 : a > b ? 1 : 0);
  });

  // Constants
  const env = interp.getGlobalEnv();
  env.define('Integer.MAX_VALUE', makeInt(2147483647));
  env.define('Integer.MIN_VALUE', makeInt(-2147483648));
}

function registerDouble(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Double',
    superClass: 'Object',
    interfaces: ['Comparable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerStaticMethod('Double', 'parseDouble', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const n = parseFloat(s);
    if (isNaN(n) && s !== 'NaN') throw numberFormatException(line, s);
    return makeDouble(n);
  });

  reg.registerStaticMethod('Double', 'valueOf', async (_o, args, line) => {
    if (args[0].type === 'String') {
      const n = parseFloat(String(args[0].value).trim());
      if (isNaN(n)) throw numberFormatException(line, String(args[0].value));
      return makeDouble(n);
    }
    return makeDouble(toNumber(args[0]));
  });

  reg.registerStaticMethod('Double', 'toString', async (_o, args, _l) => makeString(String(toNumber(args[0]))));
  reg.registerStaticMethod('Double', 'isNaN', async (_o, args, _l) => makeBool(isNaN(toNumber(args[0]))));
  reg.registerStaticMethod('Double', 'isInfinite', async (_o, args, _l) => makeBool(!isFinite(toNumber(args[0]))));
  reg.registerStaticMethod('Double', 'compare', async (_o, args, _l) => {
    const a = toNumber(args[0]), b = toNumber(args[1]);
    return makeInt(a < b ? -1 : a > b ? 1 : 0);
  });
  reg.registerStaticMethod('Double', 'max', async (_o, args, _l) => makeDouble(Math.max(toNumber(args[0]), toNumber(args[1]))));
  reg.registerStaticMethod('Double', 'min', async (_o, args, _l) => makeDouble(Math.min(toNumber(args[0]), toNumber(args[1]))));

  reg.registerMethod('Double', 'doubleValue', async (obj, _a, _l) => makeDouble(toNumber(obj!)));
  reg.registerMethod('Double', 'intValue', async (obj, _a, _l) => makeInt(toNumber(obj!)));
  reg.registerMethod('Double', 'toString', async (obj, _a, _l) => makeString(String(toNumber(obj!))));
  reg.registerMethod('Double', 'equals', async (obj, args, _l) => makeBool(toNumber(obj!) === toNumber(args[0])));

  const env = interp.getGlobalEnv();
  env.define('Double.MAX_VALUE', makeDouble(Number.MAX_VALUE));
  env.define('Double.MIN_VALUE', makeDouble(Number.MIN_VALUE));
  env.define('Double.POSITIVE_INFINITY', makeDouble(Infinity));
  env.define('Double.NEGATIVE_INFINITY', makeDouble(-Infinity));
  env.define('Double.NaN', makeDouble(NaN));
}

function registerCharacter(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Character',
    superClass: 'Object',
    interfaces: ['Comparable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerStaticMethod('Character', 'isLetter', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[a-zA-Z]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'isDigit', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[0-9]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'isLetterOrDigit', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[a-zA-Z0-9]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'isUpperCase', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[A-Z]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'isLowerCase', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[a-z]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'isWhitespace', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^\s$/.test(c));
  });
  reg.registerStaticMethod('Character', 'toUpperCase', async (_o, args, _l) =>
    makeChar(String(args[0].value).toUpperCase()));
  reg.registerStaticMethod('Character', 'toLowerCase', async (_o, args, _l) =>
    makeChar(String(args[0].value).toLowerCase()));
  reg.registerStaticMethod('Character', 'isAlphabetic', async (_o, args, _l) => {
    const c = String(args[0].value);
    return makeBool(/^[a-zA-Z]$/.test(c));
  });
  reg.registerStaticMethod('Character', 'getNumericValue', async (_o, args, _l) => {
    const c = String(args[0].value);
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return makeInt(code - 48);
    if (code >= 65 && code <= 90) return makeInt(code - 55);
    if (code >= 97 && code <= 122) return makeInt(code - 87);
    return makeInt(-1);
  });
}

function registerBoolean_(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Boolean',
    superClass: 'Object',
    interfaces: ['Comparable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerStaticMethod('Boolean', 'parseBoolean', async (_o, args, _l) =>
    makeBool(String(args[0].value).toLowerCase() === 'true'));
  reg.registerStaticMethod('Boolean', 'valueOf', async (_o, args, _l) => {
    if (args[0].type === 'String') return makeBool(String(args[0].value).toLowerCase() === 'true');
    return makeBool(!!args[0].value);
  });
  reg.registerStaticMethod('Boolean', 'toString', async (_o, args, _l) =>
    makeString(String(!!args[0].value)));
}

function registerLong(interp: Interpreter): void {
  const reg = interp.getRegistry();
  reg.register({ name: 'Long', superClass: 'Object', interfaces: ['Comparable'], fields: [], methods: [], constructors: [], modifiers: ['public'], isBuiltIn: true, innerClasses: [] });

  reg.registerStaticMethod('Long', 'parseLong', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const n = parseInt(s, args.length > 1 ? toNumber(args[1]) : 10);
    if (isNaN(n)) throw numberFormatException(line, s);
    return makeInt(n); // JS doesn't do real longs
  });
  reg.registerStaticMethod('Long', 'valueOf', async (_o, args, line) => {
    if (args[0].type === 'String') {
      const n = parseInt(String(args[0].value).trim(), 10);
      if (isNaN(n)) throw numberFormatException(line, String(args[0].value));
      return makeInt(n);
    }
    return makeInt(toNumber(args[0]));
  });
  reg.registerStaticMethod('Long', 'toString', async (_o, args, _l) => makeString(String(toNumber(args[0]))));
}

function registerFloat(interp: Interpreter): void {
  const reg = interp.getRegistry();
  reg.register({ name: 'Float', superClass: 'Object', interfaces: ['Comparable'], fields: [], methods: [], constructors: [], modifiers: ['public'], isBuiltIn: true, innerClasses: [] });

  reg.registerStaticMethod('Float', 'parseFloat', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const n = parseFloat(s);
    if (isNaN(n) && s !== 'NaN') throw numberFormatException(line, s);
    return makeDouble(n); // treated as double internally
  });
  reg.registerStaticMethod('Float', 'valueOf', async (_o, args, _l) => makeDouble(toNumber(args[0])));
}

function registerShort(interp: Interpreter): void {
  const reg = interp.getRegistry();
  reg.register({ name: 'Short', superClass: 'Object', interfaces: ['Comparable'], fields: [], methods: [], constructors: [], modifiers: ['public'], isBuiltIn: true, innerClasses: [] });

  reg.registerStaticMethod('Short', 'parseShort', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const n = parseInt(s, 10);
    if (isNaN(n)) throw numberFormatException(line, s);
    return makeInt(n);
  });
}

function registerByte(interp: Interpreter): void {
  const reg = interp.getRegistry();
  reg.register({ name: 'Byte', superClass: 'Object', interfaces: ['Comparable'], fields: [], methods: [], constructors: [], modifiers: ['public'], isBuiltIn: true, innerClasses: [] });

  reg.registerStaticMethod('Byte', 'parseByte', async (_o, args, line) => {
    const s = String(args[0].value).trim();
    const n = parseInt(s, 10);
    if (isNaN(n)) throw numberFormatException(line, s);
    return makeInt(n);
  });
}

function registerObject(interp: Interpreter): void {
  const reg = interp.getRegistry();
  // Object is typically registered, just add common methods
  if (!reg.has('Object')) {
    reg.register({ name: 'Object', superClass: null, interfaces: [], fields: [], methods: [], constructors: [], modifiers: ['public'], isBuiltIn: true, innerClasses: [] });
  }
  reg.registerMethod('Object', 'toString', async (obj, _a, _l) => {
    if (!obj) return makeString('null');
    return makeString(toJavaString(obj));
  });
  reg.registerMethod('Object', 'equals', async (obj, args, _l) => {
    if (!obj || !args[0]) return makeBool(false);
    return makeBool(obj.value === args[0].value);
  });
  reg.registerMethod('Object', 'hashCode', async (obj, _a, _l) => {
    if (!obj) return makeInt(0);
    return makeInt(simpleHash(toJavaString(obj)));
  });
  reg.registerMethod('Object', 'getClass', async (obj, _a, _l) => {
    if (!obj) return makeString('null');
    if (obj.type === 'object' && obj.value && typeof obj.value === 'object' && 'className' in obj.value) {
      return makeString((obj.value as any).className);
    }
    return makeString(obj.type);
  });
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
