// Core async tree-walking Java interpreter

import {
  CompilationUnit, ClassDeclaration, Statement, Expression,
  MethodDeclaration, ConstructorDeclaration, FieldDeclaration,
  BlockStatement, VariableDeclarationStatement, ExpressionStatement,
  IfStatement, ForStatement, EnhancedForStatement, WhileStatement,
  DoWhileStatement, SwitchStatement, TryStatement, ReturnStatement,
  ThrowStatement, BinaryExpression, UnaryExpression, PostfixExpression,
  AssignmentExpression, MethodCallExpression, FieldAccessExpression,
  ArrayAccessExpression, NewExpression, NewArrayExpression, CastExpression,
  InstanceofExpression, ConditionalExpression, LiteralExpression,
  IdentifierExpression, ArrayInitializerExpression, ParenExpression,
  TypeNode, Parameter, VariableDeclarator
} from '../parser/ast';
import {
  JavaValue, JavaObject, JavaArray, JavaTypeName,
  makeInt, makeLong, makeFloat, makeDouble, makeChar, makeBool, makeString,
  makeNull, makeObject, makeArray, NULL_VAL, VOID, TRUE, FALSE,
  isNull, asJavaObject, asJavaArray, toNumber, toJavaString, castNumeric,
  isPrimitive, isNumeric, isIntegral, promoteNumeric, defaultValue, typeNodeToName,
  resetIds
} from './types';
import { Environment, ClassRegistry, ClassInfo, BuiltInMethod } from './environment';
import {
  ReturnSignal, BreakSignal, ContinueSignal, JavaException,
  RuntimeError, StepLimitExceeded, ExecutionCancelled,
  nullPointerException, arrayIndexOutOfBounds, arithmeticException,
  classCastException, makeJavaException, stackOverflowError,
  StackFrame
} from './errors';

export interface InterpreterIO {
  print(text: string): void;
  println(text: string): void;
  requestInput(prompt?: string): Promise<string>;
}

export interface InterpreterOptions {
  stepLimit?: number;
  callDepthLimit?: number;
}

export class Interpreter {
  private registry: ClassRegistry = new ClassRegistry();
  private globalEnv: Environment = new Environment();
  private steps = 0;
  private callDepth = 0;
  private stepLimit: number;
  private callDepthLimit: number;
  private stackTrace: StackFrame[] = [];
  public cancelled = false;

  constructor(
    private io: InterpreterIO,
    private options: InterpreterOptions = {}
  ) {
    this.stepLimit = options.stepLimit ?? 10_000_000;
    this.callDepthLimit = options.callDepthLimit ?? 256;
  }

  async run(ast: CompilationUnit): Promise<void> {
    this.steps = 0;
    this.callDepth = 0;
    this.cancelled = false;
    this.stackTrace = [];
    resetIds();

    // Phase 1: Register all user-defined classes
    for (const cls of ast.classes) {
      this.registerClass(cls);
    }

    // Phase 2: Find and run main()
    let mainClass: ClassInfo | undefined;
    let mainMethod: MethodDeclaration | undefined;

    for (const cls of ast.classes) {
      const info = this.registry.get(cls.name);
      if (info) {
        const main = info.methods.find(
          m => m.name === 'main' &&
               m.modifiers.includes('static') &&
               m.modifiers.includes('public')
        );
        if (main) {
          mainClass = info;
          mainMethod = main;
          break;
        }
      }
    }

    if (!mainMethod || !mainClass) {
      throw new RuntimeError('No public static void main(String[] args) method found');
    }

    // Phase 3: Initialize static fields
    for (const cls of ast.classes) {
      const info = this.registry.get(cls.name);
      if (info) {
        await this.initializeStaticFields(info);
      }
    }

    // Phase 4: Execute main
    const mainEnv = this.globalEnv.child();
    // Create String[] args (empty)
    mainEnv.define('args', makeArray('String', []));
    mainEnv.define('__currentClass__', makeString(mainClass.name));

    this.stackTrace.push({ className: mainClass.name, methodName: 'main', line: mainMethod.pos.line });
    try {
      await this.execBlock(mainMethod.body!, mainEnv);
    } catch (e) {
      if (e instanceof ReturnSignal) return; // main returned
      throw e;
    } finally {
      this.stackTrace.pop();
    }
  }

  private registerClass(cls: ClassDeclaration): void {
    const fields: FieldDeclaration[] = [];
    const methods: MethodDeclaration[] = [];
    const constructors: ConstructorDeclaration[] = [];
    const innerClasses: ClassInfo[] = [];

    for (const member of cls.members) {
      switch (member.kind) {
        case 'FieldDeclaration': fields.push(member); break;
        case 'MethodDeclaration': methods.push(member); break;
        case 'ConstructorDeclaration': constructors.push(member); break;
        case 'ClassDeclaration':
          this.registerClass(member);
          innerClasses.push(this.registry.get(member.name)!);
          break;
      }
    }

    this.registry.register({
      name: cls.name,
      superClass: cls.superClass,
      interfaces: cls.interfaces,
      fields,
      methods,
      constructors,
      modifiers: cls.modifiers,
      isBuiltIn: false,
      innerClasses,
    });
  }

  private async initializeStaticFields(info: ClassInfo): Promise<void> {
    for (const field of info.fields) {
      if (field.modifiers.includes('static')) {
        for (const decl of field.declarators) {
          const val = decl.initializer
            ? await this.evalExpr(decl.initializer, this.globalEnv)
            : defaultValue(field.type);
          const isFinal = field.modifiers.includes('final');
          this.globalEnv.define(`${info.name}.${decl.name}`, val, isFinal);
        }
      }
    }
  }

  // ============================================================
  // Statement execution
  // ============================================================

  private async execBlock(block: BlockStatement, env: Environment): Promise<void> {
    for (const stmt of block.statements) {
      await this.execStmt(stmt, env);
    }
  }

  private async execStmt(stmt: Statement, env: Environment): Promise<void> {
    await this.checkStep();

    switch (stmt.kind) {
      case 'BlockStatement':
        await this.execBlock(stmt, env.child());
        break;

      case 'VariableDeclarationStatement':
        await this.execVarDecl(stmt, env);
        break;

      case 'ExpressionStatement':
        await this.evalExpr(stmt.expression, env);
        break;

      case 'IfStatement':
        await this.execIf(stmt, env);
        break;

      case 'ForStatement':
        await this.execFor(stmt, env);
        break;

      case 'EnhancedForStatement':
        await this.execEnhancedFor(stmt, env);
        break;

      case 'WhileStatement':
        await this.execWhile(stmt, env);
        break;

      case 'DoWhileStatement':
        await this.execDoWhile(stmt, env);
        break;

      case 'SwitchStatement':
        await this.execSwitch(stmt, env);
        break;

      case 'TryStatement':
        await this.execTry(stmt, env);
        break;

      case 'ReturnStatement':
        if (stmt.value) {
          const val = await this.evalExpr(stmt.value, env);
          throw new ReturnSignal(val);
        }
        throw new ReturnSignal(VOID);

      case 'BreakStatement':
        throw new BreakSignal();

      case 'ContinueStatement':
        throw new ContinueSignal();

      case 'ThrowStatement': {
        const val = await this.evalExpr(stmt.expression, env);
        const msg = isNull(val) ? 'null' : this.getExceptionMessage(val);
        throw new JavaException(val, msg, stmt.pos.line, [...this.stackTrace]);
      }

      case 'EmptyStatement':
        break;
    }
  }

  private getExceptionMessage(val: JavaValue): string {
    if (isNull(val)) return 'null';
    if (val.value && typeof val.value === 'object' && 'fields' in val.value) {
      const obj = val.value as JavaObject;
      const msg = obj.fields.get('message');
      if (msg && msg.type === 'String') return msg.value as string;
    }
    return toJavaString(val);
  }

  private async execVarDecl(stmt: VariableDeclarationStatement, env: Environment): Promise<void> {
    const isFinal = stmt.modifiers.includes('final');
    const declaredType = typeNodeToName(stmt.type);
    for (const decl of stmt.declarators) {
      let val: JavaValue;
      if (decl.initializer) {
        val = await this.evalExpr(decl.initializer, env);
        // Widening: int → double/float
        if ((declaredType === 'double' || declaredType === 'float') && isIntegral(val.type)) {
          val = { type: declaredType as any, value: val.value as number };
        }
      } else {
        val = defaultValue(stmt.type);
      }
      env.define(decl.name, val, isFinal);
    }
  }

  private async execIf(stmt: IfStatement, env: Environment): Promise<void> {
    const cond = await this.evalExpr(stmt.condition, env);
    if (this.isTruthy(cond)) {
      await this.execStmt(stmt.thenBranch, env.child());
    } else if (stmt.elseBranch) {
      await this.execStmt(stmt.elseBranch, env.child());
    }
  }

  private async execFor(stmt: ForStatement, env: Environment): Promise<void> {
    const loopEnv = env.child();

    // Init
    if (stmt.init) {
      for (const init of stmt.init) {
        if ('kind' in init && init.kind === 'VariableDeclarationStatement') {
          await this.execVarDecl(init as VariableDeclarationStatement, loopEnv);
        } else {
          await this.evalExpr(init as Expression, loopEnv);
        }
      }
    }

    // Loop
    while (true) {
      if (stmt.condition) {
        const cond = await this.evalExpr(stmt.condition, loopEnv);
        if (!this.isTruthy(cond)) break;
      }

      try {
        await this.execStmt(stmt.body, loopEnv.child());
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) { /* fall through to update */ }
        else throw e;
      }

      // Update
      for (const upd of stmt.update) {
        await this.evalExpr(upd, loopEnv);
      }
    }
  }

  private async execEnhancedFor(stmt: EnhancedForStatement, env: Environment): Promise<void> {
    const iterable = await this.evalExpr(stmt.iterable, env);

    if (iterable.type === 'array') {
      const arr = asJavaArray(iterable);
      for (const elem of arr.elements) {
        const loopEnv = env.child();
        loopEnv.define(stmt.name, elem);
        try {
          await this.execStmt(stmt.body, loopEnv);
        } catch (e) {
          if (e instanceof BreakSignal) break;
          if (e instanceof ContinueSignal) continue;
          throw e;
        }
      }
    } else if (iterable.value && typeof iterable.value === 'object' && 'nativeObj' in iterable.value) {
      // Built-in collection (ArrayList, etc.)
      const obj = iterable.value as JavaObject;
      const nativeObj = obj.nativeObj;
      if (Array.isArray(nativeObj)) {
        for (const elem of nativeObj) {
          const loopEnv = env.child();
          loopEnv.define(stmt.name, elem);
          try {
            await this.execStmt(stmt.body, loopEnv);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
      } else if (nativeObj instanceof Map) {
        // Iterating over Map entries, keySet, values etc. depends on the actual type
        // For keySet/values iteration
        for (const elem of nativeObj.values()) {
          const loopEnv = env.child();
          loopEnv.define(stmt.name, elem);
          try {
            await this.execStmt(stmt.body, loopEnv);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
      } else if (nativeObj instanceof Set) {
        for (const elem of nativeObj) {
          const loopEnv = env.child();
          loopEnv.define(stmt.name, elem);
          try {
            await this.execStmt(stmt.body, loopEnv);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
      }
    }
  }

  private async execWhile(stmt: WhileStatement, env: Environment): Promise<void> {
    while (true) {
      const cond = await this.evalExpr(stmt.condition, env);
      if (!this.isTruthy(cond)) break;
      try {
        await this.execStmt(stmt.body, env.child());
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
  }

  private async execDoWhile(stmt: DoWhileStatement, env: Environment): Promise<void> {
    do {
      try {
        await this.execStmt(stmt.body, env.child());
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) { /* check condition */ }
        else throw e;
      }
      const cond = await this.evalExpr(stmt.condition, env);
      if (!this.isTruthy(cond)) break;
    } while (true); // eslint-disable-line no-constant-condition
  }

  private async execSwitch(stmt: SwitchStatement, env: Environment): Promise<void> {
    const switchVal = await this.evalExpr(stmt.expression, env);
    let matched = false;

    try {
      for (const sc of stmt.cases) {
        if (!matched) {
          for (const label of sc.labels) {
            if (label === 'default') {
              matched = true;
              break;
            }
            const labelVal = await this.evalExpr(label, env);
            if (this.valuesEqual(switchVal, labelVal)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          for (const s of sc.statements) {
            await this.execStmt(s, env);
          }
        }
      }
    } catch (e) {
      if (e instanceof BreakSignal) return;
      throw e;
    }
  }

  private async execTry(stmt: TryStatement, env: Environment): Promise<void> {
    try {
      await this.execBlock(stmt.block, env.child());
    } catch (e) {
      if (e instanceof JavaException) {
        let caught = false;
        for (const cc of stmt.catches) {
          if (this.exceptionMatches(e, cc.types)) {
            const catchEnv = env.child();
            catchEnv.define(cc.name, e.exceptionObject);
            try {
              await this.execBlock(cc.body, catchEnv);
            } catch (innerE) {
              if (stmt.finallyBlock) {
                await this.execBlock(stmt.finallyBlock, env.child());
              }
              throw innerE;
            }
            caught = true;
            break;
          }
        }
        if (!caught) {
          if (stmt.finallyBlock) {
            await this.execBlock(stmt.finallyBlock, env.child());
          }
          throw e;
        }
      } else {
        if (stmt.finallyBlock) {
          await this.execBlock(stmt.finallyBlock, env.child());
        }
        throw e;
      }
    }
    if (stmt.finallyBlock) {
      await this.execBlock(stmt.finallyBlock, env.child());
    }
  }

  private exceptionMatches(e: JavaException, types: string[]): boolean {
    const exType = e.getTypeName();
    for (const t of types) {
      if (t === 'Exception' || t === 'Throwable' || t === 'RuntimeException') return true;
      if (exType === t) return true;
      if (this.registry.isAssignableTo(exType, t)) return true;
    }
    return false;
  }

  // ============================================================
  // Expression evaluation
  // ============================================================

  async evalExpr(expr: Expression, env: Environment): Promise<JavaValue> {
    await this.checkStep();

    switch (expr.kind) {
      case 'LiteralExpression':
        return this.evalLiteral(expr);

      case 'IdentifierExpression':
        return this.evalIdentifier(expr, env);

      case 'BinaryExpression':
        return this.evalBinary(expr, env);

      case 'UnaryExpression':
        return this.evalUnary(expr, env);

      case 'PostfixExpression':
        return this.evalPostfix(expr, env);

      case 'AssignmentExpression':
        return this.evalAssignment(expr, env);

      case 'MethodCallExpression':
        return this.evalMethodCall(expr, env);

      case 'FieldAccessExpression':
        return this.evalFieldAccess(expr, env);

      case 'ArrayAccessExpression':
        return this.evalArrayAccess(expr, env);

      case 'NewExpression':
        return this.evalNew(expr, env);

      case 'NewArrayExpression':
        return this.evalNewArray(expr, env);

      case 'CastExpression':
        return this.evalCast(expr, env);

      case 'InstanceofExpression':
        return this.evalInstanceof(expr, env);

      case 'ConditionalExpression':
        return this.evalConditional(expr, env);

      case 'ThisExpression':
        return env.get('this');

      case 'SuperExpression':
        return env.get('this'); // super refers to same object, dispatch differs

      case 'ArrayInitializerExpression':
        return this.evalArrayInitializer(expr, env);

      case 'ParenExpression':
        return this.evalExpr(expr.expression, env);
    }
  }

  private evalLiteral(expr: LiteralExpression): JavaValue {
    switch (expr.type) {
      case 'int': return makeInt(expr.value as number);
      case 'long': return makeLong(expr.value as number);
      case 'float': return makeFloat(expr.value as number);
      case 'double': return makeDouble(expr.value as number);
      case 'char': return makeChar(expr.value as string);
      case 'string': return makeString(expr.value as string);
      case 'boolean': return makeBool(expr.value as boolean);
      case 'null': return NULL_VAL;
    }
  }

  private evalIdentifier(expr: IdentifierExpression, env: Environment): JavaValue {
    // First try local variable
    if (env.has(expr.name)) {
      return env.get(expr.name);
    }

    // Try as an instance field on 'this'
    if (env.has('this')) {
      const thisObj = env.get('this');
      if (thisObj.value && typeof thisObj.value === 'object' && 'fields' in thisObj.value) {
        const obj = thisObj.value as JavaObject;
        if (obj.fields.has(expr.name)) {
          return obj.fields.get(expr.name)!;
        }
      }
    }

    // Try as a static field of the current class
    if (env.has('__currentClass__')) {
      const cls = toJavaString(env.get('__currentClass__'));
      const key = `${cls}.${expr.name}`;
      if (this.globalEnv.has(key)) {
        return this.globalEnv.get(key);
      }
    }

    // Try as a class name (for static access) — return a marker
    if (this.registry.has(expr.name)) {
      return { type: expr.name, value: { __classRef: expr.name } };
    }

    // Check if it's a built-in class name
    const builtIns = ['System', 'Math', 'Integer', 'Double', 'Character', 'Boolean', 'String', 'Arrays', 'Collections'];
    if (builtIns.includes(expr.name)) {
      return { type: expr.name, value: { __classRef: expr.name } };
    }

    throw new RuntimeError(`Variable '${expr.name}' is not defined`, expr.pos.line);
  }

  private async evalBinary(expr: BinaryExpression, env: Environment): Promise<JavaValue> {
    // Short-circuit for && and ||
    if (expr.operator === '&&') {
      const left = await this.evalExpr(expr.left, env);
      if (!this.isTruthy(left)) return FALSE;
      const right = await this.evalExpr(expr.right, env);
      return makeBool(this.isTruthy(right));
    }
    if (expr.operator === '||') {
      const left = await this.evalExpr(expr.left, env);
      if (this.isTruthy(left)) return TRUE;
      const right = await this.evalExpr(expr.right, env);
      return makeBool(this.isTruthy(right));
    }

    const left = await this.evalExpr(expr.left, env);
    const right = await this.evalExpr(expr.right, env);

    // String concatenation
    if (expr.operator === '+' && (left.type === 'String' || right.type === 'String')) {
      const ls = await this.valueToString(left);
      const rs = await this.valueToString(right);
      return makeString(ls + rs);
    }

    // Numeric operations
    if (isNumeric(left.type) && isNumeric(right.type)) {
      return this.evalNumericBinary(expr.operator, left, right, expr.pos.line);
    }

    // Boolean operations
    if (left.type === 'boolean' && right.type === 'boolean') {
      const lb = left.value as boolean;
      const rb = right.value as boolean;
      switch (expr.operator) {
        case '==': return makeBool(lb === rb);
        case '!=': return makeBool(lb !== rb);
        case '&': return makeBool(lb && rb);
        case '|': return makeBool(lb || rb);
        case '^': return makeBool(lb !== rb);
      }
    }

    // Reference equality
    if (expr.operator === '==' || expr.operator === '!=') {
      const eq = this.referenceEquals(left, right);
      return makeBool(expr.operator === '==' ? eq : !eq);
    }

    throw new RuntimeError(`Unsupported operation: ${left.type} ${expr.operator} ${right.type}`, expr.pos.line);
  }

  private evalNumericBinary(op: string, left: JavaValue, right: JavaValue, line: number): JavaValue {
    const lv = toNumber(left);
    const rv = toNumber(right);
    const resultType = promoteNumeric(left.type, right.type);
    const isInt = isIntegral(resultType);

    switch (op) {
      case '+': return isInt ? makeInt(lv + rv) : this.makeNumeric(resultType, lv + rv);
      case '-': return isInt ? makeInt(lv - rv) : this.makeNumeric(resultType, lv - rv);
      case '*': return isInt ? makeInt(lv * rv) : this.makeNumeric(resultType, lv * rv);
      case '/':
        if (rv === 0) {
          if (isInt) throw arithmeticException(line, '/ by zero');
          return this.makeNumeric(resultType, lv / rv); // Infinity or NaN for floating point
        }
        return isInt ? makeInt(Math.trunc(lv / rv)) : this.makeNumeric(resultType, lv / rv);
      case '%':
        if (rv === 0 && isInt) throw arithmeticException(line, '/ by zero');
        return isInt ? makeInt(lv % rv) : this.makeNumeric(resultType, lv % rv);
      case '<<': return makeInt(lv << rv);
      case '>>': return makeInt(lv >> rv);
      case '>>>': return makeInt(lv >>> rv);
      case '&': return makeInt(lv & rv);
      case '|': return makeInt(lv | rv);
      case '^': return makeInt(lv ^ rv);
      case '<': return makeBool(lv < rv);
      case '>': return makeBool(lv > rv);
      case '<=': return makeBool(lv <= rv);
      case '>=': return makeBool(lv >= rv);
      case '==': return makeBool(lv === rv);
      case '!=': return makeBool(lv !== rv);
    }
    throw new RuntimeError(`Unsupported numeric operator: ${op}`, line);
  }

  private makeNumeric(type: JavaTypeName, value: number): JavaValue {
    switch (type) {
      case 'double': return makeDouble(value);
      case 'float': return makeFloat(value);
      case 'long': return makeLong(value);
      default: return makeInt(value);
    }
  }

  private async evalUnary(expr: UnaryExpression, env: Environment): Promise<JavaValue> {
    if (expr.operator === '++' || expr.operator === '--') {
      // Prefix increment/decrement
      const val = await this.evalExpr(expr.operand, env);
      const n = toNumber(val);
      const newVal = expr.operator === '++' ? n + 1 : n - 1;
      const result = isIntegral(val.type) ? makeInt(newVal) : this.makeNumeric(val.type, newVal);
      await this.assignTo(expr.operand, result, env);
      return result;
    }

    const val = await this.evalExpr(expr.operand, env);
    switch (expr.operator) {
      case '-': {
        const n = toNumber(val);
        return isIntegral(val.type) ? makeInt(-n) : this.makeNumeric(val.type, -n);
      }
      case '+': return val;
      case '!': return makeBool(!this.isTruthy(val));
      case '~': return makeInt(~toNumber(val));
    }
    throw new RuntimeError(`Unsupported unary operator: ${expr.operator}`, expr.pos.line);
  }

  private async evalPostfix(expr: PostfixExpression, env: Environment): Promise<JavaValue> {
    const val = await this.evalExpr(expr.operand, env);
    const n = toNumber(val);
    const newVal = expr.operator === '++' ? n + 1 : n - 1;
    const result = isIntegral(val.type) ? makeInt(newVal) : this.makeNumeric(val.type, newVal);
    await this.assignTo(expr.operand, result, env);
    return val; // Return old value for postfix
  }

  private async evalAssignment(expr: AssignmentExpression, env: Environment): Promise<JavaValue> {
    const newValue = await this.evalExpr(expr.value, env);

    if (expr.operator === '=') {
      await this.assignTo(expr.target, newValue, env);
      return newValue;
    }

    // Compound assignment: +=, -=, *=, /=, %=, etc.
    const oldValue = await this.evalExpr(expr.target, env);
    const baseOp = expr.operator.slice(0, -1); // '+=' → '+'

    // String +=
    if (baseOp === '+' && (oldValue.type === 'String' || newValue.type === 'String')) {
      const result = makeString(await this.valueToString(oldValue) + await this.valueToString(newValue));
      await this.assignTo(expr.target, result, env);
      return result;
    }

    if (isNumeric(oldValue.type) && isNumeric(newValue.type)) {
      const result = this.evalNumericBinary(baseOp, oldValue, newValue, expr.pos.line);
      // Compound assignment narrows back to target type
      const narrowed = isIntegral(oldValue.type) && result.type !== oldValue.type
        ? castNumeric(result, oldValue.type)
        : result;
      await this.assignTo(expr.target, narrowed, env);
      return narrowed;
    }

    throw new RuntimeError(`Cannot apply ${expr.operator} to ${oldValue.type}`, expr.pos.line);
  }

  private async assignTo(target: Expression, value: JavaValue, env: Environment): Promise<void> {
    if (target.kind === 'IdentifierExpression') {
      // Try environment first
      if (env.has(target.name)) {
        env.set(target.name, value);
        return;
      }
      // Fall back to static field of current class (check before instance fields
      // so that `count++` on a static field doesn't accidentally create an instance field)
      if (env.has('__currentClass__')) {
        const cls = toJavaString(env.get('__currentClass__'));
        const key = `${cls}.${target.name}`;
        if (this.globalEnv.has(key)) {
          this.globalEnv.set(key, value);
          return;
        }
      }
      // Fall back to field on 'this'
      if (env.has('this')) {
        const thisObj = env.get('this');
        if (thisObj.value && typeof thisObj.value === 'object' && 'fields' in thisObj.value) {
          const obj = thisObj.value as JavaObject;
          if (obj.fields.has(target.name)) {
            obj.fields.set(target.name, value);
            return;
          }
        }
      }
      env.set(target.name, value); // will throw if not found
    } else if (target.kind === 'FieldAccessExpression') {
      const obj = await this.evalExpr(target.object, env);
      if (isNull(obj)) throw nullPointerException(target.pos.line);

      // Static field
      if (obj.value && typeof obj.value === 'object' && '__classRef' in obj.value) {
        const className = obj.value.__classRef as string;
        this.globalEnv.set(`${className}.${target.fieldName}`, value);
        return;
      }

      const jObj = asJavaObject(obj);
      jObj.fields.set(target.fieldName, value);
    } else if (target.kind === 'ArrayAccessExpression') {
      const arr = await this.evalExpr(target.array, env);
      if (isNull(arr)) throw nullPointerException(target.pos.line);
      const jArr = asJavaArray(arr);
      const idx = toNumber(await this.evalExpr(target.index, env));
      if (idx < 0 || idx >= jArr.elements.length) {
        throw arrayIndexOutOfBounds(target.pos.line, idx, jArr.elements.length);
      }
      jArr.elements[idx] = value;
    }
  }

  private async evalMethodCall(expr: MethodCallExpression, env: Environment): Promise<JavaValue> {
    // Special case: this() and super() constructor calls
    if (expr.methodName === 'this' || expr.methodName === 'super') {
      const thisObj = env.get('this');
      const args = await this.evalArgs(expr.args, env);
      let className: string;
      if (expr.methodName === 'super') {
        // Use the current class context (set in callConstructor) instead of thisObj.className
        const currentClass = env.has('__currentClass__')
          ? toJavaString(env.get('__currentClass__'))
          : asJavaObject(thisObj).className;
        className = this.registry.get(currentClass)?.superClass || 'Object';
      } else {
        className = asJavaObject(thisObj).className;
      }
      await this.callConstructor(className, thisObj, args, expr.pos.line);
      return VOID;
    }

    let obj: JavaValue | null = null;
    let className: string | null = null;
    let methodName = expr.methodName;

    if (expr.object) {
      obj = await this.evalExpr(expr.object, env);

      // Check for class reference (static call)
      if (obj.value && typeof obj.value === 'object' && '__classRef' in obj.value) {
        className = obj.value.__classRef as string;
        obj = null;
      } else if (isNull(obj)) {
        throw nullPointerException(expr.pos.line, `Cannot call method '${methodName}' on null`);
      }
    }

    // Evaluate arguments
    const args = await this.evalArgs(expr.args, env);

    // --- Dispatch ---

    // 1. String methods
    if (obj && obj.type === 'String') {
      return this.callStringMethod(obj, methodName, args, expr.pos.line);
    }

    // 2. Array .length is a field not method, but handle here for .clone()
    if (obj && obj.type === 'array' && methodName === 'clone') {
      const arr = asJavaArray(obj);
      return makeArray(arr.elementType, [...arr.elements]);
    }

    // 3. Built-in static methods
    if (className) {
      const builtIn = this.registry.getBuiltInStaticMethod(className, methodName);
      if (builtIn) return builtIn(null, args, expr.pos.line);

      // User-defined static method
      const info = this.registry.get(className);
      if (info) {
        const method = this.findMethod(info, methodName, args, true);
        if (method) return this.callUserMethod(method, null, className, args, env, expr.pos.line);
      }

      throw new RuntimeError(`No static method '${methodName}' in class '${className}'`, expr.pos.line);
    }

    // 4. Built-in instance methods
    if (obj) {
      const objClassName = this.getClassName(obj);

      // User-defined instance method (virtual dispatch) — checked first so user
      // overrides (e.g. toString) take priority over built-in Object methods.
      const info = this.registry.get(objClassName);
      if (info) {
        const method = this.findMethodVirtual(objClassName, methodName, args);
        if (method) return this.callUserMethod(method.method, obj, method.className, args, env, expr.pos.line);
      }

      // Built-in instance methods
      const builtIn = this.registry.getBuiltInMethod(objClassName, methodName);
      if (builtIn) return builtIn(obj, args, expr.pos.line);

      // toString, equals, hashCode for any object
      if (methodName === 'toString') return makeString(toJavaString(obj));
      if (methodName === 'equals') return makeBool(this.valuesEqual(obj, args[0]));
      if (methodName === 'hashCode') {
        if (obj.value && 'id' in obj.value) return makeInt((obj.value as any).id);
        return makeInt(0);
      }
      if (methodName === 'getClass') return makeString(objClassName);

      throw new RuntimeError(`No method '${methodName}' in class '${objClassName}'`, expr.pos.line);
    }

    // 5. Standalone method call (same class)
    // Look in the current class first, then all user classes
    const currentClassName = env.has('__currentClass__') ? toJavaString(env.get('__currentClass__')) : null;
    if (currentClassName) {
      const info = this.registry.get(currentClassName);
      if (info) {
        const method = this.findMethod(info, methodName, args, true);
        if (method) return this.callUserMethod(method, null, currentClassName, args, env, expr.pos.line);
        // Also check non-static methods
        const instanceMethod = this.findMethod(info, methodName, args, false);
        if (instanceMethod && env.has('this')) {
          return this.callUserMethod(instanceMethod, env.get('this'), currentClassName, args, env, expr.pos.line);
        }
      }
    }
    for (const cls of this.registry['classes'].values()) {
      const method = this.findMethod(cls, methodName, args, true);
      if (method) {
        return this.callUserMethod(method, null, cls.name, args, env, expr.pos.line);
      }
    }

    // 6. Try as instance method on current 'this'
    if (env.has('this')) {
      const thisObj = env.get('this');
      const objClassName = this.getClassName(thisObj);
      const result = this.findMethodVirtual(objClassName, methodName, args);
      if (result) return this.callUserMethod(result.method, thisObj, result.className, args, env, expr.pos.line);
    }

    throw new RuntimeError(`Method '${methodName}' not found`, expr.pos.line);
  }

  private async evalArgs(exprs: Expression[], env: Environment): Promise<JavaValue[]> {
    const args: JavaValue[] = [];
    for (const e of exprs) {
      args.push(await this.evalExpr(e, env));
    }
    return args;
  }

  private findMethod(info: ClassInfo, name: string, args: JavaValue[], isStatic: boolean): MethodDeclaration | undefined {
    return info.methods.find(m => {
      if (m.name !== name) return false;
      if (isStatic && !m.modifiers.includes('static')) return false;
      if (!isStatic && m.modifiers.includes('static')) return false;
      // Basic arity check (don't do full overload resolution for CS1)
      if (m.parameters.length !== args.length) {
        // Check for varargs
        if (m.parameters.length > 0 && m.parameters[m.parameters.length - 1].isVarArgs) {
          return args.length >= m.parameters.length - 1;
        }
        return false;
      }
      return true;
    });
  }

  private findMethodVirtual(className: string, name: string, args: JavaValue[]): { method: MethodDeclaration; className: string } | undefined {
    let current: string | null = className;
    while (current) {
      const info = this.registry.get(current);
      if (!info) break;
      const method = this.findMethod(info, name, args, false);
      if (method) return { method, className: current };
      // Also check static methods
      const staticMethod = this.findMethod(info, name, args, true);
      if (staticMethod) return { method: staticMethod, className: current };
      current = info.superClass;
    }
    return undefined;
  }

  private async callUserMethod(
    method: MethodDeclaration,
    thisObj: JavaValue | null,
    className: string,
    args: JavaValue[],
    callerEnv: Environment,
    line: number
  ): Promise<JavaValue> {
    if (!method.body) {
      throw new RuntimeError(`Method '${method.name}' has no body (abstract?)`, line);
    }

    this.callDepth++;
    if (this.callDepth > this.callDepthLimit) {
      this.callDepth--;
      throw stackOverflowError(line);
    }

    this.stackTrace.push({ className, methodName: method.name, line });
    const methodEnv = this.globalEnv.child();
    methodEnv.define('__currentClass__', makeString(className));

    if (thisObj) {
      methodEnv.define('this', thisObj);
    }

    // Bind parameters
    for (let i = 0; i < method.parameters.length; i++) {
      const param = method.parameters[i];
      if (param.isVarArgs && i === method.parameters.length - 1) {
        // Collect remaining args into array
        const varArgs = args.slice(i);
        methodEnv.define(param.name, makeArray('Object', varArgs));
      } else if (i < args.length) {
        methodEnv.define(param.name, args[i]);
      } else {
        methodEnv.define(param.name, defaultValue(param.type));
      }
    }

    try {
      await this.execBlock(method.body, methodEnv);
      return VOID;
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    } finally {
      this.callDepth--;
      this.stackTrace.pop();
    }
  }

  private async callConstructor(
    className: string,
    thisObj: JavaValue,
    args: JavaValue[],
    line: number
  ): Promise<void> {
    // Try built-in constructor first
    const builtIn = this.registry.getBuiltInConstructor(className);
    if (builtIn) {
      await builtIn(thisObj, args, line);
      return;
    }

    const info = this.registry.get(className);
    if (!info) return;

    // Find matching constructor
    let ctor = info.constructors.find(c => c.parameters.length === args.length);
    if (!ctor && info.constructors.length > 0) {
      ctor = info.constructors[0]; // Fallback to first constructor
    }

    if (ctor) {
      this.callDepth++;
      if (this.callDepth > this.callDepthLimit) {
        this.callDepth--;
        throw stackOverflowError(line);
      }

      this.stackTrace.push({ className, methodName: '<init>', line });
      const ctorEnv = this.globalEnv.child();
      ctorEnv.define('this', thisObj);
      ctorEnv.define('__currentClass__', makeString(className));

      for (let i = 0; i < ctor.parameters.length; i++) {
        if (i < args.length) {
          ctorEnv.define(ctor.parameters[i].name, args[i]);
        }
      }

      try {
        await this.execBlock(ctor.body, ctorEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) { /* constructors can return */ }
        else throw e;
      } finally {
        this.callDepth--;
        this.stackTrace.pop();
      }
    } else {
      // No constructor defined - call super() if there's a superclass
      if (info.superClass) {
        await this.callConstructor(info.superClass, thisObj, [], line);
      }
    }

    // Initialize instance fields
    const obj = asJavaObject(thisObj);
    for (const field of info.fields) {
      if (!field.modifiers.includes('static')) {
        for (const decl of field.declarators) {
          if (decl.initializer && !obj.fields.has(decl.name)) {
            const fieldEnv = this.globalEnv.child();
            fieldEnv.define('this', thisObj);
            const val = await this.evalExpr(decl.initializer, fieldEnv);
            obj.fields.set(decl.name, val);
          }
        }
      }
    }
  }

  private async evalFieldAccess(expr: FieldAccessExpression, env: Environment): Promise<JavaValue> {
    const obj = await this.evalExpr(expr.object, env);

    // Class reference (static field access)
    if (obj.value && typeof obj.value === 'object' && '__classRef' in obj.value) {
      const className = obj.value.__classRef as string;

      // Check global env for static fields
      const key = `${className}.${expr.fieldName}`;
      if (this.globalEnv.has(key)) {
        return this.globalEnv.get(key);
      }

      // Built-in static fields
      const builtInStatic = this.registry.getBuiltInStaticMethod(className, expr.fieldName);
      if (builtInStatic) return builtInStatic(null, [], expr.pos.line);

      // If the field is a nested access like System.out → return a ref
      if (className === 'System' && expr.fieldName === 'out') {
        return makeObject('PrintStream');
      }
      if (className === 'System' && expr.fieldName === 'in') {
        return makeObject('InputStream');
      }

      throw new RuntimeError(`Static field '${expr.fieldName}' not found in '${className}'`, expr.pos.line);
    }

    // Array .length
    if (obj.type === 'array' && expr.fieldName === 'length') {
      return makeInt(asJavaArray(obj).elements.length);
    }

    // String .length() is a method, not a field, but handle .length as field too
    if (obj.type === 'String' && expr.fieldName === 'length') {
      return makeInt((obj.value as string).length);
    }

    if (isNull(obj)) throw nullPointerException(expr.pos.line, `Cannot access field '${expr.fieldName}' on null`);

    // Object field access
    if (obj.value && typeof obj.value === 'object' && 'fields' in obj.value) {
      const jObj = obj.value as JavaObject;
      if (jObj.fields.has(expr.fieldName)) {
        return jObj.fields.get(expr.fieldName)!;
      }
      // For PrintStream objects, allow chaining (System.out.print)
      if (jObj.className === 'PrintStream' || jObj.className === 'InputStream') {
        return makeObject(expr.fieldName);
      }
    }

    // This might be a class reference chain — if obj is an identifier that
    // is actually a package/class path like java.util.Scanner.
    // For our interpreter, we treat known classes directly
    if (obj.type && this.registry.has(obj.type)) {
      return { type: obj.type, value: { __classRef: obj.type, __field: expr.fieldName } };
    }

    throw new RuntimeError(`Field '${expr.fieldName}' not found`, expr.pos.line);
  }

  private async evalArrayAccess(expr: ArrayAccessExpression, env: Environment): Promise<JavaValue> {
    const arr = await this.evalExpr(expr.array, env);
    const idx = toNumber(await this.evalExpr(expr.index, env));

    if (isNull(arr)) throw nullPointerException(expr.pos.line);

    if (arr.type === 'array') {
      const jArr = asJavaArray(arr);
      if (idx < 0 || idx >= jArr.elements.length) {
        throw arrayIndexOutOfBounds(expr.pos.line, idx, jArr.elements.length);
      }
      return jArr.elements[idx];
    }

    // String charAt via indexing (not standard Java, but useful fallback)
    if (arr.type === 'String') {
      const s = arr.value as string;
      if (idx < 0 || idx >= s.length) {
        throw arrayIndexOutOfBounds(expr.pos.line, idx, s.length);
      }
      return makeChar(s.charAt(idx));
    }

    throw new RuntimeError(`Cannot index into ${arr.type}`, expr.pos.line);
  }

  private async evalNew(expr: NewExpression, env: Environment): Promise<JavaValue> {
    const args = await this.evalArgs(expr.args, env);

    // Built-in constructor
    const builtIn = this.registry.getBuiltInConstructor(expr.className);
    if (builtIn) {
      return builtIn(null, args, expr.pos.line);
    }

    // User-defined class
    const info = this.registry.get(expr.className);
    if (info) {
      const obj = this.registry.createInstance(expr.className);
      await this.callConstructor(expr.className, obj, args, expr.pos.line);
      return obj;
    }

    // Common exception classes that may not be registered
    if (expr.className.endsWith('Exception') || expr.className.endsWith('Error')) {
      const msg = args.length > 0 ? toJavaString(args[0]) : '';
      const fields = new Map<string, JavaValue>([['message', makeString(msg)]]);
      if (args.length > 1 && args[1].value && typeof args[1].value === 'object' && 'className' in args[1].value) {
        fields.set('cause', args[1]);
      }
      return makeObject(expr.className, fields);
    }

    throw new RuntimeError(`Class '${expr.className}' not found`, expr.pos.line);
  }

  private async evalNewArray(expr: NewArrayExpression, env: Environment): Promise<JavaValue> {
    const elemType = typeNodeToName(expr.elementType);

    if (expr.initializer) {
      // new int[]{1, 2, 3}
      const elements: JavaValue[] = [];
      for (const e of expr.initializer) {
        elements.push(await this.evalExpr(e, env));
      }
      return makeArray(elemType, elements);
    }

    // new int[size]
    if (expr.dimensions.length > 0) {
      const size = toNumber(await this.evalExpr(expr.dimensions[0], env));
      if (size < 0) {
        throw makeJavaException('NegativeArraySizeException', String(size), expr.pos.line);
      }
      const elements: JavaValue[] = [];
      const defVal = defaultValue(expr.elementType);
      for (let i = 0; i < size; i++) {
        if (expr.dimensions.length > 1) {
          // Multi-dimensional: create sub-arrays
          const subDims = expr.dimensions.slice(1);
          const subExpr: NewArrayExpression = {
            ...expr,
            dimensions: subDims,
          };
          elements.push(await this.evalNewArray(subExpr, env));
        } else {
          elements.push({ ...defVal });
        }
      }
      return makeArray(elemType, elements);
    }

    return makeArray(elemType, []);
  }

  private async evalArrayInitializer(expr: ArrayInitializerExpression, env: Environment): Promise<JavaValue> {
    const elements: JavaValue[] = [];
    for (const e of expr.elements) {
      elements.push(await this.evalExpr(e, env));
    }
    // Infer element type from first element
    const elemType = elements.length > 0 ? elements[0].type : 'Object';
    return makeArray(elemType, elements);
  }

  private async evalCast(expr: CastExpression, env: Environment): Promise<JavaValue> {
    const val = await this.evalExpr(expr.expression, env);
    const targetType = typeNodeToName(expr.type);

    // Numeric casts
    if (isNumeric(targetType) && isNumeric(val.type)) {
      return castNumeric(val, targetType);
    }
    if (isNumeric(targetType) && val.type === 'char') {
      return castNumeric(val, targetType);
    }
    if (targetType === 'char' && isNumeric(val.type)) {
      return castNumeric(val, 'char');
    }

    // Reference casts (trust the programmer for now, like Java does at compile time)
    // If cast fails at runtime, throw ClassCastException
    if (isNull(val)) return val; // null can be cast to anything

    // String to other types isn't a valid cast in Java
    // But we allow reference type casts between compatible classes
    return { ...val, type: targetType };
  }

  private async evalInstanceof(expr: InstanceofExpression, env: Environment): Promise<JavaValue> {
    const val = await this.evalExpr(expr.expression, env);
    if (isNull(val)) return FALSE;

    const targetType = typeNodeToName(expr.type);
    const valType = this.getClassName(val);

    if (valType === targetType) return TRUE;
    if (this.registry.isAssignableTo(valType, targetType)) return TRUE;
    return FALSE;
  }

  private async evalConditional(expr: ConditionalExpression, env: Environment): Promise<JavaValue> {
    const cond = await this.evalExpr(expr.condition, env);
    if (this.isTruthy(cond)) {
      return this.evalExpr(expr.trueExpr, env);
    } else {
      return this.evalExpr(expr.falseExpr, env);
    }
  }

  // ============================================================
  // String methods
  // ============================================================

  private callStringMethod(obj: JavaValue, name: string, args: JavaValue[], line: number): JavaValue {
    const s = obj.value as string;

    switch (name) {
      case 'length': return makeInt(s.length);
      case 'charAt': {
        const i = toNumber(args[0]);
        if (i < 0 || i >= s.length) throw makeJavaException('StringIndexOutOfBoundsException', `String index out of range: ${i}`, line);
        return makeChar(s.charAt(i));
      }
      case 'substring': {
        const begin = toNumber(args[0]);
        const end = args.length > 1 ? toNumber(args[1]) : s.length;
        return makeString(s.substring(begin, end));
      }
      case 'indexOf': {
        if (args[0].type === 'char') return makeInt(s.indexOf(args[0].value as string));
        const target = toJavaString(args[0]);
        const from = args.length > 1 ? toNumber(args[1]) : 0;
        return makeInt(s.indexOf(target, from));
      }
      case 'lastIndexOf': {
        const target = toJavaString(args[0]);
        const from = args.length > 1 ? toNumber(args[1]) : undefined;
        return makeInt(s.lastIndexOf(target, from));
      }
      case 'contains': return makeBool(s.includes(toJavaString(args[0])));
      case 'startsWith': return makeBool(s.startsWith(toJavaString(args[0])));
      case 'endsWith': return makeBool(s.endsWith(toJavaString(args[0])));
      case 'equals': return makeBool(s === toJavaString(args[0]));
      case 'equalsIgnoreCase': return makeBool(s.toLowerCase() === toJavaString(args[0]).toLowerCase());
      case 'compareTo': return makeInt(s < toJavaString(args[0]) ? -1 : s > toJavaString(args[0]) ? 1 : 0);
      case 'compareToIgnoreCase': {
        const a = s.toLowerCase(), b = toJavaString(args[0]).toLowerCase();
        return makeInt(a < b ? -1 : a > b ? 1 : 0);
      }
      case 'trim': return makeString(s.trim());
      case 'strip': return makeString(s.trim());
      case 'toLowerCase': return makeString(s.toLowerCase());
      case 'toUpperCase': return makeString(s.toUpperCase());
      case 'replace': {
        const from = toJavaString(args[0]);
        const to = toJavaString(args[1]);
        return makeString(s.split(from).join(to));
      }
      case 'replaceAll': {
        const pattern = toJavaString(args[0]);
        const replacement = toJavaString(args[1]);
        return makeString(s.replace(new RegExp(pattern, 'g'), replacement));
      }
      case 'split': {
        const delim = toJavaString(args[0]);
        const parts = delim === '' ? s.split('') : s.split(new RegExp(delim));
        return makeArray('String', parts.map(p => makeString(p)));
      }
      case 'toCharArray': {
        return makeArray('char', s.split('').map(c => makeChar(c)));
      }
      case 'isEmpty': return makeBool(s.length === 0);
      case 'isBlank': return makeBool(s.trim().length === 0);
      case 'matches': return makeBool(new RegExp(`^${toJavaString(args[0])}$`).test(s));
      case 'toString': return obj;
      case 'hashCode': {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
        }
        return makeInt(h);
      }
      case 'valueOf': return makeString(s);
      case 'intern': return obj;
      case 'concat': return makeString(s + toJavaString(args[0]));
      case 'repeat': return makeString(s.repeat(toNumber(args[0])));
    }

    throw new RuntimeError(`String method '${name}' not implemented`, line);
  }

  // ============================================================
  // Utilities
  // ============================================================

  private isTruthy(val: JavaValue): boolean {
    if (val.type === 'boolean') return val.value as boolean;
    if (isNull(val)) return false;
    return true;
  }

  private referenceEquals(a: JavaValue, b: JavaValue): boolean {
    if (isNull(a) && isNull(b)) return true;
    if (isNull(a) || isNull(b)) return false;
    if (a.type === 'String' && b.type === 'String') return a.value === b.value;
    if (isPrimitive(a.type) && isPrimitive(b.type)) return toNumber(a) === toNumber(b);
    // Reference equality: same object id
    if (a.value && b.value && typeof a.value === 'object' && typeof b.value === 'object') {
      if ('id' in a.value && 'id' in b.value) {
        return (a.value as any).id === (b.value as any).id;
      }
    }
    return a.value === b.value;
  }

  private valuesEqual(a: JavaValue, b: JavaValue): boolean {
    if (isNull(a) && isNull(b)) return true;
    if (isNull(a) || isNull(b)) return false;
    if (a.type === 'String' && b.type === 'String') return a.value === b.value;
    if (isPrimitive(a.type) && isPrimitive(b.type)) return toNumber(a) === toNumber(b);
    return this.referenceEquals(a, b);
  }

  private getClassName(val: JavaValue): string {
    if (val.type === 'String') return 'String';
    if (val.type === 'array') return 'Array';
    if (val.value && typeof val.value === 'object' && 'className' in val.value) {
      return (val.value as JavaObject).className;
    }
    return val.type;
  }

  private async checkStep(): Promise<void> {
    this.steps++;
    if (this.cancelled) throw new ExecutionCancelled();
    if (this.steps > this.stepLimit) throw new StepLimitExceeded(this.stepLimit);
    // Yield to event loop every 10K steps so the UI stays responsive
    if (this.steps % 10000 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // ============================================================
  // Public API for runtime registration
  // ============================================================

  getRegistry(): ClassRegistry { return this.registry; }
  getGlobalEnv(): Environment { return this.globalEnv; }

  /** Async toString: calls user-defined or built-in toString() if available, else falls back to toJavaString */
  async valueToString(val: JavaValue): Promise<string> {
    if (val.value && typeof val.value === 'object' && 'className' in val.value && 'fields' in val.value) {
      const obj = val.value as JavaObject;
      const className = obj.className;

      // Check user-defined toString method first (overrides built-in Object.toString)
      const method = this.findMethodVirtual(className, 'toString', []);
      if (method) {
        const result = await this.callUserMethod(method.method, val, method.className, [], this.globalEnv, 0);
        return toJavaString(result);
      }

      // Check built-in toString method
      const builtIn = this.registry.getBuiltInMethod(className, 'toString');
      if (builtIn) {
        const result = await builtIn(val, [], 0);
        return toJavaString(result);
      }
    }
    return toJavaString(val);
  }
}
