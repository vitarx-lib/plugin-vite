/**
 * AST 节点构建函数
 * 提供各类运行时 API 调用的创建辅助函数
 * @module utils/ast-builders
 */
import * as t from '@babel/types'
import {
  type ArrowFunctionExpression,
  type CallExpression,
  type Expression,
  isIdentifier,
  type ObjectExpression
} from '@babel/types'
import type { SourceLocation } from 'acorn'
import { PURE_COMMENT } from '../constants/index.js'
import type { TransformContext, VitarxImportAliases } from '../context.js'

/**
 * 创建 unref 调用表达式
 * @param argument - 需要解包的表达式
 * @param alias - unref 的本地别名
 * @returns unref(arg) 调用表达式
 */
export function createUnrefCall(argument: Expression, alias?: string): CallExpression {
  // 使用别名或默认名称创建标识符
  return t.callExpression(t.identifier(alias || 'unref'), [argument])
}

/**
 * 创建 accessor 调用表达式
 * 用于细粒度响应式追踪，只追踪对象的特定属性
 * @param object - 对象表达式
 * @param key - 属性键表达式
 * @param alias - accessor 的本地别名
 * @returns accessor(obj, key) 调用表达式
 */
export function createAccessorCall(
  object: Expression,
  key: Expression,
  alias?: string
): CallExpression {
  // 如果键是标识符，转换为字符串字面量；否则保持原样
  const keyArg = isIdentifier(key) ? t.stringLiteral(key.name) : key

  return t.callExpression(t.identifier(alias || 'accessor'), [object, keyArg])
}

/**
 * 创建 expr 调用表达式
 * 用于粗粒度响应式追踪，包装任意表达式
 * @param argument - 需要包装的表达式
 * @param alias - expr 的本地别名
 * @returns expr(() => arg) 调用表达式
 */
export function createExprCall(argument: Expression, alias?: string): CallExpression {
  // 将表达式包装在箭头函数中传递给 expr
  return t.callExpression(t.identifier(alias || 'expr'), [t.arrowFunctionExpression([], argument)])
}

/**
 * 创建 branch 调用表达式
 * 用于条件分支渲染，支持多分支选择
 * @param condition - 返回分支索引的箭头函数
 * @param branches - 分支函数数组
 * @param alias - branch 的本地别名
 * @returns branch(condition, [branches]) 调用表达式
 */
export function createBranchCall(
  condition: ArrowFunctionExpression,
  branches: ArrowFunctionExpression[],
  alias?: string
): CallExpression {
  return t.callExpression(t.identifier(alias || 'branch'), [condition, t.arrayExpression(branches)])
}

/**
 * 创建 createView 调用表达式
 * 这是核心的视图创建函数，将 JSX 转换为运行时调用
 * @param type - 元素类型（字符串表示原生元素，标识符表示组件）
 * @param props - 属性对象表达式
 * @param locInfo - 开发环境下的位置信息（用于错误定位）
 * @param alias - createView 的本地别名
 * @returns createView(type, props?, locInfo?) 调用表达式
 */
export function createCreateViewCall(
  type: Expression,
  props: ObjectExpression | null,
  locInfo?: ObjectExpression | null,
  alias?: string
): CallExpression {
  const args: Expression[] = [type]

  // 根据参数情况构建调用参数
  if (props) {
    args.push(props)
  } else if (locInfo) {
    // 有位置信息但无 props 时，props 位置传 null
    args.push(t.nullLiteral())
  }

  // 添加位置信息（仅开发环境）
  if (locInfo) {
    args.push(locInfo)
  }

  return t.callExpression(t.identifier(alias || 'createView'), args)
}

/**
 * 创建 withDirectives 调用表达式
 * 用于为视图节点添加自定义指令
 * @param view - 视图节点表达式
 * @param directives - 指令数组，每项为 [指令名, 指令值] 元组
 * @param alias - withDirectives 的本地别名
 * @returns withDirectives(view, [[name, value], ...]) 调用表达式
 */
export function createWithDirectivesCall(
  view: Expression,
  directives: Array<[string, Expression]>,
  alias?: string
): CallExpression {
  // 将指令数组转换为嵌套数组表达式
  const directiveArray = directives.map(([name, value]) => {
    return t.arrayExpression([t.stringLiteral(name), value])
  })

  return t.callExpression(t.identifier(alias || 'withDirectives'), [
    view,
    t.arrayExpression(directiveArray)
  ])
}

/**
 * 创建无参数箭头函数
 * @param body - 函数体表达式
 * @returns () => body 箭头函数表达式
 */
export function createArrowFunction(body: Expression): ArrowFunctionExpression {
  return t.arrowFunctionExpression([], body)
}

/**
 * 为调用表达式添加 @__PURE__ 注释
 * 标记纯函数调用，帮助 Tree Shaking 优化
 * @param node - 调用表达式节点
 * @param ctx - 转换上下文（用于去重）
 * @returns 添加注释后的节点（可能是原节点）
 */
export function addPureComment<T extends CallExpression>(node: T, ctx: TransformContext): T {
  // 避免重复添加注释
  if (ctx.pureCommentedNodes.has(node)) {
    return node
  }
  ctx.pureCommentedNodes.add(node)
  // 在节点前添加注释
  t.addComment(node, 'leading', ` ${PURE_COMMENT} `, false)
  return node
}

/**
 * 获取 API 的本地别名
 * @param aliases - 别名映射对象
 * @param name - API 原始名称
 * @returns 本地别名或原始名称
 */
export function getAlias(aliases: VitarxImportAliases, name: keyof VitarxImportAliases): string {
  return aliases[name] || name
}

/**
 * 创建源码位置信息对象
 * 用于开发环境下的错误定位
 * @param filename - 当前文件名
 * @param loc - 源码位置信息
 * @returns 位置信息对象 { fileName, lineNumber, columnNumber }
 */
export function createLocationObject(filename: string, loc: SourceLocation): ObjectExpression {
  return t.objectExpression([
    t.objectProperty(t.identifier('fileName'), t.stringLiteral(filename)),
    t.objectProperty(t.identifier('lineNumber'), t.numericLiteral(loc.start.line)),
    // 列号从 1 开始（与编辑器一致）
    t.objectProperty(t.identifier('columnNumber'), t.numericLiteral(loc.start.column + 1))
  ])
}

/**
 * 获取开发环境下的位置信息对象
 * 仅在开发模式且节点有位置信息时返回
 * @param ctx - 转换上下文
 * @param node - AST 节点或包含 loc 属性的对象
 * @returns 位置信息对象或 null
 */
export function getDevLocInfo(
  ctx: TransformContext,
  node: t.Node | { loc: t.SourceLocation | null }
): ObjectExpression | null {
  // 仅开发模式且有位置信息时创建
  return ctx.options.dev && node.loc ? createLocationObject(ctx.filename, node.loc) : null
}
