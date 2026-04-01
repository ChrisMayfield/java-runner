// AST node types for the Java subset we support

export interface Position {
  line: number;
  column: number;
}

// ============================================================
// Top-level
// ============================================================

export interface CompilationUnit {
  kind: 'CompilationUnit';
  imports: ImportDeclaration[];
  classes: ClassDeclaration[];
  pos: Position;
}

export interface ImportDeclaration {
  kind: 'ImportDeclaration';
  path: string[];   // e.g. ["java","util","Scanner"]
  isStatic: boolean;
  isStar: boolean;   // import java.util.*
  pos: Position;
}

// ============================================================
// Declarations
// ============================================================

export interface ClassDeclaration {
  kind: 'ClassDeclaration';
  name: string;
  modifiers: string[];        // public, abstract, final
  superClass: string | null;  // extends Foo
  interfaces: string[];       // implements Bar, Baz
  members: ClassMember[];
  pos: Position;
}

export type ClassMember =
  | FieldDeclaration
  | MethodDeclaration
  | ConstructorDeclaration
  | ClassDeclaration;  // inner class

export interface FieldDeclaration {
  kind: 'FieldDeclaration';
  modifiers: string[];
  type: TypeNode;
  declarators: VariableDeclarator[];
  pos: Position;
}

export interface VariableDeclarator {
  name: string;
  dimensions: number;       // extra [] after name
  initializer: Expression | null;
}

export interface MethodDeclaration {
  kind: 'MethodDeclaration';
  name: string;
  modifiers: string[];
  returnType: TypeNode | 'void';
  parameters: Parameter[];
  body: BlockStatement | null;  // null for abstract
  pos: Position;
}

export interface ConstructorDeclaration {
  kind: 'ConstructorDeclaration';
  name: string;
  modifiers: string[];
  parameters: Parameter[];
  body: BlockStatement;
  pos: Position;
}

export interface Parameter {
  name: string;
  type: TypeNode;
  isFinal: boolean;
  isVarArgs: boolean;
}

// ============================================================
// Types
// ============================================================

export type TypeNode = PrimitiveType | ClassType | ArrayType;

export interface PrimitiveType {
  kind: 'PrimitiveType';
  name: 'int' | 'double' | 'float' | 'long' | 'short' | 'byte' | 'char' | 'boolean';
}

export interface ClassType {
  kind: 'ClassType';
  name: string;           // e.g. "String", "ArrayList", "Scanner"
  typeArgs: TypeNode[];   // e.g. <String> or <Integer>
}

export interface ArrayType {
  kind: 'ArrayType';
  elementType: TypeNode;
  dimensions: number;     // int[][] → dimensions = 2
}

// ============================================================
// Statements
// ============================================================

export type Statement =
  | BlockStatement
  | VariableDeclarationStatement
  | ExpressionStatement
  | IfStatement
  | ForStatement
  | EnhancedForStatement
  | WhileStatement
  | DoWhileStatement
  | SwitchStatement
  | TryStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ThrowStatement
  | EmptyStatement;

export interface BlockStatement {
  kind: 'BlockStatement';
  statements: Statement[];
  pos: Position;
}

export interface VariableDeclarationStatement {
  kind: 'VariableDeclarationStatement';
  modifiers: string[];    // final, etc.
  type: TypeNode;
  declarators: VariableDeclarator[];
  pos: Position;
}

export interface ExpressionStatement {
  kind: 'ExpressionStatement';
  expression: Expression;
  pos: Position;
}

export interface IfStatement {
  kind: 'IfStatement';
  condition: Expression;
  thenBranch: Statement;
  elseBranch: Statement | null;
  pos: Position;
}

export interface ForStatement {
  kind: 'ForStatement';
  init: (VariableDeclarationStatement | Expression)[] | null;
  condition: Expression | null;
  update: Expression[];
  body: Statement;
  pos: Position;
}

export interface EnhancedForStatement {
  kind: 'EnhancedForStatement';
  type: TypeNode;
  name: string;
  iterable: Expression;
  body: Statement;
  pos: Position;
}

export interface WhileStatement {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement;
  pos: Position;
}

export interface DoWhileStatement {
  kind: 'DoWhileStatement';
  condition: Expression;
  body: Statement;
  pos: Position;
}

export interface SwitchStatement {
  kind: 'SwitchStatement';
  expression: Expression;
  cases: SwitchCase[];
  pos: Position;
}

export interface SwitchCase {
  labels: (Expression | 'default')[];  // can be multiple labels via fall-through
  statements: Statement[];
}

export interface TryStatement {
  kind: 'TryStatement';
  block: BlockStatement;
  catches: CatchClause[];
  finallyBlock: BlockStatement | null;
  pos: Position;
}

export interface CatchClause {
  types: string[];    // catch (IOException | SQLException e)
  name: string;
  body: BlockStatement;
}

export interface ReturnStatement {
  kind: 'ReturnStatement';
  value: Expression | null;
  pos: Position;
}

export interface BreakStatement {
  kind: 'BreakStatement';
  pos: Position;
}

export interface ContinueStatement {
  kind: 'ContinueStatement';
  pos: Position;
}

export interface ThrowStatement {
  kind: 'ThrowStatement';
  expression: Expression;
  pos: Position;
}

export interface EmptyStatement {
  kind: 'EmptyStatement';
  pos: Position;
}

// ============================================================
// Expressions
// ============================================================

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | PostfixExpression
  | AssignmentExpression
  | MethodCallExpression
  | FieldAccessExpression
  | ArrayAccessExpression
  | NewExpression
  | NewArrayExpression
  | CastExpression
  | InstanceofExpression
  | ConditionalExpression
  | LiteralExpression
  | IdentifierExpression
  | ThisExpression
  | SuperExpression
  | ArrayInitializerExpression
  | ParenExpression;

export interface BinaryExpression {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
  pos: Position;
}

export interface UnaryExpression {
  kind: 'UnaryExpression';
  operator: string;  // -, !, ~, ++, --
  operand: Expression;
  prefix: boolean;   // true for prefix, false would be postfix
  pos: Position;
}

export interface PostfixExpression {
  kind: 'PostfixExpression';
  operator: string;  // ++, --
  operand: Expression;
  pos: Position;
}

export interface AssignmentExpression {
  kind: 'AssignmentExpression';
  operator: string;  // =, +=, -=, *=, /=, %=, etc.
  target: Expression;
  value: Expression;
  pos: Position;
}

export interface MethodCallExpression {
  kind: 'MethodCallExpression';
  object: Expression | null;  // null for standalone function calls
  methodName: string;
  args: Expression[];
  pos: Position;
}

export interface FieldAccessExpression {
  kind: 'FieldAccessExpression';
  object: Expression;
  fieldName: string;
  pos: Position;
}

export interface ArrayAccessExpression {
  kind: 'ArrayAccessExpression';
  array: Expression;
  index: Expression;
  pos: Position;
}

export interface NewExpression {
  kind: 'NewExpression';
  className: string;
  typeArgs: TypeNode[];
  args: Expression[];
  pos: Position;
}

export interface NewArrayExpression {
  kind: 'NewArrayExpression';
  elementType: TypeNode;
  dimensions: Expression[];      // new int[3][4] → [3, 4]
  initializer: Expression[] | null;  // new int[]{1,2,3}
  pos: Position;
}

export interface CastExpression {
  kind: 'CastExpression';
  type: TypeNode;
  expression: Expression;
  pos: Position;
}

export interface InstanceofExpression {
  kind: 'InstanceofExpression';
  expression: Expression;
  type: TypeNode;
  pos: Position;
}

export interface ConditionalExpression {
  kind: 'ConditionalExpression';
  condition: Expression;
  trueExpr: Expression;
  falseExpr: Expression;
  pos: Position;
}

export interface LiteralExpression {
  kind: 'LiteralExpression';
  type: 'int' | 'long' | 'float' | 'double' | 'char' | 'string' | 'boolean' | 'null';
  value: number | string | boolean | null;
  pos: Position;
}

export interface IdentifierExpression {
  kind: 'IdentifierExpression';
  name: string;
  pos: Position;
}

export interface ThisExpression {
  kind: 'ThisExpression';
  pos: Position;
}

export interface SuperExpression {
  kind: 'SuperExpression';
  pos: Position;
}

export interface ArrayInitializerExpression {
  kind: 'ArrayInitializerExpression';
  elements: Expression[];
  pos: Position;
}

export interface ParenExpression {
  kind: 'ParenExpression';
  expression: Expression;
  pos: Position;
}
