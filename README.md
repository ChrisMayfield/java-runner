# java-runner

A client-side, in-browser Java editor and interpreter for CS1 education.
Drop a `<script>` tag into any HTML page, and `<script type="text/x-java">` elements become interactive editors with a Run button and console output.

**No server required** — parsing, interpretation, and I/O all happen in the browser.

## Quick Start

Include the built files in your HTML:

```html
<link rel="stylesheet" href="javarunner.css">
<script src="javarunner.js"></script>
```

Then write Java code inside `<script type="text/x-java">` elements:

```html
<script type="text/x-java">
System.out.println("Hello, World!");
int x = 5;
System.out.println("x is " + x);
</script>
```

The `<script>` tag with a non-JavaScript type is treated as raw text by the browser, so `<`, `>`, and `&` in Java code don't need escaping.
On page load, each element is replaced by an interactive CodeMirror 6 editor with Run, Stop, and Reset buttons and a console panel.

### Snippet Mode

Code doesn't need a class or `main` method — bare statements are automatically wrapped. Three levels of wrapping are detected:

- **Full program** — code contains a `class` declaration → parsed as-is
- **Methods only** — code contains method signatures but no class → wrapped in a `class Main { ... }`
- **Statements only** — bare statements → wrapped in `class Main { public static void main(String[] args) { ... } }`

Supported library classes (`Scanner`, `Random`, `ArrayList`, `HashMap`, etc.) are auto-imported.

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
npm run build
```

Output goes to `dist/`:

| File | Description |
|------|-------------|
| `javarunner.js` | IIFE bundle (~789 KB) |
| `javarunner.css` | Styles (~2.7 KB) |
| `javarunner.js.map` | Source map |

### Other Commands

```bash
npm run watch   # rebuild on file changes
npm test        # run tests (194 vitest tests)
```

## Demo

Open the following pages in a browser after building:

- `examples/programs.html` includes **full programs** showing Hello World, Scanner input, loops, collections, inheritance, exceptions, and recursion.
- `examples/snippets.html` demonstrates **snippet mode** (no class or main method needed) with eight examples that progress through common CS1 topics.

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # re-run on file changes
```

194 tests across five suites cover the interpreter end-to-end:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `basics.test.ts` | 81 | Variables, operators, control flow, arrays, strings, classes, inheritance, exceptions |
| `collections.test.ts` | 21 | ArrayList, HashMap, HashSet, Collections utilities |
| `stdlib.test.ts` | 48 | Math, Random, Arrays, wrapper classes, Scanner, printf/format, file I/O |
| `programs.test.ts` | 27 | Multi-class programs, recursion, polymorphism, interfaces |
| `snippets.test.ts` | 17 | Snippet mode: bare statements, auto-imports, method-level wrapping |

## Architecture

```
src/
├── parser/          # java-parser CST → custom AST
│   ├── ast.ts       # AST node type definitions
│   ├── converter.ts # CST-to-AST transformation
│   ├── index.ts     # parse() entry point
│   └── snippet.ts   # snippet wrapping (auto class/main/imports)
├── interpreter/     # async tree-walking interpreter
│   ├── types.ts     # JavaValue, JavaObject, JavaArray
│   ├── environment.ts # scoped Environment, ClassRegistry
│   ├── errors.ts    # exceptions, control flow signals
│   └── interpreter.ts # statement/expression evaluation
├── runtime/         # built-in Java standard library
│   ├── system.ts    # System.out, System.exit, String.format
│   ├── scanner.ts   # Scanner with interactive input
│   ├── math.ts      # Math class
│   ├── collections.ts # ArrayList, HashMap, HashSet, Collections
│   ├── wrappers.ts  # Integer, Double, Character, Boolean, etc.
│   ├── arrays.ts    # Arrays utility class
│   ├── random.ts    # Random class
│   └── fileio.ts    # Virtual filesystem, File, PrintWriter, BufferedReader
├── ui/              # browser UI components
│   ├── console.ts   # output/input panel
│   ├── editor.ts    # CodeMirror 6 wrapper
│   └── widget.ts    # orchestrator (toolbar + editor + console)
├── styles/
│   └── main.css     # CSS custom properties for theming
└── index.ts         # auto-init on DOMContentLoaded
```

The interpreter is **async** — `Scanner` input pauses execution with a `Promise` that resolves when the user submits a line, and a periodic `setTimeout` yield keeps the browser responsive.

## How It Works

1. **java-parser** (Chevrotain-based) produces a concrete syntax tree (CST)
2. A custom converter transforms the flat CST into a typed AST with proper operator precedence
3. An async tree-walking interpreter evaluates the AST, with built-in runtime classes registered on a `ClassRegistry`
4. The UI layer wires CodeMirror, the interpreter, and a console panel together

## Programmatic API

```js
// Auto-init happens on DOMContentLoaded, but you can also:
const widget = new JavaRunner.Widget(containerElement, javaSourceCode);
widget.run();

// Or re-initialize manually:
JavaRunner.init();
```

## Limitations

- Subset of Java — not a full JVM. Targets CS1/CS2 curriculum features.
- No generics type checking (collections work but types aren't enforced)
- No threads, packages, or annotations
- Bundle size is ~767 KB (mostly java-parser + CodeMirror)
- Numeric precision uses JavaScript `number` (64-bit float); `int` uses `| 0` truncation
