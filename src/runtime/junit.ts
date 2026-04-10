// JUnit assertion methods (static imports from org.junit.jupiter.api.Assertions)

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, isNull, isPrimitive, toNumber, toJavaString, asJavaArray
} from '../interpreter/types';
import { VOID } from '../interpreter/types';
import { makeJavaException } from '../interpreter/errors';

function assertionFailed(message: string, line: number) {
  return makeJavaException('AssertionError', message, line);
}

function formatValue(v: JavaValue): string {
  if (isNull(v)) return 'null';
  if (v.type === 'String') return `"${v.value}"`;
  return toJavaString(v);
}

function valuesEqual(a: JavaValue, b: JavaValue): boolean {
  if (isNull(a) && isNull(b)) return true;
  if (isNull(a) || isNull(b)) return false;
  if (a.type === 'String' && b.type === 'String') return a.value === b.value;
  if (isPrimitive(a.type) && isPrimitive(b.type)) return toNumber(a) === toNumber(b);
  // Reference equality for objects
  if (a.value && b.value && typeof a.value === 'object' && typeof b.value === 'object') {
    if ('id' in a.value && 'id' in b.value) {
      return a.value.id === b.value.id;
    }
  }
  return a.value === b.value;
}

function referenceEquals(a: JavaValue, b: JavaValue): boolean {
  if (isNull(a) && isNull(b)) return true;
  if (isNull(a) || isNull(b)) return false;
  if (a.value && b.value && typeof a.value === 'object' && typeof b.value === 'object') {
    if ('id' in a.value && 'id' in b.value) {
      return a.value.id === b.value.id;
    }
  }
  return a.value === b.value;
}

export function registerJUnit(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'Assertions',
    superClass: null,
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'final'],
    isBuiltIn: true,
    innerClasses: [],
  });

  const s = (name: string, fn: (args: JavaValue[], line: number) => Promise<JavaValue>) => {
    registry.registerStaticMethod('Assertions', name, async (_obj, args, line) => fn(args, line));
  };

  // assertEquals(expected, actual) — primitives use ==, objects use equals
  // assertEquals(expected, actual, delta) — for doubles with tolerance
  s('assertEquals', async (args, line) => {
    if (args.length >= 3 && (args[0].type === 'double' || args[0].type === 'float') &&
        (args[2].type === 'double' || args[2].type === 'float' ||
         args[2].type === 'int' || args[2].type === 'long')) {
      // assertEquals(double expected, double actual, double delta)
      const expected = toNumber(args[0]);
      const actual = toNumber(args[1]);
      const delta = toNumber(args[2]);
      if (Math.abs(expected - actual) > delta) {
        throw assertionFailed(
          `expected: <${expected}> but was: <${actual}> (delta: ${delta})`, line
        );
      }
      return VOID;
    }
    const expected = args[0];
    const actual = args[1];
    if (!valuesEqual(expected, actual)) {
      throw assertionFailed(
        `expected: <${formatValue(expected)}> but was: <${formatValue(actual)}>`, line
      );
    }
    return VOID;
  });

  // assertArrayEquals(expected, actual)
  s('assertArrayEquals', async (args, line) => {
    const expected = args[0];
    const actual = args[1];
    if (isNull(expected) && isNull(actual)) return VOID;
    if (isNull(expected) || isNull(actual)) {
      throw assertionFailed(
        `expected: <${formatValue(expected)}> but was: <${formatValue(actual)}>`, line
      );
    }
    const expArr = asJavaArray(expected);
    const actArr = asJavaArray(actual);
    if (expArr.elements.length !== actArr.elements.length) {
      throw assertionFailed(
        `array lengths differ, expected: <${expArr.elements.length}> but was: <${actArr.elements.length}>`, line
      );
    }
    for (let i = 0; i < expArr.elements.length; i++) {
      if (!valuesEqual(expArr.elements[i], actArr.elements[i])) {
        throw assertionFailed(
          `array contents differ at index [${i}], expected: <${formatValue(expArr.elements[i])}> but was: <${formatValue(actArr.elements[i])}>`, line
        );
      }
    }
    return VOID;
  });

  // assertTrue(condition)
  s('assertTrue', async (args, line) => {
    if (args[0].value !== true) {
      throw assertionFailed('expected: <true> but was: <false>', line);
    }
    return VOID;
  });

  // assertFalse(condition)
  s('assertFalse', async (args, line) => {
    if (args[0].value !== false) {
      throw assertionFailed('expected: <false> but was: <true>', line);
    }
    return VOID;
  });

  // assertNull(object)
  s('assertNull', async (args, line) => {
    if (!isNull(args[0])) {
      throw assertionFailed(
        `expected: <null> but was: <${formatValue(args[0])}>`, line
      );
    }
    return VOID;
  });

  // assertSame(expected, actual) — reference equality
  s('assertSame', async (args, line) => {
    if (!referenceEquals(args[0], args[1])) {
      throw assertionFailed(
        `expected same: <${formatValue(args[0])}> but was: <${formatValue(args[1])}>`, line
      );
    }
    return VOID;
  });
}
