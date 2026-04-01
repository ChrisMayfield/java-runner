// Environment: scope chain for variable lookup + class registry

import { JavaValue, NULL_VAL, defaultValue, makeObject, JavaObject } from './types';
import { RuntimeError, JavaException, makeJavaException } from './errors';
import {
  ClassDeclaration, MethodDeclaration, ConstructorDeclaration,
  FieldDeclaration, TypeNode, Parameter
} from '../parser/ast';

// ============================================================
// Variable scope
// ============================================================

export class Environment {
  private vars: Map<string, { value: JavaValue; isFinal: boolean }> = new Map();

  constructor(public parent: Environment | null = null) {}

  define(name: string, value: JavaValue, isFinal: boolean = false): void {
    this.vars.set(name, { value, isFinal });
  }

  get(name: string): JavaValue {
    const entry = this.vars.get(name);
    if (entry) return entry.value;
    if (this.parent) return this.parent.get(name);
    throw new RuntimeError(`Variable '${name}' is not defined`);
  }

  set(name: string, value: JavaValue): void {
    const entry = this.vars.get(name);
    if (entry) {
      if (entry.isFinal) {
        throw new RuntimeError(`Cannot assign to final variable '${name}'`);
      }
      entry.value = value;
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new RuntimeError(`Variable '${name}' is not defined`);
  }

  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  // Create a child scope
  child(): Environment {
    return new Environment(this);
  }
}

// ============================================================
// Class registry
// ============================================================

export interface ClassInfo {
  name: string;
  superClass: string | null;
  interfaces: string[];
  fields: FieldDeclaration[];
  methods: MethodDeclaration[];
  constructors: ConstructorDeclaration[];
  modifiers: string[];
  isBuiltIn: boolean;
  innerClasses: ClassInfo[];
}

export interface BuiltInMethod {
  (thisObj: JavaValue | null, args: JavaValue[], line: number): Promise<JavaValue>;
}

export class ClassRegistry {
  private classes: Map<string, ClassInfo> = new Map();
  private builtInMethods: Map<string, Map<string, BuiltInMethod>> = new Map();
  private builtInStaticMethods: Map<string, Map<string, BuiltInMethod>> = new Map();
  private builtInConstructors: Map<string, BuiltInMethod> = new Map();

  register(info: ClassInfo): void {
    this.classes.set(info.name, info);
  }

  get(name: string): ClassInfo | undefined {
    return this.classes.get(name);
  }

  has(name: string): boolean {
    return this.classes.has(name);
  }

  // Register a built-in instance method
  registerMethod(className: string, methodName: string, fn: BuiltInMethod): void {
    let methods = this.builtInMethods.get(className);
    if (!methods) {
      methods = new Map();
      this.builtInMethods.set(className, methods);
    }
    methods.set(methodName, fn);
  }

  // Register a built-in static method
  registerStaticMethod(className: string, methodName: string, fn: BuiltInMethod): void {
    let methods = this.builtInStaticMethods.get(className);
    if (!methods) {
      methods = new Map();
      this.builtInStaticMethods.set(className, methods);
    }
    methods.set(methodName, fn);
  }

  // Register a built-in constructor
  registerConstructor(className: string, fn: BuiltInMethod): void {
    this.builtInConstructors.set(className, fn);
  }

  getBuiltInMethod(className: string, methodName: string): BuiltInMethod | undefined {
    // Check class and all superclasses
    let current: string | null = className;
    while (current) {
      const methods = this.builtInMethods.get(current);
      if (methods) {
        const m = methods.get(methodName);
        if (m) return m;
      }
      const info = this.classes.get(current);
      current = info?.superClass || null;
    }
    // Check Object methods
    const objMethods = this.builtInMethods.get('Object');
    return objMethods?.get(methodName);
  }

  getBuiltInStaticMethod(className: string, methodName: string): BuiltInMethod | undefined {
    const methods = this.builtInStaticMethods.get(className);
    return methods?.get(methodName);
  }

  getBuiltInConstructor(className: string): BuiltInMethod | undefined {
    return this.builtInConstructors.get(className);
  }

  // Check if a class is assignable to another (is subclass or implements interface)
  isAssignableTo(fromClass: string, toClass: string): boolean {
    if (fromClass === toClass) return true;
    if (toClass === 'Object') return true;

    let current: string | null = fromClass;
    while (current) {
      if (current === toClass) return true;
      const info = this.classes.get(current);
      if (!info) break;
      // Check interfaces
      if (info.interfaces.includes(toClass)) return true;
      current = info.superClass;
    }
    return false;
  }

  // Create a new instance of a class with default field values
  createInstance(className: string): JavaValue {
    const fields = new Map<string, JavaValue>();
    let current: string | null = className;
    while (current) {
      const info = this.classes.get(current);
      if (!info) break;
      for (const field of info.fields) {
        if (field.modifiers.includes('static')) continue;
        for (const decl of field.declarators) {
          if (!fields.has(decl.name)) {
            fields.set(decl.name, defaultValue(field.type));
          }
        }
      }
      current = info.superClass;
    }
    return makeObject(className, fields);
  }
}
