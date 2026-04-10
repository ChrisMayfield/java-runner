# java-runner

A client-side, in-browser Java editor and interpreter for CS education.
Drop a Java snippets into any HTML page:

- `<script type="text/x-java">` elements become interactive editors.
- `<script type="text/x-java-repl">` elements become interactive shells.

**No server required** — parsing, compiling, and I/O all run locally in the browser.

View the [Examples](https://chrismayfield.github.io/java-runner/) online.

## Quick Start

Include two files in your HTML:

```html
<link rel="stylesheet" href="javarunner.css">
<script src="javarunner.js"></script>
```

### Editor Mode

Embed Java code inside `<script type="text/x-java">` elements:

```html
<script type="text/x-java">
System.out.println("Hello, World!");
int x = 5;
System.out.println("x is " + x);
</script>
```

The `<script>` tag with a non-JavaScript type is treated as raw text by the browser, so `<`, `>`, and `&` in Java code don't need escaping.
On page load, each element is replaced by an interactive CodeMirror 6 editor with Run/Stop, Test, and Reset buttons.

Code doesn't need a class or `main()` method — bare statements are automatically wrapped. Three levels of wrapping are detected:

- **Full program** — code contains a `class` declaration → parsed as-is
- **Methods only** — code contains method signatures but no class → wrapped in a `class Main { ... }`
- **Statements only** — bare statements → wrapped in `class Main { public static void main(String[] args) { ... } }`

Supported library classes (`Scanner`, `Random`, `ArrayList`, etc.) are auto-imported.

### REPL Mode

For an interactive Java shell, use `<script type="text/x-java-repl">`:

```html
<script type="text/x-java-repl">
int x = 5;
int y = 10;
String name = "Alice";
</script>
```

Code inside the element is executed line-by-line to initialize the session.
Users can then type expressions, statements, or class declarations.
Variables persist across inputs, results are displayed automatically, and up/down arrows recall command history.

## Features

- **CodeMirror 6 editor** with Java syntax highlighting
- **Interactive console** — `Scanner(System.in)` prompts the user for input
- **CS1-level Java support:**
  - Classes, methods, constructors, inheritance, polymorphism
  - `if`/`else`, `for`, `while`, `do-while`, `switch`
  - Arrays (including initializers), `String` methods
  - `ArrayList`, `HashMap`, `HashSet`, `Collections`
  - `Math`, `Random`, `Arrays` utilities
  - Wrapper classes (`Integer`, `Double`, `Character`, etc.)
  - Exception handling (`try`/`catch`/`finally`, `throw`)
  - Virtual in-memory file I/O (`File`, `PrintWriter`, `BufferedReader`)
  - `System.out.printf` / `String.format`
- **Safety limits** — 10 million step limit prevents infinite loops; execution can be stopped mid-run

## Building from Source

```bash
npm install
npm run build       # build for distribution
npm run watch       # rebuild on file changes
```

Output goes to `dist/`:

| File | Description |
|------|-------------|
| `javarunner.css` | Styles (~5.0 KB) |
| `javarunner.js` | IIFE bundle (~793 KB) |
| `javarunner.js.map` | Source map (~3.5 MB) |

## Unit Tests

```bash
npm run test        # run all vitest tests
npm run test:watch  # rerun on file changes
```

262 tests across six suites cover the interpreter end-to-end:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `basics.test.ts` | 81 | Variables, operators, control flow, arrays, strings, classes, inheritance, exceptions |
| `collections.test.ts` | 21 | ArrayList, HashMap, HashSet, Collections utilities |
| `junit.test.ts` | 26 | @Test annotation, assert methods, test with exceptions |
| `programs.test.ts` | 27 | Multi-class programs, recursion, polymorphism, interfaces |
| `repl.test.ts` | 42 | REPL parser (expressions, statements, classes, imports) and execution (persistence, error recovery, collections) |
| `snippets.test.ts` | 17 | Snippet mode: bare statements, auto-imports, method-level wrapping |
| `stdlib.test.ts` | 48 | Math, Random, Arrays, wrapper classes, Scanner, printf/format, file I/O |

## Architecture

```
src/
├── parser/          # java-parser CST → custom AST
│   ├── ast.ts       # AST node type definitions
│   ├── converter.ts # CST-to-AST transformation
│   ├── index.ts     # parse() entry point, shared AUTO_IMPORTS
│   ├── repl.ts      # REPL input parser (expression/statement/class detection)
│   └── snippet.ts   # snippet wrapping (auto class/main/imports)
├── interpreter/     # async tree-walking interpreter
│   ├── environment.ts # scoped Environment, ClassRegistry
│   ├── errors.ts    # exceptions, control flow signals
│   ├── interpreter.ts # statement/expression evaluation
│   └── types.ts     # JavaValue, JavaObject, JavaArray
├── runtime/         # built-in Java standard library
│   ├── arrays.ts    # Arrays utility class
│   ├── collections.ts # ArrayList, HashMap, HashSet, Collections
│   ├── fileio.ts    # Virtual filesystem, File, PrintWriter, BufferedReader
│   ├── index.ts     # registerAll() barrel
│   ├── junit.ts     # JUnit framework
│   ├── math.ts      # Math class
│   ├── random.ts    # Random class
│   ├── scanner.ts   # Scanner with interactive input
│   ├── system.ts    # System.out, System.exit, String.format
│   └── wrappers.ts  # Integer, Double, Character, Boolean, etc.
├── styles/
│   └── main.css     # CSS custom properties for theming
├── ui/              # browser UI components
│   ├── console.ts   # output/input panel
│   ├── editor.ts    # CodeMirror 6 wrapper
│   ├── repl.ts      # interactive Java shell (REPL widget)
│   └── widget.ts    # orchestrator (toolbar + editor + console)
└── index.ts         # auto-init on DOMContentLoaded
```

### How It Works

The interpreter is **async** — `Scanner` input pauses execution with a `Promise` that resolves when the user submits a line, and a periodic `setTimeout` yield keeps the browser responsive.

1. **java-parser** (Chevrotain-based) produces a concrete syntax tree (CST)
2. A custom converter transforms the flat CST into a typed AST with proper operator precedence
3. An async tree-walking interpreter evaluates the AST, with built-in runtime classes registered on a `ClassRegistry`
4. The UI layer wires CodeMirror, the interpreter, and a console panel together

### Programmatic API

```js
// Auto-init happens on DOMContentLoaded, but you can also:
const widget = new JavaRunner.Widget(javaSourceCode);
widget.run();

// Create a REPL:
const repl = new JavaRunner.ReplWidget(initialCode);
document.body.appendChild(repl.element);

// Or re-initialize manually:
JavaRunner.init();
```

### Limitations

- Subset of Java — not a full JVM. Targets CS1/CS2 curriculum features.
- No generics type checking (collections work but types aren't enforced)
- No threads, packages, or annotations (except for @Test)
- Relatively large bundle size is mostly java-parser + CodeMirror
- Numeric precision uses JavaScript `number` (64-bit float); `int` uses `| 0` truncation
