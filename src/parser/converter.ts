// Convert java-parser CST to our AST
// java-parser produces a deeply nested Concrete Syntax Tree (CST) following the
// Java Language Specification grammar. This converter walks the CST and produces
// a clean, flat AST suitable for interpretation.

import {
  CompilationUnit, ImportDeclaration, ClassDeclaration, ClassMember,
  FieldDeclaration, MethodDeclaration, ConstructorDeclaration,
  VariableDeclarator, Parameter, TypeNode, PrimitiveType, ClassType, ArrayType,
  Statement, BlockStatement, VariableDeclarationStatement, ExpressionStatement,
  IfStatement, ForStatement, EnhancedForStatement, WhileStatement,
  DoWhileStatement, SwitchStatement, TryStatement, ReturnStatement,
  BreakStatement, ContinueStatement, ThrowStatement,
  Expression, BinaryExpression, MethodCallExpression, FieldAccessExpression,
  ArrayAccessExpression, NewExpression, NewArrayExpression,
  LiteralExpression, IdentifierExpression, AssignmentExpression,
  CastExpression, ConditionalExpression, Position, UnaryExpression,
  PostfixExpression, InstanceofExpression, ArrayInitializerExpression,
  SwitchCase, CatchClause
} from './ast';

// Helpers to extract tokens from CST nodes
function tok(node: any): string | undefined {
  if (!node) return undefined;
  if (node.image !== undefined) return node.image;
  return undefined;
}

function firstTok(nodes: any[] | undefined): string | undefined {
  if (!nodes || nodes.length === 0) return undefined;
  return tok(nodes[0]);
}

function pos(node: any): Position {
  if (!node) return { line: 1, column: 1 };
  // Token node
  if (node.startLine !== undefined) {
    return { line: node.startLine, column: node.startColumn || 1 };
  }
  // CST node — find first token recursively
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      const arr = node.children[key];
      if (arr && arr.length > 0) {
        return pos(arr[0]);
      }
    }
  }
  return { line: 1, column: 1 };
}

function child(node: any, ...path: string[]): any {
  let current = node;
  for (const key of path) {
    if (!current || !current.children || !current.children[key]) return undefined;
    current = current.children[key][0];
  }
  return current;
}

function children(node: any, key: string): any[] {
  if (!node || !node.children || !node.children[key]) return [];
  return node.children[key];
}

// Operator precedence for building proper binary expression tree
// java-parser's CST flattens binary expressions: [a, b, c] with operators [+, *]
// We need to rebuild: (a + (b * c)) respecting Java precedence
const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6, '!=': 6,
  '<': 7, '>': 7, '<=': 7, '>=': 7, 'instanceof': 7,
  '<<': 8, '>>': 8, '>>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
};

function buildPrecedenceTree(operands: Expression[], operators: string[]): Expression {
  if (operands.length === 1) return operands[0];
  if (operators.length === 0) return operands[0];

  // Find lowest precedence operator (rightmost if tie for left-associativity)
  let minPrec = Infinity;
  let minIdx = 0;
  for (let i = 0; i < operators.length; i++) {
    const prec = PRECEDENCE[operators[i]] ?? 0;
    if (prec <= minPrec) {
      minPrec = prec;
      minIdx = i;
    }
  }

  const left = buildPrecedenceTree(
    operands.slice(0, minIdx + 1),
    operators.slice(0, minIdx)
  );
  const right = buildPrecedenceTree(
    operands.slice(minIdx + 1),
    operators.slice(minIdx + 1)
  );

  return {
    kind: 'BinaryExpression',
    operator: operators[minIdx],
    left,
    right,
    pos: left.pos,
  };
}

// ============================================================
// Main converter
// ============================================================

export function convertCompilationUnit(cst: any): CompilationUnit {
  const ord = child(cst, 'ordinaryCompilationUnit');
  if (!ord) {
    return { kind: 'CompilationUnit', imports: [], classes: [], pos: { line: 1, column: 1 } };
  }

  const imports: ImportDeclaration[] = children(ord, 'importDeclaration').map(convertImport);
  const classes: ClassDeclaration[] = [];

  for (const td of children(ord, 'typeDeclaration')) {
    const cd = child(td, 'classDeclaration');
    if (cd) classes.push(convertClassDeclaration(cd));
  }

  return { kind: 'CompilationUnit', imports, classes, pos: pos(cst) };
}

function convertImport(node: any): ImportDeclaration {
  const isStatic = children(node, 'Static').length > 0;
  const isStar = children(node, 'Star').length > 0;

  // packageOrTypeName contains the identifiers
  const nameParts: string[] = [];
  const pkgOrType = child(node, 'packageOrTypeName');
  if (pkgOrType) {
    for (const id of children(pkgOrType, 'Identifier')) {
      nameParts.push(id.image);
    }
  }

  return {
    kind: 'ImportDeclaration',
    path: nameParts,
    isStatic,
    isStar,
    pos: pos(node),
  };
}

function convertClassDeclaration(node: any): ClassDeclaration {
  const modifiers: string[] = [];
  for (const mod of children(node, 'classModifier')) {
    for (const key of Object.keys(mod.children)) {
      if (key !== 'annotation') modifiers.push(key.toLowerCase());
    }
  }

  const normalClass = child(node, 'normalClassDeclaration');
  if (!normalClass) {
    // Could be enum - treat as basic class for now
    const enumDecl = child(node, 'enumDeclaration');
    if (enumDecl) return convertEnumDeclaration(enumDecl, modifiers);
    return { kind: 'ClassDeclaration', name: 'Unknown', modifiers, superClass: null, interfaces: [], members: [], pos: pos(node) };
  }

  const name = firstTok(children(child(normalClass, 'typeIdentifier'), 'Identifier')) || 'Unknown';

  let superClass: string | null = null;
  const ext = child(normalClass, 'classExtends');
  if (ext) {
    superClass = extractClassName(child(ext, 'classType'));
  }

  const interfaces: string[] = [];
  const impl = child(normalClass, 'classImplements');
  if (impl) {
    for (const it of children(impl, 'interfaceTypeList')) {
      for (const iType of children(it, 'interfaceType')) {
        const ct = child(iType, 'classType');
        if (ct) interfaces.push(extractClassName(ct));
      }
    }
  }

  const body = child(normalClass, 'classBody');
  const members = body ? convertClassBody(body) : [];

  return { kind: 'ClassDeclaration', name, modifiers, superClass, interfaces, members, pos: pos(node) };
}

function convertEnumDeclaration(node: any, modifiers: string[]): ClassDeclaration {
  const name = firstTok(children(child(node, 'typeIdentifier'), 'Identifier')) || 'Unknown';
  return { kind: 'ClassDeclaration', name, modifiers, superClass: null, interfaces: [], members: [], pos: pos(node) };
}

function extractClassName(ct: any): string {
  if (!ct) return 'Object';
  const ids = children(ct, 'Identifier');
  if (ids.length > 0) return ids[ids.length - 1].image;
  // nested
  const annCt = child(ct, 'classType');
  if (annCt) return extractClassName(annCt);
  return 'Object';
}

function convertClassBody(body: any): ClassMember[] {
  const members: ClassMember[] = [];
  for (const decl of children(body, 'classBodyDeclaration')) {
    const classMember = child(decl, 'classMemberDeclaration');
    if (classMember) {
      const m = convertClassMemberDeclaration(classMember);
      if (m) members.push(m);
    }
    const ctorDecl = child(decl, 'constructorDeclaration');
    if (ctorDecl) {
      members.push(convertConstructorDeclaration(ctorDecl));
    }
  }
  return members;
}

function convertClassMemberDeclaration(node: any): ClassMember | null {
  const method = child(node, 'methodDeclaration');
  if (method) return convertMethodDeclaration(method);

  const field = child(node, 'fieldDeclaration');
  if (field) return convertFieldDeclaration(field);

  const inner = child(node, 'classDeclaration');
  if (inner) return convertClassDeclaration(inner);

  return null;
}

function convertMethodDeclaration(node: any): MethodDeclaration {
  const modifiers: string[] = [];
  const annotations: string[] = [];
  for (const mod of children(node, 'methodModifier')) {
    for (const key of Object.keys(mod.children)) {
      if (key === 'annotation') {
        const ann = mod.children[key][0];
        if (ann && ann.children) {
          const typeName = child(ann, 'typeName');
          if (typeName) {
            const ident = firstTok(children(typeName, 'Identifier'));
            if (ident) annotations.push(ident);
          }
        }
      } else {
        modifiers.push(key.toLowerCase());
      }
    }
  }

  const header = child(node, 'methodHeader');
  let returnType: TypeNode | 'void' = 'void';
  const result = child(header, 'result');
  if (result) {
    if (children(result, 'Void').length > 0) {
      returnType = 'void';
    } else {
      const ut = child(result, 'unannType');
      if (ut) returnType = convertUnannType(ut);
    }
  }

  const declarator = child(header, 'methodDeclarator');
  const name = firstTok(children(declarator, 'Identifier')) || 'unknown';
  const parameters = convertFormalParameterList(child(declarator, 'formalParameterList'));

  let bodyNode: BlockStatement | null = null;
  const mb = child(node, 'methodBody');
  if (mb) {
    const block = child(mb, 'block');
    if (block) bodyNode = convertBlock(block);
  }

  return {
    kind: 'MethodDeclaration',
    name,
    modifiers,
    annotations,
    returnType,
    parameters,
    body: bodyNode,
    pos: pos(node),
  };
}

function convertConstructorDeclaration(node: any): ConstructorDeclaration {
  const modifiers: string[] = [];
  for (const mod of children(node, 'constructorModifier')) {
    for (const key of Object.keys(mod.children)) {
      if (key !== 'annotation') modifiers.push(key.toLowerCase());
    }
  }

  const declarator = child(node, 'constructorDeclarator');
  const name = firstTok(children(child(declarator, 'simpleTypeName'), 'Identifier')) || 'Unknown';
  const parameters = convertFormalParameterList(child(declarator, 'formalParameterList'));

  const body = child(node, 'constructorBody');
  const stmts: Statement[] = [];

  // explicit constructor invocation: this(...) or super(...)
  const eci = child(body, 'explicitConstructorInvocation');
  if (eci) {
    const unqualified = child(eci, 'unqualifiedExplicitConstructorInvocation');
    if (unqualified) {
      const args = convertArgumentList(child(unqualified, 'argumentList'));
      const isSuper = children(unqualified, 'Super').length > 0;
      const callExpr: MethodCallExpression = {
        kind: 'MethodCallExpression',
        object: null,
        methodName: isSuper ? 'super' : 'this',
        args,
        pos: pos(unqualified),
      };
      stmts.push({ kind: 'ExpressionStatement', expression: callExpr, pos: pos(unqualified) });
    }
  }

  const blockStmts = child(body, 'blockStatements');
  if (blockStmts) {
    stmts.push(...convertBlockStatements(blockStmts));
  }

  return {
    kind: 'ConstructorDeclaration',
    name,
    modifiers,
    parameters,
    body: { kind: 'BlockStatement', statements: stmts, pos: pos(body) },
    pos: pos(node),
  };
}

function convertFieldDeclaration(node: any): FieldDeclaration {
  const modifiers: string[] = [];
  for (const mod of children(node, 'fieldModifier')) {
    for (const key of Object.keys(mod.children)) {
      if (key !== 'annotation') modifiers.push(key.toLowerCase());
    }
  }

  const type = convertUnannType(child(node, 'unannType'));
  const declarators = convertVariableDeclaratorList(child(node, 'variableDeclaratorList'));

  return { kind: 'FieldDeclaration', modifiers, type, declarators, pos: pos(node) };
}

function convertFormalParameterList(node: any): Parameter[] {
  if (!node) return [];
  const params: Parameter[] = [];

  for (const fp of children(node, 'formalParameter')) {
    const regular = child(fp, 'variableParaRegularParameter');
    if (regular) {
      const isFinal = children(child(regular, 'variableModifier'), 'Final').length > 0;
      const type = convertUnannType(child(regular, 'unannType'));
      const declId = child(regular, 'variableDeclaratorId');
      const name = firstTok(children(declId, 'Identifier')) || 'param';
      params.push({ name, type, isFinal, isVarArgs: false });
    }
    const varArgs = child(fp, 'variableArityParameter');
    if (varArgs) {
      const type = convertUnannType(child(varArgs, 'unannType'));
      const name = firstTok(children(child(varArgs, 'variableDeclaratorId'), 'Identifier')) || 'args';
      params.push({ name, type: { kind: 'ArrayType', elementType: type, dimensions: 1 }, isFinal: false, isVarArgs: true });
    }
  }

  return params;
}

// ============================================================
// Types
// ============================================================

function convertUnannType(node: any): TypeNode {
  if (!node) return { kind: 'ClassType', name: 'Object', typeArgs: [] };

  const prim = child(node, 'unannPrimitiveTypeWithOptionalDimsSuffix');
  if (prim) {
    const primType = convertUnannPrimitiveType(child(prim, 'unannPrimitiveType'));
    const dims = children(prim, 'dims');
    if (dims.length > 0) {
      const dimCount = countDims(dims[0]);
      return { kind: 'ArrayType', elementType: primType, dimensions: dimCount };
    }
    return primType;
  }

  const ref = child(node, 'unannReferenceType');
  if (ref) return convertUnannReferenceType(ref);

  return { kind: 'ClassType', name: 'Object', typeArgs: [] };
}

function convertUnannPrimitiveType(node: any): PrimitiveType {
  if (!node) return { kind: 'PrimitiveType', name: 'int' };

  const numeric = child(node, 'numericType');
  if (numeric) {
    const integral = child(numeric, 'integralType');
    if (integral) {
      for (const k of ['Int', 'Long', 'Short', 'Byte', 'Char']) {
        if (children(integral, k).length > 0) {
          return { kind: 'PrimitiveType', name: k.toLowerCase() as PrimitiveType['name'] };
        }
      }
    }
    const floating = child(numeric, 'floatingPointType');
    if (floating) {
      if (children(floating, 'Double').length > 0) return { kind: 'PrimitiveType', name: 'double' };
      if (children(floating, 'Float').length > 0) return { kind: 'PrimitiveType', name: 'float' };
    }
  }
  if (children(node, 'Boolean').length > 0) return { kind: 'PrimitiveType', name: 'boolean' };

  return { kind: 'PrimitiveType', name: 'int' };
}

function convertUnannReferenceType(node: any): TypeNode {
  const classType = child(node, 'unannClassOrInterfaceType');
  let baseType: TypeNode;

  if (classType) {
    const ct = child(classType, 'unannClassType');
    const name = firstTok(children(ct, 'Identifier')) || 'Object';
    const typeArgs = convertTypeArguments(child(ct, 'typeArguments'));
    baseType = { kind: 'ClassType', name, typeArgs };
  } else {
    baseType = { kind: 'ClassType', name: 'Object', typeArgs: [] };
  }

  const dims = children(node, 'dims');
  if (dims.length > 0) {
    return { kind: 'ArrayType', elementType: baseType, dimensions: countDims(dims[0]) };
  }

  return baseType;
}

function convertTypeArguments(node: any): TypeNode[] {
  if (!node) return [];
  const args: TypeNode[] = [];
  const list = child(node, 'typeArgumentList');
  if (list) {
    for (const ta of children(list, 'typeArgument')) {
      const ref = child(ta, 'referenceType');
      if (ref) {
        const classType = child(ref, 'classOrInterfaceType');
        if (classType) {
          const ct = child(classType, 'classType');
          if (ct) {
            const name = firstTok(children(ct, 'Identifier')) || 'Object';
            args.push({ kind: 'ClassType', name, typeArgs: [] });
          }
        }
      }
    }
  }
  return args;
}

function convertTypeForCast(node: any): TypeNode {
  // Handle types in a general casting / type context
  // This tries primitiveType and classOrInterfaceType
  const prim = child(node, 'primitiveType');
  if (prim) {
    const numeric = child(prim, 'numericType');
    if (numeric) {
      const integral = child(numeric, 'integralType');
      if (integral) {
        for (const k of ['Int', 'Long', 'Short', 'Byte', 'Char']) {
          if (children(integral, k).length > 0) {
            return { kind: 'PrimitiveType', name: k.toLowerCase() as PrimitiveType['name'] };
          }
        }
      }
      const floating = child(numeric, 'floatingPointType');
      if (floating) {
        if (children(floating, 'Double').length > 0) return { kind: 'PrimitiveType', name: 'double' };
        if (children(floating, 'Float').length > 0) return { kind: 'PrimitiveType', name: 'float' };
      }
    }
    if (children(prim, 'Boolean').length > 0) return { kind: 'PrimitiveType', name: 'boolean' };
  }

  const classType = child(node, 'classOrInterfaceType');
  if (classType) {
    const ct = child(classType, 'classType');
    if (ct) {
      const name = firstTok(children(ct, 'Identifier')) || 'Object';
      return { kind: 'ClassType', name, typeArgs: [] };
    }
  }

  return { kind: 'ClassType', name: 'Object', typeArgs: [] };
}

function countDims(dimsNode: any): number {
  if (!dimsNode) return 0;
  return children(dimsNode, 'LSquare').length;
}

// ============================================================
// Statements
// ============================================================

function convertBlock(node: any): BlockStatement {
  const stmts: Statement[] = [];
  const blockStmts = child(node, 'blockStatements');
  if (blockStmts) {
    stmts.push(...convertBlockStatements(blockStmts));
  }
  return { kind: 'BlockStatement', statements: stmts, pos: pos(node) };
}

function convertBlockStatements(node: any): Statement[] {
  const stmts: Statement[] = [];
  for (const bs of children(node, 'blockStatement')) {
    const s = convertBlockStatement(bs);
    if (s) stmts.push(s);
  }
  return stmts;
}

function convertBlockStatement(node: any): Statement | null {
  const localVarDecl = child(node, 'localVariableDeclarationStatement');
  if (localVarDecl) return convertLocalVariableDeclarationStatement(localVarDecl);

  const stmt = child(node, 'statement');
  if (stmt) return convertStatement(stmt);

  const classDecl = child(node, 'classDeclaration');
  if (classDecl) return null; // Skip local class declarations for now

  return null;
}

function convertLocalVariableDeclarationStatement(node: any): VariableDeclarationStatement {
  const lvd = child(node, 'localVariableDeclaration');
  if (!lvd) return { kind: 'VariableDeclarationStatement', modifiers: [], type: { kind: 'ClassType', name: 'Object', typeArgs: [] }, declarators: [], pos: pos(node) };

  const modifiers: string[] = [];
  for (const mod of children(lvd, 'variableModifier')) {
    if (children(mod, 'Final').length > 0) modifiers.push('final');
  }

  let type: TypeNode;
  const localVarType = child(lvd, 'localVariableType');
  if (localVarType) {
    const varTok = children(localVarType, 'Var');
    if (varTok.length > 0) {
      // var keyword - type will be inferred
      type = { kind: 'ClassType', name: 'var', typeArgs: [] };
    } else {
      const ut = child(localVarType, 'unannType');
      type = ut ? convertUnannType(ut) : { kind: 'ClassType', name: 'Object', typeArgs: [] };
    }
  } else {
    type = { kind: 'ClassType', name: 'Object', typeArgs: [] };
  }

  const declarators = convertVariableDeclaratorList(child(lvd, 'variableDeclaratorList'));

  return { kind: 'VariableDeclarationStatement', modifiers, type, declarators, pos: pos(node) };
}

function convertVariableDeclaratorList(node: any): VariableDeclarator[] {
  if (!node) return [];
  const result: VariableDeclarator[] = [];

  for (const vd of children(node, 'variableDeclarator')) {
    const declId = child(vd, 'variableDeclaratorId');
    const name = firstTok(children(declId, 'Identifier')) || 'unknown';
    const dims = children(declId, 'dims');
    const dimensions = dims.length > 0 ? countDims(dims[0]) : 0;

    let initializer: Expression | null = null;
    const vi = child(vd, 'variableInitializer');
    if (vi) {
      const expr = child(vi, 'expression');
      if (expr) {
        initializer = convertExpression(expr);
      }
      const arrInit = child(vi, 'arrayInitializer');
      if (arrInit) {
        initializer = convertArrayInitializer(arrInit);
      }
    }

    result.push({ name, dimensions, initializer });
  }

  return result;
}

function convertStatement(node: any): Statement {
  const woTrailing = child(node, 'statementWithoutTrailingSubstatement');
  if (woTrailing) return convertStatementWithoutTrailing(woTrailing);

  const ifStmt = child(node, 'ifStatement');
  if (ifStmt) return convertIfStatement(ifStmt);

  const forStmt = child(node, 'forStatement');
  if (forStmt) return convertForStatement(forStmt);

  const whileStmt = child(node, 'whileStatement');
  if (whileStmt) return convertWhileStatement(whileStmt);

  const labeledStmt = child(node, 'labeledStatement');
  if (labeledStmt) {
    // Skip the label, just convert the inner statement
    const inner = child(labeledStmt, 'statement');
    if (inner) return convertStatement(inner);
  }

  return { kind: 'EmptyStatement', pos: pos(node) };
}

function convertStatementWithoutTrailing(node: any): Statement {
  const block = child(node, 'block');
  if (block) return convertBlock(block);

  const exprStmt = child(node, 'expressionStatement');
  if (exprStmt) return convertExpressionStatement(exprStmt);

  const returnStmt = child(node, 'returnStatement');
  if (returnStmt) return convertReturnStatement(returnStmt);

  const breakStmt = child(node, 'breakStatement');
  if (breakStmt) return { kind: 'BreakStatement', pos: pos(breakStmt) };

  const contStmt = child(node, 'continueStatement');
  if (contStmt) return { kind: 'ContinueStatement', pos: pos(contStmt) };

  const throwStmt = child(node, 'throwStatement');
  if (throwStmt) return convertThrowStatement(throwStmt);

  const switchStmt = child(node, 'switchStatement');
  if (switchStmt) return convertSwitchStatement(switchStmt);

  const tryStmt = child(node, 'tryStatement');
  if (tryStmt) return convertTryStatement(tryStmt);

  const doStmt = child(node, 'doStatement');
  if (doStmt) return convertDoWhileStatement(doStmt);

  const emptyStmt = child(node, 'emptyStatement');
  if (emptyStmt) return { kind: 'EmptyStatement', pos: pos(emptyStmt) };

  return { kind: 'EmptyStatement', pos: pos(node) };
}

function convertExpressionStatement(node: any): ExpressionStatement {
  const se = child(node, 'statementExpression');
  const expr = se ? child(se, 'expression') : null;
  if (expr) {
    return { kind: 'ExpressionStatement', expression: convertExpression(expr), pos: pos(node) };
  }
  return {
    kind: 'ExpressionStatement',
    expression: { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) },
    pos: pos(node),
  };
}

function convertReturnStatement(node: any): ReturnStatement {
  const expr = child(node, 'expression');
  return {
    kind: 'ReturnStatement',
    value: expr ? convertExpression(expr) : null,
    pos: pos(node),
  };
}

function convertThrowStatement(node: any): ThrowStatement {
  const expr = child(node, 'expression');
  return {
    kind: 'ThrowStatement',
    expression: expr ? convertExpression(expr) : { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) },
    pos: pos(node),
  };
}

function convertIfStatement(node: any): IfStatement {
  const expr = child(node, 'expression');
  const condition = expr ? convertExpression(expr) : { kind: 'LiteralExpression' as const, type: 'boolean' as const, value: false, pos: pos(node) };

  const stmts = children(node, 'statement');
  const thenBranch = stmts.length > 0 ? convertStatement(stmts[0]) : { kind: 'EmptyStatement' as const, pos: pos(node) };
  const elseBranch = stmts.length > 1 ? convertStatement(stmts[1]) : null;

  return { kind: 'IfStatement', condition, thenBranch, elseBranch, pos: pos(node) };
}

function convertForStatement(node: any): Statement {
  const basic = child(node, 'basicForStatement');
  if (basic) return convertBasicForStatement(basic);

  const enhanced = child(node, 'enhancedForStatement');
  if (enhanced) return convertEnhancedForStatement(enhanced);

  return { kind: 'EmptyStatement', pos: pos(node) };
}

function convertBasicForStatement(node: any): ForStatement {
  let init: (VariableDeclarationStatement | Expression)[] | null = null;
  const forInit = child(node, 'forInit');
  if (forInit) {
    init = [];
    const localVarDecl = child(forInit, 'localVariableDeclaration');
    if (localVarDecl) {
      const modifiers: string[] = [];
      for (const mod of children(localVarDecl, 'variableModifier')) {
        if (children(mod, 'Final').length > 0) modifiers.push('final');
      }
      let type: TypeNode;
      const localVarType = child(localVarDecl, 'localVariableType');
      if (localVarType) {
        const ut = child(localVarType, 'unannType');
        type = ut ? convertUnannType(ut) : { kind: 'ClassType', name: 'Object', typeArgs: [] };
      } else {
        type = { kind: 'ClassType', name: 'Object', typeArgs: [] };
      }
      const declarators = convertVariableDeclaratorList(child(localVarDecl, 'variableDeclaratorList'));
      init.push({ kind: 'VariableDeclarationStatement', modifiers, type, declarators, pos: pos(forInit) });
    }
    const stmtExprList = child(forInit, 'statementExpressionList');
    if (stmtExprList) {
      for (const se of children(stmtExprList, 'statementExpression')) {
        const expr = child(se, 'expression');
        if (expr) init.push(convertExpression(expr));
      }
    }
  }

  let condition: Expression | null = null;
  const condExpr = child(node, 'expression');
  if (condExpr) condition = convertExpression(condExpr);

  const update: Expression[] = [];
  const forUpdate = child(node, 'forUpdate');
  if (forUpdate) {
    const stmtExprList = child(forUpdate, 'statementExpressionList');
    if (stmtExprList) {
      for (const se of children(stmtExprList, 'statementExpression')) {
        const expr = child(se, 'expression');
        if (expr) update.push(convertExpression(expr));
      }
    }
  }

  const stmt = child(node, 'statement');
  const body = stmt ? convertStatement(stmt) : { kind: 'EmptyStatement' as const, pos: pos(node) };

  return { kind: 'ForStatement', init, condition, update, body, pos: pos(node) };
}

function convertEnhancedForStatement(node: any): EnhancedForStatement {
  const localVarDecl = child(node, 'localVariableDeclaration');
  let type: TypeNode = { kind: 'ClassType', name: 'Object', typeArgs: [] };
  let name = 'item';

  if (localVarDecl) {
    const localVarType = child(localVarDecl, 'localVariableType');
    if (localVarType) {
      const ut = child(localVarType, 'unannType');
      if (ut) type = convertUnannType(ut);
    }
    const declList = child(localVarDecl, 'variableDeclaratorList');
    if (declList) {
      const decl = child(declList, 'variableDeclarator');
      if (decl) {
        const declId = child(decl, 'variableDeclaratorId');
        name = firstTok(children(declId, 'Identifier')) || 'item';
      }
    }
  }

  const expr = child(node, 'expression');
  const iterable = expr ? convertExpression(expr) : { kind: 'IdentifierExpression' as const, name: 'unknown', pos: pos(node) };

  const stmt = child(node, 'statement');
  const body = stmt ? convertStatement(stmt) : { kind: 'EmptyStatement' as const, pos: pos(node) };

  return { kind: 'EnhancedForStatement', type, name, iterable, body, pos: pos(node) };
}

function convertWhileStatement(node: any): WhileStatement {
  const expr = child(node, 'expression');
  const condition = expr ? convertExpression(expr) : { kind: 'LiteralExpression' as const, type: 'boolean' as const, value: false, pos: pos(node) };

  const stmt = child(node, 'statement');
  const body = stmt ? convertStatement(stmt) : { kind: 'EmptyStatement' as const, pos: pos(node) };

  return { kind: 'WhileStatement', condition, body, pos: pos(node) };
}

function convertDoWhileStatement(node: any): DoWhileStatement {
  const expr = child(node, 'expression');
  const condition = expr ? convertExpression(expr) : { kind: 'LiteralExpression' as const, type: 'boolean' as const, value: false, pos: pos(node) };

  const stmt = child(node, 'statement');
  const body = stmt ? convertStatement(stmt) : { kind: 'EmptyStatement' as const, pos: pos(node) };

  return { kind: 'DoWhileStatement', condition, body, pos: pos(node) };
}

function convertSwitchStatement(node: any): SwitchStatement {
  const expr = child(node, 'expression');
  const expression = expr ? convertExpression(expr) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };

  const cases: SwitchCase[] = [];
  const switchBlock = child(node, 'switchBlock');
  if (switchBlock) {
    for (const group of children(switchBlock, 'switchBlockStatementGroup')) {
      const labels: (Expression | 'default')[] = [];
      for (const sl of children(group, 'switchLabel')) {
        if (children(sl, 'Default').length > 0) {
          labels.push('default');
        } else {
          const cc = child(sl, 'caseConstant');
          if (cc) {
            const cExpr = child(cc, 'conditionalExpression');
            if (cExpr) {
              labels.push(convertConditionalExpression(cExpr));
            }
          }
        }
      }

      const stmts: Statement[] = [];
      const blockStmts = child(group, 'blockStatements');
      if (blockStmts) {
        stmts.push(...convertBlockStatements(blockStmts));
      }

      cases.push({ labels, statements: stmts });
    }
  }

  return { kind: 'SwitchStatement', expression, cases, pos: pos(node) };
}

function convertTryStatement(node: any): TryStatement {
  // Could be regular try or try-with-resources
  const tryWith = child(node, 'tryWithResourcesStatement');
  if (tryWith) {
    const block = child(tryWith, 'block');
    const tryBlock = block ? convertBlock(block) : { kind: 'BlockStatement' as const, statements: [], pos: pos(node) };
    const catches = convertCatches(child(tryWith, 'catches'));
    const fin = child(tryWith, 'finally');
    const finallyBlock = fin ? convertBlock(child(fin, 'block')) : null;
    return { kind: 'TryStatement', block: tryBlock, catches, finallyBlock, pos: pos(node) };
  }

  const block = child(node, 'block');
  const tryBlock = block ? convertBlock(block) : { kind: 'BlockStatement' as const, statements: [], pos: pos(node) };

  const catches = convertCatches(child(node, 'catches'));

  const fin = child(node, 'finally');
  const finallyBlock = fin ? convertBlock(child(fin, 'block')) : null;

  return { kind: 'TryStatement', block: tryBlock, catches, finallyBlock, pos: pos(node) };
}

function convertCatches(node: any): CatchClause[] {
  if (!node) return [];
  const result: CatchClause[] = [];

  for (const cc of children(node, 'catchClause')) {
    const catchParam = child(cc, 'catchFormalParameter');
    const catchType = child(catchParam, 'catchType');
    const types: string[] = [];

    if (catchType) {
      for (const utNode of children(catchType, 'unannClassType')) {
        const name = firstTok(children(utNode, 'Identifier'));
        if (name) types.push(name);
      }
      for (const ctNode of children(catchType, 'classType')) {
        const name = firstTok(children(ctNode, 'Identifier'));
        if (name) types.push(name);
      }
    }

    const declId = child(catchParam, 'variableDeclaratorId');
    const name = firstTok(children(declId, 'Identifier')) || 'e';

    const block = child(cc, 'block');
    const body = block ? convertBlock(block) : { kind: 'BlockStatement' as const, statements: [], pos: pos(cc) };

    result.push({ types, name, body });
  }

  return result;
}

// ============================================================
// Expressions
// ============================================================

function convertExpression(node: any): Expression {
  // Handles assignment expressions too
  // expression → conditionalExpression or assignmentExpression
  // In java-parser, assignment is represented within expression as:
  // expression → conditionalExpression [AssignmentOperator expression]
  // but actually java-parser's expression node contains:
  // - conditionalExpression (always present)
  // - optionally: AssignmentOperator + expression (for assignments)

  const condExpr = child(node, 'conditionalExpression');
  const lambdaExpr = child(node, 'lambdaExpression');

  // Check for assignment
  const assignOps = children(node, 'AssignmentOperator');
  if (assignOps.length > 0 && condExpr) {
    const target = convertConditionalExpression(condExpr);
    const exprs = children(node, 'expression');
    const value = exprs.length > 0 ? convertExpression(exprs[0]) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    return {
      kind: 'AssignmentExpression',
      operator: assignOps[0].image,
      target,
      value,
      pos: pos(node),
    };
  }

  if (condExpr) return convertConditionalExpression(condExpr);

  // Lambda expressions - treat as unsupported for now
  if (lambdaExpr) {
    return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
  }

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertConditionalExpression(node: any): Expression {
  const binExpr = child(node, 'binaryExpression');
  if (!binExpr) return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };

  const base = convertBinaryExpression(binExpr);

  // Check for ternary: ? trueExpr : falseExpr
  const questionMarks = children(node, 'QuestionMark');
  if (questionMarks.length > 0) {
    const exprs = children(node, 'expression');
    // java-parser puts both true and false branches as expression children
    const trueExpr = exprs.length > 0 ? convertExpression(exprs[0]) : base;
    const falseExpr = exprs.length > 1 ? convertExpression(exprs[1]) : base;
    return {
      kind: 'ConditionalExpression',
      condition: base,
      trueExpr,
      falseExpr,
      pos: pos(node),
    };
  }

  return base;
}

function convertBinaryExpression(node: any): Expression {
  // Check for assignment: binaryExpression { unaryExpression, AssignmentOperator, expression }
  const assignOps = children(node, 'AssignmentOperator');
  if (assignOps.length > 0) {
    const unaryExprs = children(node, 'unaryExpression');
    const target = unaryExprs.length > 0 ? convertUnaryExpression(unaryExprs[0]) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    const valueExpr = child(node, 'expression');
    const value = valueExpr ? convertExpression(valueExpr) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    return {
      kind: 'AssignmentExpression',
      target,
      operator: assignOps[0].image,
      value,
      pos: pos(node),
    };
  }

  const unaryExprs = children(node, 'unaryExpression');
  const operators = children(node, 'BinaryOperator');

  if (unaryExprs.length === 0) {
    return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
  }

  const operands = unaryExprs.map(convertUnaryExpression);
  const ops = operators.map((op: any) => op.image);

  // Check for shift operators: java-parser represents << as 2 Less tokens,
  // >> as 2 Greater tokens, >>> as 3 Greater tokens (not BinaryOperator)
  const lessTokens = children(node, 'Less');
  const greaterTokens = children(node, 'Greater');
  if (ops.length === 0 && lessTokens.length === 2 && operands.length === 2) {
    ops.push('<<');
  } else if (ops.length === 0 && greaterTokens.length === 3 && operands.length === 2) {
    ops.push('>>>');
  } else if (ops.length === 0 && greaterTokens.length === 2 && operands.length === 2) {
    ops.push('>>');
  }

  // Check for instanceof operator mixed in (before early return for ops.length === 0)
  const instanceofOps = children(node, 'Instanceof');
  if (instanceofOps.length > 0) {
    // Handle instanceof specially
    // The pattern nodes follow instanceof
    const patterns = children(node, 'pattern');
    const refTypes = children(node, 'referenceType');
    if (refTypes.length > 0) {
      const type = convertReferenceTypeForInstanceof(refTypes[0]);
      return {
        kind: 'InstanceofExpression',
        expression: operands[0],
        type,
        pos: pos(node),
      };
    }
  }

  if (ops.length === 0) return operands[0];

  return buildPrecedenceTree(operands, ops);
}

function convertReferenceTypeForInstanceof(node: any): TypeNode {
  const classType = child(node, 'classOrInterfaceType');
  if (classType) {
    const ct = child(classType, 'classType');
    if (ct) {
      const name = firstTok(children(ct, 'Identifier')) || 'Object';
      return { kind: 'ClassType', name, typeArgs: [] };
    }
  }
  return { kind: 'ClassType', name: 'Object', typeArgs: [] };
}

function convertUnaryExpression(node: any): Expression {
  // Check for prefix operators
  const prefixOps = children(node, 'UnaryPrefixOperator');
  const plusPlus = children(node, 'PlusPlus');   // ++
  const minusMinus = children(node, 'MinusMinus'); // --

  const primary = child(node, 'primary');

  if (prefixOps.length > 0 || plusPlus.length > 0 || minusMinus.length > 0) {
    // Prefix unary
    let op: string;
    if (plusPlus.length > 0) op = '++';
    else if (minusMinus.length > 0) op = '--';
    else op = prefixOps[0].image;

    const operand = primary ? convertPrimary(primary) : convertUnaryExpressionNotPlusMinus(child(node, 'unaryExpressionNotPlusMinus'));
    return { kind: 'UnaryExpression', operator: op, operand, prefix: true, pos: pos(node) };
  }

  // Check for postfix operators (UnarySuffixOperator — i++, i--)
  const suffixOps = children(node, 'UnarySuffixOperator');
  if (suffixOps.length > 0 && primary) {
    const operand = convertPrimary(primary);
    const op = suffixOps[0].image; // '++' or '--'
    return { kind: 'PostfixExpression', operator: op, operand, pos: pos(node) };
  }

  // Check for unaryExpressionNotPlusMinus (!, ~, cast)
  const unaryNPM = child(node, 'unaryExpressionNotPlusMinus');
  if (unaryNPM) return convertUnaryExpressionNotPlusMinus(unaryNPM);

  if (primary) return convertPrimary(primary);

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertUnaryExpressionNotPlusMinus(node: any): Expression {
  if (!node) return { kind: 'LiteralExpression', type: 'null', value: null, pos: { line: 1, column: 1 } };

  // Not operator: !expr
  const tildeOps = children(node, 'Tilde');
  const complementOps = children(node, 'UnaryPrefixOperatorNotPlusMinus');

  if (tildeOps.length > 0) {
    const inner = child(node, 'unaryExpression');
    const operand = inner ? convertUnaryExpression(inner) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    return { kind: 'UnaryExpression', operator: '~', operand, prefix: true, pos: pos(node) };
  }

  if (complementOps.length > 0) {
    const inner = child(node, 'unaryExpression');
    const operand = inner ? convertUnaryExpression(inner) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    return { kind: 'UnaryExpression', operator: complementOps[0].image, operand, prefix: true, pos: pos(node) };
  }

  // Cast expression
  const castExpr = child(node, 'castExpression');
  if (castExpr) return convertCastExpression(castExpr);

  // Primary
  const primary = child(node, 'primary');
  if (primary) return convertPrimary(primary);

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertCastExpression(node: any): Expression {
  // primitiveCastExpression or referenceTypeCastExpression
  const primCast = child(node, 'primitiveCastExpression');
  if (primCast) {
    const type = convertTypeForCast(primCast);
    const inner = child(primCast, 'unaryExpression');
    const expr = inner ? convertUnaryExpression(inner) : { kind: 'LiteralExpression' as const, type: 'null' as const, value: null, pos: pos(node) };
    return { kind: 'CastExpression', type, expression: expr, pos: pos(node) };
  }

  const refCast = child(node, 'referenceTypeCastExpression');
  if (refCast) {
    const refType = child(refCast, 'referenceType');
    const type = refType ? convertReferenceTypeForInstanceof(refType) : { kind: 'ClassType' as const, name: 'Object', typeArgs: [] };
    const inner = child(refCast, 'unaryExpressionNotPlusMinus') || child(refCast, 'lambdaExpression');
    let expr: Expression;
    if (inner && inner.name === 'unaryExpressionNotPlusMinus') {
      expr = convertUnaryExpressionNotPlusMinus(inner);
    } else {
      expr = { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
    }
    return { kind: 'CastExpression', type, expression: expr, pos: pos(node) };
  }

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertPrimary(node: any): Expression {
  const prefix = child(node, 'primaryPrefix');
  let base: Expression = { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };

  if (prefix) {
    base = convertPrimaryPrefix(prefix);
  }

  // Apply suffixes (method calls, field access, array access, postfix ++/--)
  const suffixes = children(node, 'primarySuffix');
  for (const suffix of suffixes) {
    base = applySuffix(base, suffix);
  }

  return base;
}

function convertPrimaryPrefix(node: any): Expression {
  // literal
  const lit = child(node, 'literal');
  if (lit) return convertLiteral(lit);

  // this
  const thisKw = children(node, 'This');
  if (thisKw.length > 0) return { kind: 'ThisExpression', pos: pos(node) };

  // super - not typically in primaryPrefix, handled via fqnOrRefType
  // parenthesisExpression: (expr)
  const parenExpr = child(node, 'parenthesisExpression');
  if (parenExpr) {
    const expr = child(parenExpr, 'expression');
    return expr ? { kind: 'ParenExpression', expression: convertExpression(expr), pos: pos(node) } : { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
  }

  // new expression
  const newExpr = child(node, 'newExpression');
  if (newExpr) return convertNewExpression(newExpr);

  // fqnOrRefType: identifiers like System.out.println, variable names, etc.
  const fqn = child(node, 'fqnOrRefType');
  if (fqn) return convertFqnOrRefType(fqn);

  // castExpression may appear here in some contexts
  const castExpr = child(node, 'castExpression');
  if (castExpr) return convertCastExpression(castExpr);

  // Void.class etc - not needed for CS1
  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertFqnOrRefType(node: any): Expression {
  // Build a chain of identifiers: System.out.println → [System, out, println]
  const parts: string[] = [];

  const first = child(node, 'fqnOrRefTypePartFirst');
  if (first) {
    const common = child(first, 'fqnOrRefTypePartCommon');
    if (common) {
      // Could be 'super' keyword
      const superKw = children(common, 'Super');
      if (superKw.length > 0) {
        parts.push('super');
      } else {
        const id = firstTok(children(common, 'Identifier'));
        if (id) parts.push(id);
      }
    }
  }

  for (const rest of children(node, 'fqnOrRefTypePartRest')) {
    const common = child(rest, 'fqnOrRefTypePartCommon');
    if (common) {
      const superKw = children(common, 'Super');
      if (superKw.length > 0) {
        parts.push('super');
      } else {
        const id = firstTok(children(common, 'Identifier'));
        if (id) parts.push(id);
      }
    }
  }

  if (parts.length === 0) {
    return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
  }

  // Build expression chain
  // Start with first part as identifier, then chain field accesses
  let expr: Expression;
  if (parts[0] === 'super') {
    expr = { kind: 'SuperExpression', pos: pos(node) };
  } else if (parts[0] === 'this') {
    expr = { kind: 'ThisExpression', pos: pos(node) };
  } else {
    expr = { kind: 'IdentifierExpression', name: parts[0], pos: pos(node) };
  }

  for (let i = 1; i < parts.length; i++) {
    expr = { kind: 'FieldAccessExpression', object: expr, fieldName: parts[i], pos: pos(node) };
  }

  return expr;
}

function applySuffix(base: Expression, suffix: any): Expression {
  // methodInvocationSuffix: (.args.)
  const methodSuffix = child(suffix, 'methodInvocationSuffix');
  if (methodSuffix) {
    const args = convertArgumentList(child(methodSuffix, 'argumentList'));

    // If the base is a field access, the last part is the method name
    if (base.kind === 'FieldAccessExpression') {
      return {
        kind: 'MethodCallExpression',
        object: base.object,
        methodName: base.fieldName,
        args,
        pos: base.pos,
      };
    }

    // If the base is an identifier, it's a standalone method call
    if (base.kind === 'IdentifierExpression') {
      return {
        kind: 'MethodCallExpression',
        object: null,
        methodName: base.name,
        args,
        pos: base.pos,
      };
    }

    // Super method call
    if (base.kind === 'SuperExpression') {
      return {
        kind: 'MethodCallExpression',
        object: null,
        methodName: 'super',
        args,
        pos: base.pos,
      };
    }

    // Fallback: method call on expression
    return {
      kind: 'MethodCallExpression',
      object: base,
      methodName: 'apply',
      args,
      pos: base.pos,
    };
  }

  // arrayAccessSuffix: [index]
  const arraySuffix = child(suffix, 'arrayAccessSuffix');
  if (arraySuffix) {
    const expr = child(arraySuffix, 'expression');
    const index = expr ? convertExpression(expr) : { kind: 'LiteralExpression' as const, type: 'int' as const, value: 0, pos: pos(suffix) };
    return { kind: 'ArrayAccessExpression', array: base, index, pos: pos(suffix) };
  }

  // classLiteralSuffix: .class - not needed for CS1
  // methodReferenceSuffix: ::method - not needed for CS1

  // Postfix ++/--
  const plusPlus = children(suffix, 'PlusPlus');
  if (plusPlus.length > 0) {
    return { kind: 'PostfixExpression', operator: '++', operand: base, pos: pos(suffix) };
  }
  const minusMinus = children(suffix, 'MinusMinus');
  if (minusMinus.length > 0) {
    return { kind: 'PostfixExpression', operator: '--', operand: base, pos: pos(suffix) };
  }

  // Dot access for further identifiers
  const dotId = children(suffix, 'Identifier');
  if (dotId.length > 0) {
    return { kind: 'FieldAccessExpression', object: base, fieldName: dotId[0].image, pos: pos(suffix) };
  }

  return base;
}

function convertNewExpression(node: any): Expression {
  // arrayCreationExpression or unqualifiedClassInstanceCreationExpression
  const arrayCre = child(node, 'arrayCreationExpression');
  if (arrayCre) return convertArrayCreationExpression(arrayCre);

  const classCre = child(node, 'unqualifiedClassInstanceCreationExpression');
  if (classCre) {
    const classToInstantiate = child(classCre, 'classOrInterfaceTypeToInstantiate');
    let className = 'Object';
    if (classToInstantiate) {
      const ids = children(classToInstantiate, 'Identifier');
      if (ids.length > 0) className = ids[ids.length - 1].image;
    }

    // Type arguments (for diamond operator <>)
    const typeArgs = convertTypeArguments(child(classToInstantiate, 'typeArguments'));

    const args = convertArgumentList(child(classCre, 'argumentList'));

    return {
      kind: 'NewExpression',
      className,
      typeArgs,
      args,
      pos: pos(node),
    };
  }

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function convertArrayCreationExpression(node: any): Expression {
  // arrayCreationExpressionWithoutInitializerSuffix or arrayCreationWithInitializerSuffix
  const withoutInit = child(node, 'arrayCreationExpressionWithoutInitializerSuffix');
  if (withoutInit) {
    const type = extractArrayBaseType(withoutInit);
    const dimExprs = child(withoutInit, 'dimExprs');
    const dimensions: Expression[] = [];
    if (dimExprs) {
      for (const de of children(dimExprs, 'dimExpr')) {
        const expr = child(de, 'expression');
        if (expr) dimensions.push(convertExpression(expr));
      }
    }
    return { kind: 'NewArrayExpression', elementType: type, dimensions, initializer: null, pos: pos(node) };
  }

  const withInit = child(node, 'arrayCreationWithInitializerSuffix');
  if (withInit) {
    const type = extractArrayBaseType(withInit);
    const arrInit = child(withInit, 'arrayInitializer');
    const elements = arrInit ? convertArrayInitializerElements(arrInit) : [];
    return { kind: 'NewArrayExpression', elementType: type, dimensions: [], initializer: elements, pos: pos(node) };
  }

  return { kind: 'NewArrayExpression', elementType: { kind: 'PrimitiveType', name: 'int' }, dimensions: [], initializer: null, pos: pos(node) };
}

function extractArrayBaseType(node: any): TypeNode {
  const primType = child(node, 'primitiveType');
  if (primType) {
    const numeric = child(primType, 'numericType');
    if (numeric) {
      const integral = child(numeric, 'integralType');
      if (integral) {
        for (const k of ['Int', 'Long', 'Short', 'Byte', 'Char']) {
          if (children(integral, k).length > 0) {
            return { kind: 'PrimitiveType', name: k.toLowerCase() as PrimitiveType['name'] };
          }
        }
      }
      const floating = child(numeric, 'floatingPointType');
      if (floating) {
        if (children(floating, 'Double').length > 0) return { kind: 'PrimitiveType', name: 'double' };
        if (children(floating, 'Float').length > 0) return { kind: 'PrimitiveType', name: 'float' };
      }
    }
    if (children(primType, 'Boolean').length > 0) return { kind: 'PrimitiveType', name: 'boolean' };
  }

  const classType = child(node, 'classOrInterfaceType');
  if (classType) {
    const ct = child(classType, 'classType');
    if (ct) {
      const name = firstTok(children(ct, 'Identifier')) || 'Object';
      return { kind: 'ClassType', name, typeArgs: [] };
    }
  }

  return { kind: 'PrimitiveType', name: 'int' };
}

function convertArrayInitializer(node: any): ArrayInitializerExpression {
  return {
    kind: 'ArrayInitializerExpression',
    elements: convertArrayInitializerElements(node),
    pos: pos(node),
  };
}

function convertArrayInitializerElements(node: any): Expression[] {
  const elements: Expression[] = [];

  // In java-parser CST, elements are in variableInitializerList → variableInitializer[]
  const viList = child(node, 'variableInitializerList');
  const viNodes = viList ? children(viList, 'variableInitializer') : children(node, 'variableInitializer');

  for (const vi of viNodes) {
    const expr = child(vi, 'expression');
    if (expr) {
      elements.push(convertExpression(expr));
    }
    const arrInit = child(vi, 'arrayInitializer');
    if (arrInit) {
      elements.push(convertArrayInitializer(arrInit));
    }
  }
  return elements;
}

function convertArgumentList(node: any): Expression[] {
  if (!node) return [];
  const args: Expression[] = [];
  for (const expr of children(node, 'expression')) {
    args.push(convertExpression(expr));
  }
  return args;
}

function convertLiteral(node: any): LiteralExpression {
  const intLit = child(node, 'integerLiteral');
  if (intLit) {
    const decLit = firstTok(children(intLit, 'DecimalLiteral'));
    if (decLit) {
      const isLong = decLit.endsWith('L') || decLit.endsWith('l');
      const numStr = isLong ? decLit.slice(0, -1) : decLit;
      // Handle underscores in Java numeric literals
      const clean = numStr.replace(/_/g, '');
      return { kind: 'LiteralExpression', type: isLong ? 'long' : 'int', value: parseInt(clean, 10), pos: pos(node) };
    }
    const hexLit = firstTok(children(intLit, 'HexLiteral'));
    if (hexLit) {
      const clean = hexLit.replace(/_/g, '').replace(/[lL]$/, '');
      return { kind: 'LiteralExpression', type: 'int', value: parseInt(clean, 16), pos: pos(node) };
    }
    const binLit = firstTok(children(intLit, 'BinaryLiteral'));
    if (binLit) {
      const clean = binLit.replace(/_/g, '').replace(/[lL]$/, '').replace(/^0[bB]/, '');
      return { kind: 'LiteralExpression', type: 'int', value: parseInt(clean, 2), pos: pos(node) };
    }
    const octLit = firstTok(children(intLit, 'OctalLiteral'));
    if (octLit) {
      const clean = octLit.replace(/_/g, '').replace(/[lL]$/, '');
      return { kind: 'LiteralExpression', type: 'int', value: parseInt(clean, 8), pos: pos(node) };
    }
    return { kind: 'LiteralExpression', type: 'int', value: 0, pos: pos(node) };
  }

  const floatLit = child(node, 'floatingPointLiteral');
  if (floatLit) {
    const decFloat = firstTok(children(floatLit, 'FloatLiteral'));
    if (decFloat) {
      const isFloat = decFloat.endsWith('f') || decFloat.endsWith('F');
      const clean = decFloat.replace(/_/g, '').replace(/[fFdD]$/, '');
      return { kind: 'LiteralExpression', type: isFloat ? 'float' : 'double', value: parseFloat(clean), pos: pos(node) };
    }
    return { kind: 'LiteralExpression', type: 'double', value: 0.0, pos: pos(node) };
  }

  const boolLit = child(node, 'booleanLiteral');
  if (boolLit) {
    const isTrue = children(boolLit, 'True').length > 0;
    return { kind: 'LiteralExpression', type: 'boolean', value: isTrue, pos: pos(node) };
  }

  const nullLit = children(node, 'Null');
  if (nullLit.length > 0) {
    return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
  }

  const charLit = children(node, 'CharLiteral');
  if (charLit.length > 0) {
    const raw = charLit[0].image;
    // Strip single quotes and unescape
    const inner = raw.slice(1, -1);
    const ch = unescapeJavaChar(inner);
    return { kind: 'LiteralExpression', type: 'char', value: ch, pos: pos(node) };
  }

  const stringLit = children(node, 'StringLiteral');
  if (stringLit.length > 0) {
    const raw = stringLit[0].image;
    // Strip double quotes and unescape
    const inner = raw.slice(1, -1);
    const str = unescapeJavaString(inner);
    return { kind: 'LiteralExpression', type: 'string', value: str, pos: pos(node) };
  }

  const textBlock = children(node, 'TextBlock');
  if (textBlock.length > 0) {
    const raw = textBlock[0].image;
    // Strip """ delimiters
    const inner = raw.slice(3, -3);
    return { kind: 'LiteralExpression', type: 'string', value: inner.replace(/^\n/, ''), pos: pos(node) };
  }

  return { kind: 'LiteralExpression', type: 'null', value: null, pos: pos(node) };
}

function unescapeJavaChar(s: string): string {
  return unescapeJavaString(s);
}

function unescapeJavaString(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      i++;
      switch (s[i]) {
        case 'n': result += '\n'; break;
        case 't': result += '\t'; break;
        case 'r': result += '\r'; break;
        case '\\': result += '\\'; break;
        case '\'': result += '\''; break;
        case '"': result += '"'; break;
        case '0': result += '\0'; break;
        case 'u': {
          // Unicode escape: \uXXXX
          const hex = s.slice(i + 1, i + 5);
          result += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default: result += s[i]; break;
      }
    } else {
      result += s[i];
    }
  }
  return result;
}
