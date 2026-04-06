import { describe, it, expect } from 'vitest';
import { parseReplInput } from '../src/parser/repl';
import { Interpreter, InterpreterIO } from '../src/interpreter/interpreter';
import { registerAll } from '../src/runtime/index';
import { makeArray, makeString, toJavaString } from '../src/interpreter/types';
import { ParseError } from '../src/parser/index';

// ============================================================
// Helper: create a REPL-like interpreter + environment
// ============================================================

function createRepl() {
  let output = '';
  const io: InterpreterIO = {
    print: (text) => { output += text; },
    println: (text) => { output += text + '\n'; },
    requestInput: async () => '',
  };
  const interp = new Interpreter(io);
  registerAll(interp, io);
  const env = interp.getGlobalEnv().child();
  env.define('__currentClass__', makeString('Main'));
  env.define('args', makeArray('String', []));

  return {
    interp,
    env,
    getOutput() { return output; },
    clearOutput() { output = ''; },
    async exec(input: string) {
      const result = parseReplInput(input);
      switch (result.kind) {
        case 'expression': {
          const val = await interp.evalReplExpression(result.expression, env);
          return val.type !== 'void' ? await interp.valueToString(val) : undefined;
        }
        case 'statements': {
          let lastVarVal: string | undefined;
          for (const stmt of result.statements) {
            await interp.execReplStatement(stmt, env);
            if (stmt.kind === 'VariableDeclarationStatement') {
              for (const decl of stmt.declarators) {
                const val = env.get(decl.name);
                lastVarVal = `${decl.name} ==> ${await interp.valueToString(val)}`;
              }
            }
          }
          return lastVarVal;
        }
        case 'classes': {
          for (const cls of result.classes) {
            interp.registerUserClass(cls);
            await interp.initUserClassStaticFields(cls);
          }
          return `created class ${result.classes.map(c => c.name).join(', ')}`;
        }
        case 'import':
          return undefined;
      }
    },
  };
}

// ============================================================
// parseReplInput tests
// ============================================================

describe('parseReplInput', () => {
  it('parses integer literal as expression', () => {
    const result = parseReplInput('42');
    expect(result.kind).toBe('expression');
  });

  it('parses string literal as expression', () => {
    const result = parseReplInput('"hello"');
    expect(result.kind).toBe('expression');
  });

  it('parses method call as expression', () => {
    const result = parseReplInput('Math.max(1, 2)');
    expect(result.kind).toBe('expression');
  });

  it('parses variable declaration as statements', () => {
    const result = parseReplInput('int x = 5;');
    expect(result.kind).toBe('statements');
    if (result.kind === 'statements') {
      expect(result.statements.length).toBe(1);
      expect(result.statements[0].kind).toBe('VariableDeclarationStatement');
    }
  });

  it('parses multiple statements', () => {
    const result = parseReplInput('int x = 1; int y = 2;');
    expect(result.kind).toBe('statements');
    if (result.kind === 'statements') {
      expect(result.statements.length).toBe(2);
    }
  });

  it('parses for loop as statements', () => {
    const result = parseReplInput('for (int i = 0; i < 5; i++) { System.out.println(i); }');
    expect(result.kind).toBe('statements');
  });

  it('parses class declaration', () => {
    const result = parseReplInput('class Point { int x; int y; }');
    expect(result.kind).toBe('classes');
    if (result.kind === 'classes') {
      expect(result.classes[0].name).toBe('Point');
    }
  });

  it('parses public class declaration', () => {
    const result = parseReplInput('public class Foo { public static int bar() { return 42; } }');
    expect(result.kind).toBe('classes');
  });

  it('parses import statement', () => {
    const result = parseReplInput('import java.util.Scanner;');
    expect(result.kind).toBe('import');
  });

  it('parses expression with trailing semicolon', () => {
    const result = parseReplInput('1 + 2;');
    expect(result.kind).toBe('expression');
  });

  it('parses arithmetic expression', () => {
    const result = parseReplInput('3 * 4 + 1');
    expect(result.kind).toBe('expression');
  });

  it('parses boolean expression', () => {
    const result = parseReplInput('true && false');
    expect(result.kind).toBe('expression');
  });

  it('parses new object expression', () => {
    const result = parseReplInput('new ArrayList<String>()');
    expect(result.kind).toBe('expression');
  });

  it('throws on empty input', () => {
    expect(() => parseReplInput('')).toThrow(ParseError);
    expect(() => parseReplInput('   ')).toThrow(ParseError);
  });

  it('throws on invalid syntax', () => {
    expect(() => parseReplInput('int = ;')).toThrow();
  });
});

// ============================================================
// REPL interpreter integration tests
// ============================================================

describe('REPL execution', () => {
  it('evaluates integer expression', async () => {
    const repl = createRepl();
    expect(await repl.exec('42')).toBe('42');
  });

  it('evaluates string expression', async () => {
    const repl = createRepl();
    expect(await repl.exec('"hello"')).toBe('hello');
  });

  it('evaluates arithmetic', async () => {
    const repl = createRepl();
    expect(await repl.exec('3 + 4')).toBe('7');
  });

  it('evaluates boolean expression', async () => {
    const repl = createRepl();
    expect(await repl.exec('10 > 5')).toBe('true');
  });

  it('evaluates Math methods', async () => {
    const repl = createRepl();
    expect(await repl.exec('Math.max(3, 7)')).toBe('7');
  });

  it('evaluates double expression', async () => {
    const repl = createRepl();
    expect(await repl.exec('1.5 + 2.5')).toBe('4.0');
  });

  it('declares variable and persists it', async () => {
    const repl = createRepl();
    await repl.exec('int x = 10;');
    expect(await repl.exec('x')).toBe('10');
  });

  it('persists variables across multiple inputs', async () => {
    const repl = createRepl();
    await repl.exec('int a = 3;');
    await repl.exec('int b = 4;');
    expect(await repl.exec('a + b')).toBe('7');
  });

  it('reassigns variables', async () => {
    const repl = createRepl();
    await repl.exec('int x = 1;');
    await repl.exec('x = 42;');
    expect(await repl.exec('x')).toBe('42');
  });

  it('declares and uses String variable', async () => {
    const repl = createRepl();
    await repl.exec('String name = "Alice";');
    expect(await repl.exec('name')).toBe('Alice');
  });

  it('string concatenation across inputs', async () => {
    const repl = createRepl();
    await repl.exec('String a = "Hello";');
    await repl.exec('String b = " World";');
    expect(await repl.exec('a + b')).toBe('Hello World');
  });

  it('prints output via System.out.println', async () => {
    const repl = createRepl();
    await repl.exec('System.out.println("hi");');
    expect(repl.getOutput()).toBe('hi\n');
  });

  it('output accumulates across inputs', async () => {
    const repl = createRepl();
    await repl.exec('System.out.print("a");');
    await repl.exec('System.out.print("b");');
    expect(repl.getOutput()).toBe('ab');
  });

  it('for loop produces output', async () => {
    const repl = createRepl();
    await repl.exec('for (int i = 0; i < 3; i++) { System.out.println(i); }');
    expect(repl.getOutput()).toBe('0\n1\n2\n');
  });

  it('if-else works', async () => {
    const repl = createRepl();
    await repl.exec('int x = 10;');
    await repl.exec('if (x > 5) { System.out.println("big"); } else { System.out.println("small"); }');
    expect(repl.getOutput()).toBe('big\n');
  });

  it('ArrayList persists across inputs', async () => {
    const repl = createRepl();
    await repl.exec('ArrayList<String> list = new ArrayList<>();');
    await repl.exec('list.add("one");');
    await repl.exec('list.add("two");');
    expect(await repl.exec('list.size()')).toBe('2');
    expect(await repl.exec('list.get(0)')).toBe('one');
  });

  it('HashMap persists across inputs', async () => {
    const repl = createRepl();
    await repl.exec('HashMap<String, Integer> map = new HashMap<>();');
    await repl.exec('map.put("a", 1);');
    await repl.exec('map.put("b", 2);');
    expect(await repl.exec('map.get("a")')).toBe('1');
    expect(await repl.exec('map.size()')).toBe('2');
  });

  it('registers user-defined class', async () => {
    const repl = createRepl();
    const result = await repl.exec('class Point { int x; int y; }');
    expect(result).toContain('created class Point');
  });

  it('import statements are accepted silently', async () => {
    const repl = createRepl();
    expect(await repl.exec('import java.util.Scanner;')).toBeUndefined();
  });

  it('error in one input does not break subsequent inputs', async () => {
    const repl = createRepl();
    await repl.exec('int x = 5;');
    // This should throw (undeclared variable), but REPL should recover
    try { await repl.exec('y + 1'); } catch { /* expected */ }
    // x should still be accessible
    expect(await repl.exec('x')).toBe('5');
  });

  it('variable declaration shows feedback', async () => {
    const repl = createRepl();
    const result = await repl.exec('int x = 42;');
    expect(result).toBe('x ==> 42');
  });

  it('multiple variable declarators show feedback', async () => {
    const repl = createRepl();
    const result = await repl.exec('int x = 1, y = 2;');
    expect(result).toBe('y ==> 2');
  });

  it('evaluates char literal', async () => {
    const repl = createRepl();
    expect(await repl.exec("'A'")).toBe('A');
  });

  it('evaluates ternary expression', async () => {
    const repl = createRepl();
    await repl.exec('int x = 10;');
    expect(await repl.exec('x > 5 ? "yes" : "no"')).toBe('yes');
  });

  it('while loop works', async () => {
    const repl = createRepl();
    await repl.exec('int i = 0;');
    await repl.exec('while (i < 3) { System.out.print(i); i++; }');
    expect(repl.getOutput()).toBe('012');
  });

  it('Math.PI evaluates to a double', async () => {
    const repl = createRepl();
    const result = await repl.exec('Math.PI');
    expect(result).toContain('3.14');
  });

  it('new expression returns object reference', async () => {
    const repl = createRepl();
    await repl.exec('ArrayList<Integer> nums = new ArrayList<>();');
    await repl.exec('nums.add(10);');
    await repl.exec('nums.add(20);');
    expect(await repl.exec('nums.get(1)')).toBe('20');
  });
});
