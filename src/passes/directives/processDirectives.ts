/**
 * 指令处理模块
 * 处理 v-show 等指令
 * @module passes/directives/processDirectives
 */
import * as t from '@babel/types'
import { isIdentifier } from '@babel/types'
import { markImport, TransformContext } from '../../context.js'
import { addPureComment, createWithDirectivesCall, getAlias } from '../../utils/index.js'
import type { DirectiveInfo } from '../../passes/props/types.js'

/**
 * 处理指令
 * 将指令转换为 withDirectives 调用
 * @param viewCall - 视图调用表达式
 * @param directives - 指令映射
 * @param ctx - 转换上下文
 * @returns 处理后的调用表达式
 */
export function processDirectives(
  viewCall: t.CallExpression,
  directives: Map<string, DirectiveInfo>,
  ctx: TransformContext
): t.CallExpression {
  if (directives.size === 0) {
    return viewCall
  }

  const directiveArray: Array<[string, t.Expression]> = []

  for (const [name, info] of directives) {
    const directiveName = name.slice(2) // 移除 'v-' 前缀
    const directiveValue = buildDirectiveValue(info.value, info.arg, ctx)
    directiveArray.push([directiveName, directiveValue])
  }

  markImport(ctx, 'withDirectives')
  const withDirectivesAlias = getAlias(ctx.vitarxAliases, 'withDirectives')
  return addPureComment(createWithDirectivesCall(viewCall, directiveArray, withDirectivesAlias), ctx)
}

/**
 * 构建指令值对象
 */
function buildDirectiveValue(
  value: t.Expression,
  arg: string | undefined,
  ctx: TransformContext
): t.Expression {
  const properties: (t.ObjectProperty | t.ObjectMethod)[] = []

  // 添加 value 属性
  if (isIdentifier(value)) {
    markImport(ctx, 'unref')
    const unrefAlias = getAlias(ctx.vitarxAliases, 'unref')
    properties.push(
      t.objectMethod(
        'get',
        t.identifier('value'),
        [],
        t.blockStatement([t.returnStatement(t.callExpression(t.identifier(unrefAlias), [value]))])
      )
    )
  } else {
    properties.push(
      t.objectMethod('get', t.identifier('value'), [], t.blockStatement([t.returnStatement(value)]))
    )
  }

  // 添加 arg 属性
  if (arg) {
    properties.push(t.objectProperty(t.identifier('arg'), t.stringLiteral(arg)))
  }

  return t.objectExpression(properties)
}
