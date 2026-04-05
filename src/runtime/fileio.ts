// Simulated file I/O with in-memory filesystem

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, JavaObject, makeString, makeObject, makeBool, makeInt,
  makeDouble, makeChar, makeArray, VOID, NULL_VAL, toNumber, toJavaString,
  isNull, asJavaObject
} from '../interpreter/types';
import { RuntimeError, makeJavaException } from '../interpreter/errors';

/** In-memory file system used by java-runner */
const virtualFS = new Map<string, string>();

export function getVirtualFS(): Map<string, string> {
  return virtualFS;
}

export function registerFileIO(interp: Interpreter): void {
  const reg = interp.getRegistry();

  // ===================== File =====================
  reg.register({
    name: 'File',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('File', async (_obj, args, _line) => {
    const path = String(args[0].value);
    return makeObject('File', new Map([['path', makeString(path)]]));
  });

  reg.registerMethod('File', 'exists', async (obj, _a, _l) =>
    makeBool(virtualFS.has(getPath(obj!))));
  reg.registerMethod('File', 'getName', async (obj, _a, _l) => {
    const p = getPath(obj!);
    return makeString(p.includes('/') ? p.substring(p.lastIndexOf('/') + 1) : p);
  });
  reg.registerMethod('File', 'getPath', async (obj, _a, _l) => makeString(getPath(obj!)));
  reg.registerMethod('File', 'getAbsolutePath', async (obj, _a, _l) => makeString(getPath(obj!)));
  reg.registerMethod('File', 'length', async (obj, _a, _l) => {
    const content = virtualFS.get(getPath(obj!));
    return makeInt(content ? content.length : 0);
  });
  reg.registerMethod('File', 'delete', async (obj, _a, _l) =>
    makeBool(virtualFS.delete(getPath(obj!))));
  reg.registerMethod('File', 'createNewFile', async (obj, _a, _l) => {
    const p = getPath(obj!);
    if (virtualFS.has(p)) return makeBool(false);
    virtualFS.set(p, '');
    return makeBool(true);
  });
  reg.registerMethod('File', 'toString', async (obj, _a, _l) => makeString(getPath(obj!)));

  // ===================== PrintWriter =====================
  reg.register({
    name: 'PrintWriter',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('PrintWriter', async (_obj, args, line) => {
    let path: string;
    if (args[0].type === 'String') {
      path = String(args[0].value);
    } else if (args[0].type === 'object' && asJavaObject(args[0]).className === 'File') {
      path = getPath(args[0]);
    } else {
      path = toJavaString(args[0]);
    }
    virtualFS.set(path, '');
    return makeObject('PrintWriter', new Map([
      ['path', makeString(path)],
      ['buffer', makeString('')],
    ]));
  });

  const pw = (name: string, fn: (obj: JavaValue, args: JavaValue[], line: number) => Promise<JavaValue>) => {
    reg.registerMethod('PrintWriter', name, async (obj, args, line) => fn(obj!, args, line));
  };

  pw('print', async (obj, args, _l) => {
    appendToWriter(obj, toJavaString(args[0]));
    return VOID;
  });

  pw('println', async (obj, args, _l) => {
    appendToWriter(obj, (args.length > 0 ? toJavaString(args[0]) : '') + '\n');
    return VOID;
  });

  pw('printf', async (obj, args, _l) => {
    // Simple: just concat all args
    appendToWriter(obj, args.map(a => toJavaString(a)).join(''));
    return VOID;
  });

  pw('write', async (obj, args, _l) => {
    appendToWriter(obj, toJavaString(args[0]));
    return VOID;
  });

  pw('flush', async (_obj, _a, _l) => VOID);

  pw('close', async (obj, _a, _l) => {
    // Flush buffer to virtualFS
    const jObj = asJavaObject(obj);
    const path = String(jObj.fields.get('path')?.value ?? '');
    const buf = String(jObj.fields.get('buffer')?.value ?? '');
    virtualFS.set(path, buf);
    return VOID;
  });

  // ===================== FileWriter =====================
  reg.register({
    name: 'FileWriter',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('FileWriter', async (_obj, args, _line) => {
    let path: string;
    if (args[0].type === 'String') {
      path = String(args[0].value);
    } else {
      path = getPath(args[0]);
    }
    const append = args.length > 1 ? !!args[1].value : false;
    if (!append) {
      virtualFS.set(path, '');
    } else if (!virtualFS.has(path)) {
      virtualFS.set(path, '');
    }
    return makeObject('FileWriter', new Map([['path', makeString(path)]]));
  });

  reg.registerMethod('FileWriter', 'write', async (obj, args, _l) => {
    const path = getPath(obj!);
    virtualFS.set(path, (virtualFS.get(path) ?? '') + toJavaString(args[0]));
    return VOID;
  });
  reg.registerMethod('FileWriter', 'close', async (_obj, _a, _l) => VOID);

  // ===================== BufferedReader =====================
  reg.register({
    name: 'BufferedReader',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('BufferedReader', async (_obj, args, _line) => {
    // Unwrap FileReader
    const reader = asJavaObject(args[0]);
    const path = String(reader.fields.get('path')?.value ?? '');
    const content = virtualFS.get(path) ?? '';
    const lines = content.split('\n');
    return makeObject('BufferedReader', new Map([
      ['path', makeString(path)],
    ]), { lines, index: 0 });
  });

  reg.registerMethod('BufferedReader', 'readLine', async (obj, _a, _l) => {
    const jObj = asJavaObject(obj!);
    const state = jObj.nativeObj as { lines: string[]; index: number };
    if (state.index >= state.lines.length) return NULL_VAL;
    return makeString(state.lines[state.index++]);
  });

  reg.registerMethod('BufferedReader', 'ready', async (obj, _a, _l) => {
    const jObj = asJavaObject(obj!);
    const state = jObj.nativeObj as { lines: string[]; index: number };
    return makeBool(state.index < state.lines.length);
  });

  reg.registerMethod('BufferedReader', 'close', async (_obj, _a, _l) => VOID);

  // ===================== FileReader =====================
  reg.register({
    name: 'FileReader',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('FileReader', async (_obj, args, line) => {
    let path: string;
    if (args[0].type === 'String') {
      path = String(args[0].value);
    } else {
      path = getPath(args[0]);
    }
    if (!virtualFS.has(path)) {
      throw makeJavaException('FileNotFoundException', path, line);
    }
    return makeObject('FileReader', new Map([['path', makeString(path)]]));
  });

  // ===================== Scanner(File) support =====================
  // Scanner with File argument is handled in scanner.ts by checking the arg type
}

function getPath(obj: JavaValue): string {
  const jObj = asJavaObject(obj);
  return String(jObj.fields.get('path')?.value ?? '');
}

function appendToWriter(obj: JavaValue, text: string): void {
  const jObj = asJavaObject(obj);
  const oldBuf = String(jObj.fields.get('buffer')?.value ?? '');
  jObj.fields.set('buffer', makeString(oldBuf + text));
}
