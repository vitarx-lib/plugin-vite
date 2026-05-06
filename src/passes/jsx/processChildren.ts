/**
 * 子元素处理模块
 * 处理 JSX 元素的子节点
 * @module passes/jsx/processChildren
 */
import * as t from '@babel/types'
import {
  isBinaryExpression,
  isConditionalExpression,
  isIdentifier,
  isJSXElement,
  isJSXExpressionContainer,
  isJSXFragment,
  isJSXText,
  isLogicalExpression,
  isMemberExpression
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
 * 处理成员表达式，生成 accessor 调用
 */
function handleMemberExpression(expr: t.MemberExpression, ctx: TransformContext): t.CallExpression {
  markImport(ctx, 'accessor')
  const accessorAlias = getAlias(ctx.vitarxAliases, 'accessor')
  return createAccessorCall(expr.object, expr.property as t.Expression, accessorAlias)
}

/**
 * 使用 expr 包装表达式
 * 用于逻辑表达式、二元表达式和调用表达式的统一包装
 * 运行时根据返回值类型决定是否跟踪响应式：
 * - 数组返回值：原样返回（仅渲染一次）
 * - 其他返回值：创建 DynamicView 追踪
 */
function wrapWithExpr(expr: t.Expression, ctx: TransformContext): t.CallExpression {
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
 * JSX 容器节点在此拆包后委托给 processChildExpression 处理
 * 已转换的 API 调用（createView/branch 等 CallExpression）直接透传
 */
function processChildNode(node: t.Node, ctx: TransformContext): t.Expression | null {
  if (isJSXText(node)) {
    const trimmed = node.value.trim()
    if (!trimmed) return null
    return t.stringLiteral(trimmed)
  }

  if (isJSXExpressionContainer(node)) {
    if (node.expression.type === 'JSXEmptyExpression') return null
    return processChildExpression(node.expression as t.Expression, ctx)
  }

  if (node.type === 'JSXSpreadChild') {
    return processChildExpression(node.expression, ctx)
  }

  if (isJSXElement(node) || isJSXFragment(node)) {
    return node as t.Expression
  }

  // 已转换的 API 调用（createView/branch 等）直接透传，不包装 expr
  if (node.type === 'CallExpression') {
    return node
  }

  // 其他表达式类型委托给 processChildExpression
  return processChildExpression(node as t.Expression, ctx)
}

/**
 * 处理子表达式（来自 JSX 表达式容器或条件分支）
 * 根据表达式类型生成对应的运行时 API 调用
 * CallExpression 在此用 expr 包装（用户函数调用需要响应式追踪）
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

  if (isLogicalExpression(expr) || isBinaryExpression(expr) || expr.type === 'CallExpression') {
    return wrapWithExpr(expr, ctx)
  }

  return expr
}

/**
 * 处理条件表达式，转换为 branch 调用
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
