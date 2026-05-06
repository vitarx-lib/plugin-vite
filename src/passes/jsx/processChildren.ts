/**
 * 子元素处理模块
 * 处理 JSX 元素的子节点
 * @module passes/jsx/processChildren
 */
import * as t from '@babel/types'
import {
  isBinaryExpression,
  isBooleanLiteral,
  isConditionalExpression,
  isIdentifier,
  isJSXElement,
  isJSXExpressionContainer,
  isJSXFragment,
  isJSXText,
  isLogicalExpression,
  isMemberExpression,
  isNumericLiteral,
  isStringLiteral
} from '@babel/types'
import { markImport, TransformContext } from '../../context.js'
import {
  addPureComment,
  createAccessorCall,
  createBinaryBranch,
  createExprCall,
  getAlias
} from '../../utils/index.js'

/**
 * 处理成员表达式
 */
function handleMemberExpression(expr: t.MemberExpression, ctx: TransformContext): t.CallExpression {
  markImport(ctx, 'accessor')
  const accessorAlias = getAlias(ctx.vitarxAliases, 'accessor')
  return createAccessorCall(expr.object, expr.property as t.Expression, accessorAlias)
}

/**
 * 处理逻辑表达式
 */
function handleLogicalExpression(
  expr: t.LogicalExpression,
  ctx: TransformContext
): t.CallExpression {
  markImport(ctx, 'expr')
  const exprAlias = getAlias(ctx.vitarxAliases, 'expr')
  return addPureComment(createExprCall(expr, exprAlias), ctx)
}

/**
 * 处理二元表达式
 */
function handleBinaryExpression(expr: t.BinaryExpression, ctx: TransformContext): t.CallExpression {
  markImport(ctx, 'expr')
  const exprAlias = getAlias(ctx.vitarxAliases, 'expr')
  return addPureComment(createExprCall(expr, exprAlias), ctx)
}

/**
 * 处理子节点数组
 * @param children - 子节点数组
 * @param ctx - 转换上下文
 * @returns 处理后的表达式数组
 */
export function processChildren(children: t.Node[], ctx: TransformContext): t.Expression[] {
  const result: t.Expression[] = []

  for (const child of children) {
    const processed = processChildNode(child as t.Expression, ctx)
    if (processed !== null) {
      result.push(processed)
    }
  }

  return result
}

/**
 * 处理单个子节点
 */
function processChildNode(node: t.Node, ctx: TransformContext): t.Expression | null {
  // JSX 文本
  if (isJSXText(node)) {
    const trimmed = node.value.trim()
    if (!trimmed) return null
    return t.stringLiteral(trimmed)
  }

  // JSX 表达式容器
  if (isJSXExpressionContainer(node)) {
    if (node.expression.type === 'JSXEmptyExpression') return null
    return processChildExpression(node.expression as t.Expression, ctx)
  }

  // JSX 展开子元素
  if (node.type === 'JSXSpreadChild') {
    return processChildExpression(node.expression, ctx)
  }

  // JSX 元素或片段
  if (isJSXElement(node) || isJSXFragment(node)) {
    return node as t.Expression
  }

  // 字面量
  if (isStringLiteral(node) || isNumericLiteral(node) || isBooleanLiteral(node)) {
    return node
  }

  // 标识符
  if (isIdentifier(node)) {
    return node
  }

  // 成员表达式
  if (isMemberExpression(node)) {
    return handleMemberExpression(node, ctx)
  }

  // 条件表达式
  if (isConditionalExpression(node)) {
    return processConditionalExpression(node, ctx)
  }

  // 逻辑表达式
  if (isLogicalExpression(node)) {
    return handleLogicalExpression(node, ctx)
  }

  // 二元表达式
  if (isBinaryExpression(node)) {
    return handleBinaryExpression(node, ctx)
  }

  // 调用表达式
  if (node.type === 'CallExpression') {
    return node as t.Expression
  }

  return node as t.Expression
}

/**
 * 处理子表达式
 */
function processChildExpression(expr: t.Expression, ctx: TransformContext): t.Expression {
  if (isIdentifier(expr)) {
    return expr
  }

  if (isMemberExpression(expr)) {
    return handleMemberExpression(expr, ctx)
  }

  if (isConditionalExpression(expr)) {
    return processConditionalExpression(expr, ctx)
  }

  if (isLogicalExpression(expr)) {
    return handleLogicalExpression(expr, ctx)
  }

  if (isBinaryExpression(expr)) {
    return handleBinaryExpression(expr, ctx)
  }

  return expr
}

/**
 * 处理条件表达式
 * 转换为 branch 调用
 */
function processConditionalExpression(
  node: t.ConditionalExpression,
  ctx: TransformContext
): t.CallExpression {
  const { test, consequent, alternate } = node

  const processedConsequent = processChildNode(consequent, ctx) || t.nullLiteral()
  const processedAlternate = processChildNode(alternate, ctx) || t.nullLiteral()

  return createBinaryBranch(test, processedConsequent, processedAlternate, ctx)
}
