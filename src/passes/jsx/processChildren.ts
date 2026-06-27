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
 * 处理成员表达式
 * object 为简单标识符时使用 accessor（细粒度追踪）
 * object 为其他表达式（嵌套成员访问等）时降级为 expr（粗粒度追踪）
 */
function handleMemberExpression(
  expr: t.MemberExpression,
  ctx: TransformContext
): t.CallExpression | t.Expression {
  if (isIdentifier(expr.object)) {
    markImport(ctx, 'accessor')
    const accessorAlias = getAlias(ctx.vitarxAliases, 'accessor')
    return createAccessorCall(expr.object, expr.property as t.Expression, accessorAlias)
  }
  return wrapWithExpr(expr, ctx)
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
  // 初始化结果数组，用于存储处理后的表达式
  const result: t.Expression[] = []

  // 遍历每个子节点
  for (const child of children) {
    // 处理单个子节点，将其转换为表达式
    const processed = processChildNode(child as t.Expression, ctx)
    // 如果处理结果不为null，则添加到结果数组中
    if (processed !== null) {
      result.push(processed)
    }
  }

  // 返回处理后的表达式数组
  return result
}

/**
 * 处理单个子节点
 * JSX 容器节点在此拆包后委托给 processChildExpression 处理
 * 已转换的 API 调用（createView/branch 等 CallExpression）直接透传
 */
function processChildNode(node: t.Node, ctx: TransformContext): t.Expression | null {
  if (isJSXText(node)) {
    if (!node.value.trim()) return null
    const collapsed = node.value.replace(/\s+/g, ' ')
    return t.stringLiteral(collapsed)
  }

  // 处理 JSX 表达式容器，递归处理容器内的表达式
  if (isJSXExpressionContainer(node)) {
    if (node.expression.type === 'JSXEmptyExpression') return null
    return processChildExpression(node.expression, ctx)
  }

  // 处理 JSX 展开表达式，递归处理展开表达式
  if (node.type === 'JSXSpreadChild') {
    return processChildExpression(node.expression, ctx)
  }

  // JSXElement/JSXFragment 由 Babel 遍历的 exit 阶段处理，此处直接透传
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
function processChildExpression(expr: t.Expression, ctx: TransformContext): t.Expression | null {
  // 字符串表达式原样保留
  if (t.isStringLiteral(expr)) return expr

  // 标识符表达式（如 variable），原样保留
  if (isIdentifier(expr)) return expr

  // 如果是成员表达式（如 obj.property），调用专门的处理函数
  if (isMemberExpression(expr)) {
    return handleMemberExpression(expr, ctx)
  }

  // 如果是条件表达式（如 ternary operator），递归处理条件表达式
  if (isConditionalExpression(expr)) {
    return processConditionalExpression(expr, ctx)
  }

  // 如果是逻辑表达式、二元表达式或函数调用表达式，用 expr 包装
  // 这些表达式需要响应式追踪，所以需要特殊处理
  if (isLogicalExpression(expr) || isBinaryExpression(expr) || expr.type === 'CallExpression') {
    return wrapWithExpr(expr, ctx)
  }

  // 包含插值表达式的模板字面量是动态的，需要用 expr 包装以启用响应式追踪
  // 纯静态模板字符串转为 StringLiteral 直接返回
  if (t.isTemplateLiteral(expr)) {
    if (expr.expressions.length > 0) {
      return wrapWithExpr(expr, ctx)
    }
    // 无插值的模板字面量等价于静态字符串
    const raw = expr.quasis.map(q => q.value.cooked).join('')
    return t.stringLiteral(raw)
  }

  // 其他类型的表达式直接返回，无需特殊处理
  return expr
}

/**
 * 处理条件分支中的表达式
 * JSXElement/JSXFragment 和已转换的 API 调用（createView/branch 等）直接透传
 * 其他表达式按 children 规则处理（如 CallExpression 需要 expr 包装等）
 */
function processBranchExpression(node: t.Node, ctx: TransformContext): t.Expression | null {
  if (isJSXElement(node) || isJSXFragment(node)) {
    return node as t.Expression
  }
  // 已转换的 API 调用（带 @__PURE__ 注释的 createView/branch 等）直接透传
  if (node.type === 'CallExpression' && ctx.pureCommentedNodes.has(node)) {
    return node as t.Expression
  }
  return processChildExpression(node as t.Expression, ctx)
}

/**
 * 处理条件表达式，转换为 branch 调用
 * 该函数接收一个条件表达式节点和转换上下文，将其转换为二元分支调用
 * @param node - 条件表达式节点，包含测试条件、 consequent 和 alternate 分支
 * @param ctx - 转换上下文，包含转换过程中需要的辅助信息和工具函数
 * @returns 返回一个调用表达式，表示转换后的分支逻辑
 */
function processConditionalExpression(
  node: t.ConditionalExpression, // 条件表达式节点，包含 test、consequent 和 alternate 属性
  ctx: TransformContext // 转换上下文，提供转换过程中需要的辅助方法和状态
): t.CallExpression {
  // 返回一个调用表达式，表示分支逻辑
  // 解构条件表达式节点的三个主要部分：测试条件、真分支和假分支
  const { test, consequent, alternate } = node

  // 处理真分支，如果处理结果为空则使用 null 字面量作为默认值
  const processedConsequent = processBranchExpression(consequent, ctx) || t.nullLiteral()
  // 处理假分支，如果处理结果为空则使用 null 字面量作为默认值
  const processedAlternate = processBranchExpression(alternate, ctx) || t.nullLiteral()

  // 创建并返回一个二元分支调用，传入测试条件、处理后的真分支和假分支
  return createBinaryBranch(test, processedConsequent, processedAlternate, ctx)
}
