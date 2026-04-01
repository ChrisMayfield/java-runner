// Java type system representation for runtime values

import { TypeNode } from '../parser/ast';

export type JavaTypeName =
  | 'int' | 'long' | 'float' | 'double' | 'short' | 'byte' | 'char' | 'boolean'
  | 'void' | 'null' | 'String' | 'Object' | 'array' | string;

export function isPrimitive(t: JavaTypeName): boolean {
  return t === 'int' || t === 'long' || t === 'float' || t === 'double' ||
         t === 'short' || t === 'byte' || t === 'char' || t === 'boolean';
}

export function isNumeric(t: JavaTypeName): boolean {
  return t === 'int' || t === 'long' || t === 'float' || t === 'double' ||
         t === 'short' || t === 'byte' || t === 'char';
}

export function isIntegral(t: JavaTypeName): boolean {
  return t === 'int' || t === 'long' || t === 'short' || t === 'byte' || t === 'char';
}

export function defaultValue(type: TypeNode | 'void'): JavaValue {
  if (type === 'void') return VOID;
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'int': case 'short': case 'byte': return makeInt(0);
        case 'long': return makeLong(0);
        case 'float': return makeFloat(0.0);
        case 'double': return makeDouble(0.0);
        case 'char': return makeChar('\0');
        case 'boolean': return makeBool(false);
      }
      break;
    case 'ArrayType':
    case 'ClassType':
      return NULL_VAL;
  }
  return NULL_VAL;
}

export function typeNodeToName(type: TypeNode | 'void'): JavaTypeName {
  if (type === 'void') return 'void';
  switch (type.kind) {
    case 'PrimitiveType': return type.name;
    case 'ClassType': return type.name;
    case 'ArrayType': return 'array';
  }
}

// Numeric promotion: what type results from a binary operation
export function promoteNumeric(a: JavaTypeName, b: JavaTypeName): JavaTypeName {
  if (a === 'double' || b === 'double') return 'double';
  if (a === 'float' || b === 'float') return 'float';
  if (a === 'long' || b === 'long') return 'long';
  return 'int';
}

// ============================================================
// Runtime value types
// ============================================================

export interface JavaValue {
  type: JavaTypeName;
  value: any;
}

export interface JavaObject {
  className: string;
  fields: Map<string, JavaValue>;
  nativeObj?: any;          // For built-in wrappers (ArrayList→Array, HashMap→Map, etc.)
  id: number;               // Unique ID for reference equality
}

export interface JavaArray {
  elementType: JavaTypeName;
  elements: JavaValue[];
  id: number;
}

let nextId = 1;
function newId(): number { return nextId++; }
export function resetIds(): void { nextId = 1; }

// ============================================================
// Value constructors
// ============================================================

export function makeInt(v: number): JavaValue {
  return { type: 'int', value: v | 0 }; // truncate to 32-bit int
}

export function makeLong(v: number): JavaValue {
  return { type: 'long', value: Math.trunc(v) };
}

export function makeFloat(v: number): JavaValue {
  return { type: 'float', value: Math.fround(v) };
}

export function makeDouble(v: number): JavaValue {
  return { type: 'double', value: v };
}

export function makeChar(v: string): JavaValue {
  return { type: 'char', value: v.charAt(0) || '\0' };
}

export function makeBool(v: boolean): JavaValue {
  return { type: 'boolean', value: v };
}

export function makeString(v: string): JavaValue {
  return { type: 'String', value: v };
}

export function makeNull(): JavaValue {
  return { type: 'null', value: null };
}

export function makeObject(className: string, fields?: Map<string, JavaValue>, nativeObj?: any): JavaValue {
  const obj: JavaObject = {
    className,
    fields: fields || new Map(),
    nativeObj,
    id: newId(),
  };
  return { type: className, value: obj };
}

export function makeArray(elementType: JavaTypeName, elements: JavaValue[]): JavaValue {
  const arr: JavaArray = {
    elementType,
    elements,
    id: newId(),
  };
  return { type: 'array', value: arr };
}

export const NULL_VAL = makeNull();
export const VOID: JavaValue = { type: 'void', value: undefined };
export const TRUE = makeBool(true);
export const FALSE = makeBool(false);

// ============================================================
// Value utilities
// ============================================================

export function isNull(v: JavaValue): boolean {
  return v.type === 'null' || v.value === null;
}

export function asJavaObject(v: JavaValue): JavaObject {
  if (v.value && typeof v.value === 'object' && 'className' in v.value) {
    return v.value as JavaObject;
  }
  throw new Error(`Not a Java object: ${v.type}`);
}

export function asJavaArray(v: JavaValue): JavaArray {
  if (v.value && typeof v.value === 'object' && 'elements' in v.value) {
    return v.value as JavaArray;
  }
  throw new Error(`Not a Java array: ${v.type}`);
}

export function toNumber(v: JavaValue): number {
  if (v.type === 'char') return (v.value as string).charCodeAt(0);
  return v.value as number;
}

export function toJavaString(v: JavaValue): string {
  if (isNull(v)) return 'null';
  switch (v.type) {
    case 'String': return v.value as string;
    case 'char': return v.value as string;
    case 'boolean': return v.value ? 'true' : 'false';
    case 'int': case 'short': case 'byte': case 'long':
      return String(v.value);
    case 'float': case 'double': {
      const n = v.value as number;
      // Match Java's toString for doubles
      if (Number.isInteger(n) && isFinite(n)) return n + '.0';
      return String(n);
    }
    case 'array': {
      const arr = v.value as JavaArray;
      // Default array toString is [type@hash, but Arrays.toString is different
      return `[${arr.elementType}@${arr.id}`;
    }
    default: {
      // Object: try toString
      if (v.value && typeof v.value === 'object' && 'className' in v.value) {
        const obj = v.value as JavaObject;
        return `${obj.className}@${obj.id}`;
      }
      return String(v.value);
    }
  }
}

// Cast a numeric value to a target type
export function castNumeric(v: JavaValue, target: JavaTypeName): JavaValue {
  const n = toNumber(v);
  switch (target) {
    case 'int': return makeInt(n);
    case 'long': return makeLong(n);
    case 'float': return makeFloat(n);
    case 'double': return makeDouble(n);
    case 'short': return { type: 'short', value: ((n & 0xFFFF) << 16) >> 16 };
    case 'byte': return { type: 'byte', value: ((n & 0xFF) << 24) >> 24 };
    case 'char': return makeChar(String.fromCharCode(n & 0xFFFF));
    default: return v;
  }
}
