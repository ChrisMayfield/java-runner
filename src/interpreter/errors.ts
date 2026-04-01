// Interpreter control flow signals and runtime errors

import { JavaValue, JavaObject } from './types';

// Signal for return statements - thrown and caught at method boundary
export class ReturnSignal {
  constructor(public value: JavaValue) {}
}

// Signal for break statements
export class BreakSignal {}

// Signal for continue statements
export class ContinueSignal {}

// Java exception thrown by user code or runtime
export class JavaException {
  constructor(
    public exceptionObject: JavaValue,
    public message: string,
    public line: number,
    public stackTrace: StackFrame[] = []
  ) {}

  getTypeName(): string {
    if (this.exceptionObject.value && typeof this.exceptionObject.value === 'object' && 'className' in this.exceptionObject.value) {
      return (this.exceptionObject.value as JavaObject).className;
    }
    return 'Exception';
  }

  toString(): string {
    const frames = this.stackTrace.map(f => `    at ${f.className}.${f.methodName}(line ${f.line})`).join('\n');
    return `${this.getTypeName()}: ${this.message}${frames ? '\n' + frames : ''}`;
  }
}

export interface StackFrame {
  className: string;
  methodName: string;
  line: number;
}

// Runtime error (not a Java exception - indicates interpreter bug or unsupported feature)
export class RuntimeError extends Error {
  constructor(
    message: string,
    public line: number = 0,
    public column: number = 0
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

// Step limit exceeded - infinite loop protection
export class StepLimitExceeded extends Error {
  constructor(public limit: number) {
    super(`Execution exceeded ${limit.toLocaleString()} steps. Possible infinite loop?`);
    this.name = 'StepLimitExceeded';
  }
}

// Execution cancelled by user (Stop button)
export class ExecutionCancelled extends Error {
  constructor() {
    super('Execution cancelled');
    this.name = 'ExecutionCancelled';
  }
}

// Helper to create common Java exceptions
export function makeJavaException(
  className: string,
  message: string,
  line: number
): JavaException {
  const obj: JavaObject = {
    className,
    fields: new Map([
      ['message', { type: 'String', value: message }],
    ]),
    id: 0,
  };
  return new JavaException({ type: className, value: obj }, message, line);
}

export function nullPointerException(line: number, detail?: string): JavaException {
  return makeJavaException('NullPointerException', detail || 'null', line);
}

export function arrayIndexOutOfBounds(line: number, index: number, length: number): JavaException {
  return makeJavaException(
    'ArrayIndexOutOfBoundsException',
    `Index ${index} out of bounds for length ${length}`,
    line
  );
}

export function arithmeticException(line: number, message: string): JavaException {
  return makeJavaException('ArithmeticException', message, line);
}

export function classCastException(line: number, from: string, to: string): JavaException {
  return makeJavaException('ClassCastException', `${from} cannot be cast to ${to}`, line);
}

export function inputMismatchException(line: number): JavaException {
  return makeJavaException('InputMismatchException', 'Input mismatch', line);
}

export function numberFormatException(line: number, s: string): JavaException {
  return makeJavaException('NumberFormatException', `For input string: "${s}"`, line);
}

export function negativeArraySizeException(line: number, size: number): JavaException {
  return makeJavaException('NegativeArraySizeException', String(size), line);
}

export function stackOverflowError(line: number): JavaException {
  return makeJavaException('StackOverflowError', 'Stack overflow', line);
}

export function illegalArgumentException(line: number, message: string): JavaException {
  return makeJavaException('IllegalArgumentException', message, line);
}

export function stringIndexOutOfBounds(line: number, index: number): JavaException {
  return makeJavaException('StringIndexOutOfBoundsException', `String index out of range: ${index}`, line);
}

export function unsupportedOperationException(line: number, message: string): JavaException {
  return makeJavaException('UnsupportedOperationException', message, line);
}
