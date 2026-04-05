// ArrayList and HashMap runtime

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, JavaObject, makeObject, makeInt, makeBool, makeString,
  makeArray, VOID, NULL_VAL, isNull, toJavaString, toNumber, asJavaObject
} from '../interpreter/types';
import { RuntimeError, arrayIndexOutOfBounds } from '../interpreter/errors';

export function registerCollections(interp: Interpreter): void {
  registerArrayList(interp);
  registerHashMap(interp);
  registerHashSet(interp);
  registerCollectionsClass(interp);
}

function registerArrayList(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'ArrayList',
    superClass: 'Object',
    interfaces: ['List', 'Iterable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // Also register as List
  registry.register({
    name: 'List',
    superClass: 'Object',
    interfaces: ['Iterable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'abstract'],
    isBuiltIn: true,
    innerClasses: [],
  });

  // Constructor
  registry.registerConstructor('ArrayList', async (_obj, args, _line) => {
    const list: JavaValue[] = [];
    // If passed another collection, copy its elements
    if (args.length > 0 && !isNull(args[0]) && args[0].value && typeof args[0].value === 'object' && 'nativeObj' in args[0].value) {
      const other = (args[0].value as JavaObject).nativeObj;
      if (Array.isArray(other)) {
        list.push(...other);
      } else if (other instanceof Set) {
        list.push(...other);
      }
    }
    return makeObject('ArrayList', new Map(), list);
  });

  const m = (name: string, fn: (obj: JavaValue, args: JavaValue[], line: number) => Promise<JavaValue>) => {
    registry.registerMethod('ArrayList', name, async (obj, args, line) => fn(obj!, args, line));
    registry.registerMethod('List', name, async (obj, args, line) => fn(obj!, args, line));
  };

  m('add', async (obj, args, line) => {
    const list = getList(obj, line);
    if (args.length === 2) {
      // add(int index, E element)
      const idx = toNumber(args[0]);
      list.splice(idx, 0, args[1]);
    } else {
      list.push(args[0]);
    }
    return makeBool(true);
  });

  m('get', async (obj, args, line) => {
    const list = getList(obj, line);
    const idx = toNumber(args[0]);
    if (idx < 0 || idx >= list.length) throw arrayIndexOutOfBounds(line, idx, list.length);
    return list[idx];
  });

  m('set', async (obj, args, line) => {
    const list = getList(obj, line);
    const idx = toNumber(args[0]);
    if (idx < 0 || idx >= list.length) throw arrayIndexOutOfBounds(line, idx, list.length);
    const old = list[idx];
    list[idx] = args[1];
    return old;
  });

  m('remove', async (obj, args, line) => {
    const list = getList(obj, line);
    if (args[0].type === 'int' || args[0].type === 'short' || args[0].type === 'byte') {
      const idx = toNumber(args[0]);
      if (idx < 0 || idx >= list.length) throw arrayIndexOutOfBounds(line, idx, list.length);
      return list.splice(idx, 1)[0];
    }
    // remove(Object)
    const target = args[0];
    for (let i = 0; i < list.length; i++) {
      if (valEq(list[i], target)) {
        list.splice(i, 1);
        return makeBool(true);
      }
    }
    return makeBool(false);
  });

  m('size', async (obj, _args, line) => makeInt(getList(obj, line).length));
  m('isEmpty', async (obj, _args, line) => makeBool(getList(obj, line).length === 0));
  m('clear', async (obj, _args, line) => { getList(obj, line).length = 0; return VOID; });

  m('contains', async (obj, args, line) => {
    const list = getList(obj, line);
    return makeBool(list.some(e => valEq(e, args[0])));
  });

  m('indexOf', async (obj, args, line) => {
    const list = getList(obj, line);
    for (let i = 0; i < list.length; i++) {
      if (valEq(list[i], args[0])) return makeInt(i);
    }
    return makeInt(-1);
  });

  m('lastIndexOf', async (obj, args, line) => {
    const list = getList(obj, line);
    for (let i = list.length - 1; i >= 0; i--) {
      if (valEq(list[i], args[0])) return makeInt(i);
    }
    return makeInt(-1);
  });

  m('toString', async (obj, _args, line) => {
    const list = getList(obj, line);
    return makeString('[' + list.map(e => toJavaString(e)).join(', ') + ']');
  });

  m('toArray', async (obj, _args, line) => {
    const list = getList(obj, line);
    return makeArray('Object', [...list]);
  });

  m('subList', async (obj, args, line) => {
    const list = getList(obj, line);
    const from = toNumber(args[0]);
    const to = toNumber(args[1]);
    const sub = list.slice(from, to);
    return makeObject('ArrayList', new Map(), sub);
  });

  m('addAll', async (obj, args, line) => {
    const list = getList(obj, line);
    const other = getList(args[0], line);
    list.push(...other);
    return makeBool(true);
  });

  m('sort', async (obj, args, line) => {
    const list = getList(obj, line);
    list.sort((a, b) => {
      if (a.type === 'String' && b.type === 'String') {
        return (a.value as string).localeCompare(b.value as string);
      }
      return toNumber(a) - toNumber(b);
    });
    return VOID;
  });

  m('iterator', async (obj, _args, line) => {
    const list = getList(obj, line);
    return makeObject('Iterator', new Map(), { list, index: 0 });
  });

  m('equals', async (obj, args, line) => {
    if (isNull(args[0])) return makeBool(false);
    const list1 = getList(obj, line);
    try {
      const list2 = getList(args[0], line);
      if (list1.length !== list2.length) return makeBool(false);
      for (let i = 0; i < list1.length; i++) {
        if (!valEq(list1[i], list2[i])) return makeBool(false);
      }
      return makeBool(true);
    } catch {
      return makeBool(false);
    }
  });
}

function registerHashMap(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'HashMap',
    superClass: 'Object',
    interfaces: ['Map'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.register({
    name: 'Map',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'abstract'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.registerConstructor('HashMap', async (_obj, _args, _line) => {
    return makeObject('HashMap', new Map(), new Map<string, { key: JavaValue; value: JavaValue }>());
  });

  const m = (name: string, fn: (obj: JavaValue, args: JavaValue[], line: number) => Promise<JavaValue>) => {
    registry.registerMethod('HashMap', name, async (obj, args, line) => fn(obj!, args, line));
    registry.registerMethod('Map', name, async (obj, args, line) => fn(obj!, args, line));
  };

  m('put', async (obj, args, line) => {
    const map = getMap(obj, line);
    const key = toMapKey(args[0]);
    const old = map.get(key);
    map.set(key, { key: args[0], value: args[1] });
    return old ? old.value : NULL_VAL;
  });

  m('get', async (obj, args, line) => {
    const map = getMap(obj, line);
    const entry = map.get(toMapKey(args[0]));
    return entry ? entry.value : NULL_VAL;
  });

  m('getOrDefault', async (obj, args, line) => {
    const map = getMap(obj, line);
    const entry = map.get(toMapKey(args[0]));
    return entry ? entry.value : args[1];
  });

  m('containsKey', async (obj, args, line) => {
    return makeBool(getMap(obj, line).has(toMapKey(args[0])));
  });

  m('containsValue', async (obj, args, line) => {
    const map = getMap(obj, line);
    for (const entry of map.values()) {
      if (valEq(entry.value, args[0])) return makeBool(true);
    }
    return makeBool(false);
  });

  m('remove', async (obj, args, line) => {
    const map = getMap(obj, line);
    const key = toMapKey(args[0]);
    const old = map.get(key);
    map.delete(key);
    return old ? old.value : NULL_VAL;
  });

  m('size', async (obj, _args, line) => makeInt(getMap(obj, line).size));
  m('isEmpty', async (obj, _args, line) => makeBool(getMap(obj, line).size === 0));
  m('clear', async (obj, _args, line) => { getMap(obj, line).clear(); return VOID; });

  m('keySet', async (obj, _args, line) => {
    const map = getMap(obj, line);
    const keys: JavaValue[] = [];
    for (const entry of map.values()) {
      keys.push(entry.key);
    }
    return makeObject('Set', new Map(), new Set(keys));
  });

  m('values', async (obj, _args, line) => {
    const map = getMap(obj, line);
    const vals: JavaValue[] = [];
    for (const entry of map.values()) {
      vals.push(entry.value);
    }
    return makeObject('ArrayList', new Map(), vals);
  });

  m('entrySet', async (obj, _args, line) => {
    const map = getMap(obj, line);
    const entries: JavaValue[] = [];
    for (const entry of map.values()) {
      const entryObj = makeObject('Map.Entry', new Map([
        ['key', entry.key],
        ['value', entry.value],
      ]));
      entries.push(entryObj);
    }
    return makeObject('Set', new Map(), new Set(entries));
  });

  m('putIfAbsent', async (obj, args, line) => {
    const map = getMap(obj, line);
    const key = toMapKey(args[0]);
    if (!map.has(key)) {
      map.set(key, { key: args[0], value: args[1] });
      return NULL_VAL;
    }
    return map.get(key)!.value;
  });

  m('toString', async (obj, _args, line) => {
    const map = getMap(obj, line);
    const parts: string[] = [];
    for (const entry of map.values()) {
      parts.push(`${toJavaString(entry.key)}=${toJavaString(entry.value)}`);
    }
    return makeString('{' + parts.join(', ') + '}');
  });

  // Map.Entry methods
  registry.register({
    name: 'Map.Entry',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.registerMethod('Map.Entry', 'getKey', async (obj, _args, _line) => {
    const jObj = asJavaObject(obj!);
    return jObj.fields.get('key') || NULL_VAL;
  });

  registry.registerMethod('Map.Entry', 'getValue', async (obj, _args, _line) => {
    const jObj = asJavaObject(obj!);
    return jObj.fields.get('value') || NULL_VAL;
  });
}

function registerHashSet(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'HashSet',
    superClass: 'Object',
    interfaces: ['Set', 'Iterable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.register({
    name: 'Set',
    superClass: 'Object',
    interfaces: ['Iterable'],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'abstract'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.registerConstructor('HashSet', async (_obj, _args, _line) => {
    return makeObject('HashSet', new Map(), new Map<string, JavaValue>());
  });

  const m = (name: string, fn: (obj: JavaValue, args: JavaValue[], line: number) => Promise<JavaValue>) => {
    registry.registerMethod('HashSet', name, async (obj, args, line) => fn(obj!, args, line));
    registry.registerMethod('Set', name, async (obj, args, line) => fn(obj!, args, line));
  };

  m('add', async (obj, args, line) => {
    const set = getSetMap(obj, line);
    const key = toMapKey(args[0]);
    const had = set.has(key);
    set.set(key, args[0]);
    return makeBool(!had);
  });

  m('remove', async (obj, args, line) => {
    return makeBool(getSetMap(obj, line).delete(toMapKey(args[0])));
  });

  m('contains', async (obj, args, line) => {
    return makeBool(getSetMap(obj, line).has(toMapKey(args[0])));
  });

  m('size', async (obj, _args, line) => makeInt(getSetMap(obj, line).size));
  m('isEmpty', async (obj, _args, line) => makeBool(getSetMap(obj, line).size === 0));
  m('clear', async (obj, _args, line) => { getSetMap(obj, line).clear(); return VOID; });

  m('toString', async (obj, _args, line) => {
    const set = getSetMap(obj, line);
    return makeString('[' + Array.from(set.values()).map(v => toJavaString(v)).join(', ') + ']');
  });
}

function registerCollectionsClass(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'Collections',
    superClass: null,
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  registry.registerStaticMethod('Collections', 'sort', async (_obj, args, line) => {
    const list = getList(args[0], line);
    list.sort((a, b) => {
      if (a.type === 'String' && b.type === 'String') {
        return (a.value as string).localeCompare(b.value as string);
      }
      return toNumber(a) - toNumber(b);
    });
    return VOID;
  });

  registry.registerStaticMethod('Collections', 'reverse', async (_obj, args, line) => {
    getList(args[0], line).reverse();
    return VOID;
  });

  registry.registerStaticMethod('Collections', 'shuffle', async (_obj, args, line) => {
    const list = getList(args[0], line);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return VOID;
  });

  registry.registerStaticMethod('Collections', 'min', async (_obj, args, line) => {
    const list = getList(args[0], line);
    if (list.length === 0) throw new RuntimeError('Collection is empty', line);
    return list.reduce((min, e) => toNumber(e) < toNumber(min) ? e : min);
  });

  registry.registerStaticMethod('Collections', 'max', async (_obj, args, line) => {
    const list = getList(args[0], line);
    if (list.length === 0) throw new RuntimeError('Collection is empty', line);
    return list.reduce((max, e) => toNumber(e) > toNumber(max) ? e : max);
  });

  registry.registerStaticMethod('Collections', 'frequency', async (_obj, args, line) => {
    const list = getList(args[0], line);
    let count = 0;
    for (const e of list) {
      if (valEq(e, args[1])) count++;
    }
    return makeInt(count);
  });
}

// ============================================================
// Helpers
// ============================================================

function getList(obj: JavaValue, line: number): JavaValue[] {
  if (obj.value && typeof obj.value === 'object' && 'nativeObj' in obj.value) {
    const native_ = (obj.value as JavaObject).nativeObj;
    if (Array.isArray(native_)) return native_;
  }
  throw new RuntimeError('Not a List', line);
}

function getMap(obj: JavaValue, line: number): Map<string, { key: JavaValue; value: JavaValue }> {
  if (obj.value && typeof obj.value === 'object' && 'nativeObj' in obj.value) {
    const native_ = (obj.value as JavaObject).nativeObj;
    if (native_ instanceof Map) return native_;
  }
  throw new RuntimeError('Not a Map', line);
}

function getSetMap(obj: JavaValue, line: number): Map<string, JavaValue> {
  if (obj.value && typeof obj.value === 'object' && 'nativeObj' in obj.value) {
    const native_ = (obj.value as JavaObject).nativeObj;
    if (native_ instanceof Map) return native_;
  }
  throw new RuntimeError('Not a Set', line);
}

function toMapKey(val: JavaValue): string {
  if (isNull(val)) return '__null__';
  if (val.type === 'String') return 's:' + val.value;
  if (val.type === 'int' || val.type === 'long' || val.type === 'short' || val.type === 'byte') return 'i:' + val.value;
  if (val.type === 'double' || val.type === 'float') return 'f:' + val.value;
  if (val.type === 'char') return 'c:' + val.value;
  if (val.type === 'boolean') return 'b:' + val.value;
  if (val.value && typeof val.value === 'object' && 'id' in val.value) return 'o:' + (val.value as any).id;
  return 'u:' + String(val.value);
}

function valEq(a: JavaValue, b: JavaValue): boolean {
  if (isNull(a) && isNull(b)) return true;
  if (isNull(a) || isNull(b)) return false;
  if (a.type === 'String' && b.type === 'String') return a.value === b.value;
  if (a.type === b.type) return a.value === b.value;
  return false;
}
