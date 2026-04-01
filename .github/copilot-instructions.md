# Java Runner — Copilot Instructions

## Project Overview

Client-side Java interpreter for CS1 education, bundled as a single IIFE script + CSS. Replaces `<div class="java">` elements with interactive CodeMirror 6 editors that parse and run Java code entirely in the browser.

## Build and Test

```bash
npm run build     # production build → dist/javarunner.js + dist/javarunner.css
npm run watch     # rebuild on changes
npm test          # vitest — 175 tests across test/{basics,collections,stdlib,programs}.test.ts
npm run test:watch # re-run tests on changes
```

TypeScript strict mode. Check types with `npx tsc --noEmit`.

## Architecture

- **Parser** (`src/parser/`): Uses `java-parser` (Chevrotain) to get a CST, then `converter.ts` transforms it into a custom AST defined in `ast.ts`. The CST is flat — binary expressions are arrays of operands/operators, not trees. `buildPrecedenceTree()` reconstructs precedence.
- **Interpreter** (`src/interpreter/`): Async tree-walking interpreter. `Environment` is a parent-chain scope. `ClassRegistry` stores class metadata and built-in method bindings. Step limit of 10M with periodic `setTimeout` yield every 10K steps.
- **Runtime** (`src/runtime/`): Each file registers built-in classes/methods on the ClassRegistry (System, Scanner, Math, ArrayList, HashMap, etc.). Follow existing patterns when adding new classes.
- **UI** (`src/ui/`): ConsolePanel (output + input), Editor (CodeMirror 6 wrapper), Widget (orchestrates toolbar + editor + console).
- **Entry** (`src/index.ts`): Auto-init on DOMContentLoaded, exports `JavaRunner.Widget` and `JavaRunner.init()`.

## Key Conventions

- AST nodes use a `kind` string discriminant and carry `pos: Position` for error reporting.
- Java values are `{ type: JavaTypeName, value: any }`. Use constructor functions: `makeInt()`, `makeString()`, `makeNull()`, etc.
- Control flow (return, break, continue) uses thrown signal objects, not return values.
- Java exceptions are `JavaException` objects with a `stackTrace` array.
- Built-in methods are registered as `BuiltInMethod: (thisObj, args, line) => Promise<JavaValue>`.
- The interpreter is async throughout — all `eval`/`exec` methods return Promises.

## Known Quirks (java-parser CST)

These were discovered during development and have corresponding fixes in `converter.ts`:

1. **Assignment in binaryExpression**: `x = expr` appears as a `binaryExpression` with an `AssignmentOperator` token child, not as a separate assignment node. Check for this before treating as binary op.
2. **Postfix operators**: `i++`/`i--` appear as `UnarySuffixOperator` children of `unaryExpression`, not a dedicated postfix node.
3. **Array initializer nesting**: `{1, 2, 3}` elements are under `arrayInitializer → variableInitializerList → variableInitializer[]`, not directly under `arrayInitializer`.
4. **Shift operators as comparison tokens**: `<<` appears as 2 `Less` tokens, `>>` as 2 `Greater` tokens, `>>>` as 3 `Greater` tokens — not as a single `BinaryOperator`. The converter detects adjacent tokens by position.
5. **Float literal token name**: Floating-point literals use the token name `FloatLiteral` (not `DecimalFloatingPointLiteral`), and integer hex/binary/octal use `HexLiteral`, `BinaryLiteral`, `OctalLiteral`.

## Adding a New Built-in Class

1. Create `src/runtime/yourclass.ts`
2. Export a `registerYourClass(interp: Interpreter)` function (add `io: InterpreterIO` if you need console I/O)
3. Use `interp.getRegistry()` to get the `ClassRegistry`, then call `registry.register()`, `registry.registerMethod()`, `registry.registerStaticMethod()`
4. Wire it in `src/ui/widget.ts` inside the `run()` method alongside other `register*()` calls
5. Follow patterns in existing runtime files (e.g., `math.ts` for static-only, `collections.ts` for instance classes)

## Style

- TypeScript strict mode, ES2020 target
- No semicolon preference in generated code — follow existing file style
- Minimal comments — code should be self-explanatory
- No over-engineering: only add features directly needed for CS1/CS2 curriculum
