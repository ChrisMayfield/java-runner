// REPL Widget: interactive Java shell

import { Interpreter, InterpreterIO } from '../interpreter/interpreter'
import { JavaValue, makeArray, makeString } from '../interpreter/types'
import { parseReplInput } from '../parser/repl'
import { registerAll } from '../runtime/index'
import {
  JavaException, StepLimitExceeded, ExecutionCancelled, RuntimeError,
  ReturnSignal, BreakSignal, ContinueSignal
} from '../interpreter/errors'
import { ParseError } from '../parser/index'
import { Environment } from '../interpreter/environment'

const PROMPT1 = 'repl> ';
const PROMPT2 = ' ...> ';

export class ReplWidget {
  readonly element: HTMLElement
  private outputEl: HTMLElement
  private inputLine: HTMLElement
  private promptEl: HTMLSpanElement
  private inputField: HTMLInputElement
  private interp: Interpreter
  private replEnv: Environment
  private history: string[] = []
  private historyIndex = -1
  private pendingLines: string[] = []
  private braceDepth = 0
  private parenDepth = 0

  constructor(initialCode: string) {
    // Build DOM
    this.element = document.createElement('div')
    this.element.className = 'jr-repl'

    this.outputEl = document.createElement('pre')
    this.outputEl.className = 'jr-repl-output'
    this.element.appendChild(this.outputEl)

    this.inputLine = document.createElement('div')
    this.inputLine.className = 'jr-repl-input-line'

    this.promptEl = document.createElement('span')
    this.promptEl.className = 'jr-repl-prompt'
    this.promptEl.textContent = PROMPT1

    this.inputField = document.createElement('input')
    this.inputField.type = 'text'
    this.inputField.className = 'jr-repl-input'
    this.inputField.autocomplete = 'off'
    this.inputField.spellcheck = false
    this.inputField.setAttribute('aria-label', 'REPL input')

    this.inputLine.appendChild(this.promptEl)
    this.inputLine.appendChild(this.inputField)
    this.element.appendChild(this.inputLine)

    // Create interpreter with IO wired to REPL output
    const io: InterpreterIO = {
      print: (text) => this.appendOutput(text),
      println: (text) => this.appendOutput(text + '\n'),
      requestInput: () => Promise.resolve(''),
    }

    this.interp = new Interpreter(io)
    this.replEnv = this.interp.getGlobalEnv().child()
    this.replEnv.define('__currentClass__', makeString('Main'))
    this.replEnv.define('args', makeArray('String', []))

    // Register runtime libraries
    registerAll(this.interp, io)

    // Events
    this.inputField.addEventListener('keydown', (e) => this.handleKeyDown(e))
    this.element.addEventListener('click', () => this.inputField.focus())

    // Execute initial code after DOM insertion
    if (initialCode.trim()) {
      setTimeout(() => this.executeInitialCode(initialCode), 0)
    }
  }

  private async executeInitialCode(code: string): Promise<void> {
    const lines = code.split('\n')
    const pending: string[] = []
    let braceDepth = 0
    let parenDepth = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed && pending.length === 0) continue

      pending.push(trimmed)
      const deltas = this.countDelimiters(trimmed)
      braceDepth += deltas.braces
      parenDepth += deltas.parens

      if (braceDepth <= 0 && parenDepth <= 0) {
        const fullInput = pending.join('\n')
        if (fullInput.trim()) {
          this.appendInputEcho(PROMPT1, pending[0])
          for (let i = 1; i < pending.length; i++) {
            this.appendInputEcho(PROMPT2, pending[i])
          }
          this.history.push(fullInput)
          this.historyIndex = this.history.length
          await this.executeInput(fullInput)
        }
        pending.length = 0
        braceDepth = 0
        parenDepth = 0
      }
    }

    // Execute any remaining accumulated lines
    if (pending.length > 0) {
      const fullInput = pending.join('\n')
      if (fullInput.trim()) {
        this.appendInputEcho(PROMPT1, pending[0])
        for (let i = 1; i < pending.length; i++) {
          this.appendInputEcho(PROMPT2, pending[i])
        }
        this.history.push(fullInput)
        this.historyIndex = this.history.length
        await this.executeInput(fullInput)
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.handleSubmit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.historyUp()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.historyDown()
    }
  }

  private handleSubmit(): void {
    const input = this.inputField.value
    this.inputField.value = ''

    // Echo the input
    const prompt = this.pendingLines.length === 0 ? PROMPT1 : PROMPT2
    this.appendInputEcho(prompt, input)

    // Accumulate for multi-line
    this.pendingLines.push(input)
    const deltas = this.countDelimiters(input)
    this.braceDepth += deltas.braces
    this.parenDepth += deltas.parens

    if (this.braceDepth > 0 || this.parenDepth > 0) {
      this.promptEl.textContent = PROMPT2
      return
    }

    // Complete input — execute
    const fullInput = this.pendingLines.join('\n')
    this.pendingLines = []
    this.braceDepth = 0
    this.parenDepth = 0
    this.promptEl.textContent = PROMPT1

    if (fullInput.trim()) {
      this.history.push(fullInput)
      this.historyIndex = this.history.length
      this.executeInput(fullInput)
    }
  }

  private countDelimiters(line: string): { braces: number, parens: number } {
    let braces = 0, parens = 0
    let inString = false, inChar = false, escape = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (escape) { escape = false; continue }
      if (ch === '\\' && (inString || inChar)) { escape = true; continue }
      if (ch === '"' && !inChar) { inString = !inString; continue }
      if (ch === "'" && !inString) { inChar = !inChar; continue }
      if (inString || inChar) continue
      // Line comment — stop processing
      if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') break
      if (ch === '{') braces++
      else if (ch === '}') braces--
      else if (ch === '(') parens++
      else if (ch === ')') parens--
    }
    return { braces, parens }
  }

  private async executeInput(input: string): Promise<void> {
    try {
      const result = parseReplInput(input)

      switch (result.kind) {
        case 'expression': {
          const val = await this.interp.evalReplExpression(result.expression, this.replEnv)
          if (val.type !== 'void') {
            const str = await this.interp.valueToString(val)
            this.appendResult(formatValue(val, str))
          }
          break
        }
        case 'statements': {
          for (const stmt of result.statements) {
            await this.interp.execReplStatement(stmt, this.replEnv)
            // Show values for variable declarations
            if (stmt.kind === 'VariableDeclarationStatement') {
              for (const decl of stmt.declarators) {
                const val = this.replEnv.get(decl.name)
                if (val.type !== 'void') {
                  const str = await this.interp.valueToString(val)
                  this.appendResult(`${decl.name} ==> ${formatValue(val, str)}`)
                }
              }
            }
          }
          break
        }
        case 'classes': {
          for (const cls of result.classes) {
            this.interp.registerUserClass(cls)
            await this.interp.initUserClassStaticFields(cls)
          }
          this.appendResult(`|  created class ${result.classes.map(c => c.name).join(', ')}`)
          break
        }
        case 'import': {
          // Auto-imports handle supported classes; silently accept
          break
        }
      }
    } catch (e: unknown) {
      if (e instanceof ReturnSignal) {
        if (e.value.type !== 'void') {
          const str = await this.interp.valueToString(e.value)
          this.appendResult(formatValue(e.value, str))
        }
      } else if (e instanceof BreakSignal || e instanceof ContinueSignal) {
        this.appendError('|  Error: break/continue cannot be used outside a loop')
      } else if (e instanceof ExecutionCancelled) {
        this.appendError('|  Execution cancelled')
      } else if (e instanceof StepLimitExceeded) {
        this.appendError('|  Error: Step limit exceeded (possible infinite loop)')
      } else if (e instanceof JavaException) {
        let msg = `|  Exception ${e.getTypeName()}: ${e.message}`
        if (e.line) msg += ` (line ${e.line})`
        this.appendError(msg)
      } else if (e instanceof ParseError) {
        this.appendError(`|  Error: ${e.message}`)
      } else if (e instanceof RuntimeError) {
        this.appendError(`|  Error: ${e.message}`)
      } else if (e instanceof Error) {
        this.appendError(`|  Error: ${e.message}`)
      }
    }
    this.scrollToBottom()
  }

  private appendOutput(text: string): void {
    this.outputEl.appendChild(document.createTextNode(text))
    this.scrollToBottom()
  }

  private appendInputEcho(prompt: string, text: string): void {
    const promptSpan = document.createElement('span')
    promptSpan.className = 'jr-repl-prompt'
    promptSpan.textContent = prompt
    const echoSpan = document.createElement('span')
    echoSpan.className = 'jr-repl-echo'
    echoSpan.textContent = text + '\n'
    this.outputEl.appendChild(promptSpan)
    this.outputEl.appendChild(echoSpan)
  }

  private appendResult(text: string): void {
    this.outputEl.appendChild(document.createTextNode(text + '\n'))
  }

  private appendError(text: string): void {
    const span = document.createElement('span')
    span.className = 'jr-repl-error'
    span.textContent = text + '\n'
    this.outputEl.appendChild(span)
  }

  private scrollToBottom(): void {
    this.element.scrollTop = this.element.scrollHeight
  }

  private historyUp(): void {
    if (this.history.length === 0) return
    if (this.historyIndex > 0) {
      this.historyIndex--
    }
    this.inputField.value = this.history[this.historyIndex] || ''
  }

  private historyDown(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      this.inputField.value = this.history[this.historyIndex]
    } else {
      this.historyIndex = this.history.length
      this.inputField.value = ''
    }
  }
}

function formatValue(val: JavaValue, str: string): string {
  if (val.type === 'String') return `"${str}"`
  if (val.type === 'char') return `'${str}'`
  return str
}
