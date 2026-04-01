// Arrays utility class and array helpers

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, makeInt, makeString, makeBool, makeArray,
  toNumber, toJavaString, VOID
} from '../interpreter/types';

export function registerArrays(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Arrays',
    superClass: null,
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerStaticMethod('Arrays', 'sort', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    const start = args.length > 1 ? toNumber(args[1]) : 0;
    const end = args.length > 2 ? toNumber(args[2]) : arr.length;
    const sub = arr.slice(start, end);
    sub.sort((a, b) => {
      if (a.type === 'String' && b.type === 'String') {
        return (a.value as string).localeCompare(b.value as string);
      }
      if (a.type === 'char' && b.type === 'char') {
        return (a.value as string).localeCompare(b.value as string);
      }
      return toNumber(a) - toNumber(b);
    });
    for (let i = start; i < end; i++) {
      arr[i] = sub[i - start];
    }
    return VOID;
  });

  reg.registerStaticMethod('Arrays', 'toString', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    return makeString('[' + arr.map(e => toJavaString(e)).join(', ') + ']');
  });

  reg.registerStaticMethod('Arrays', 'deepToString', async (_o, args, _line) => {
    function deepStr(val: JavaValue): string {
      if (val.type === 'array' && val.value && typeof val.value === 'object' && 'elements' in val.value) {
        const els = (val.value as any).elements as JavaValue[];
        return '[' + els.map(e => deepStr(e)).join(', ') + ']';
      }
      return toJavaString(val);
    }
    return makeString(deepStr(args[0]));
  });

  reg.registerStaticMethod('Arrays', 'fill', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    const value = args.length > 3 ? args[3] : args[1];
    const start = args.length > 3 ? toNumber(args[1]) : 0;
    const end = args.length > 3 ? toNumber(args[2]) : arr.length;
    for (let i = start; i < end; i++) {
      arr[i] = value;
    }
    return VOID;
  });

  reg.registerStaticMethod('Arrays', 'copyOf', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    const newLen = toNumber(args[1]);
    const result: JavaValue[] = [];
    for (let i = 0; i < newLen; i++) {
      result.push(i < arr.length ? arr[i] : makeInt(0));
    }
    const elType = args[0].value && typeof args[0].value === 'object' && 'elementType' in args[0].value
      ? (args[0].value as any).elementType : 'Object';
    return makeArray(elType, result);
  });

  reg.registerStaticMethod('Arrays', 'copyOfRange', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    const from = toNumber(args[1]);
    const to = toNumber(args[2]);
    const result = arr.slice(from, to);
    while (result.length < (to - from)) result.push(makeInt(0));
    const elType = args[0].value && typeof args[0].value === 'object' && 'elementType' in args[0].value
      ? (args[0].value as any).elementType : 'Object';
    return makeArray(elType, result);
  });

  reg.registerStaticMethod('Arrays', 'equals', async (_o, args, _line) => {
    const a = getElements(args[0]);
    const b = getElements(args[1]);
    if (a.length !== b.length) return makeBool(false);
    for (let i = 0; i < a.length; i++) {
      if (toJavaString(a[i]) !== toJavaString(b[i])) return makeBool(false);
    }
    return makeBool(true);
  });

  reg.registerStaticMethod('Arrays', 'binarySearch', async (_o, args, _line) => {
    const arr = getElements(args[0]);
    const target = args[1];
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = compareValues(arr[mid], target);
      if (cmp < 0) lo = mid + 1;
      else if (cmp > 0) hi = mid - 1;
      else return makeInt(mid);
    }
    return makeInt(-(lo + 1));
  });

  reg.registerStaticMethod('Arrays', 'asList', async (_o, args, _line) => {
    // Arrays.asList takes varargs or a single array
    const elements: JavaValue[] = [];
    if (args.length === 1 && args[0].type === 'array' && args[0].value && typeof args[0].value === 'object' && 'elements' in args[0].value) {
      elements.push(...getElements(args[0]));
    } else {
      elements.push(...args);
    }
    return { type: 'object' as const, value: { className: 'ArrayList', fields: new Map(), nativeObj: elements, id: Math.random() } };
  });
}

function getElements(val: JavaValue): JavaValue[] {
  if (val.value && typeof val.value === 'object' && 'elements' in val.value) {
    return (val.value as any).elements as JavaValue[];
  }
  return [];
}

function compareValues(a: JavaValue, b: JavaValue): number {
  if (a.type === 'String' && b.type === 'String') {
    return (a.value as string).localeCompare(b.value as string);
  }
  return toNumber(a) - toNumber(b);
}
