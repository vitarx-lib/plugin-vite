/**
 * 指令处理模块
 * 处理 v-show 等指令
 * @module passes/directives/processDirectives
 */
import * as t from '@babel/types'
import { isIdentifier } from '@babel/types'
import { markImport, TransformContext } from '../../context.js'
import type { DirectiveInfo } from '../../passes/props/types.js'
import { addPureComment, createWithDirectivesCall, getAlias } from '../../utils/index.js'

/**
 * 处理指令
 * 将指令转换为 withDirectives 调用
 * @param viewCall - 视图调用表达式
 * @param directives - 指令映射
 * @param ctx - 转换上下文
 * @returns 处理后的调用表达式
 */
export function processDirectives(
  viewCall: t.CallExpression, // 视图调用的表达式，表示要应用指令的视图节点
  directives: Map<string, DirectiveInfo>, // 指令映射表，键为指令名（如'v-if'），值为指令信息
  ctx: TransformContext // 转换上下文，包含转换过程中的各种信息和工具函数
): t.CallExpression {
  // 返回处理后的调用表达式，即应用了指令的视图节点
  // 如果没有指令，直接返回原始视图调用表达式
  if (directives.size === 0) {
    return viewCall
  }

  // 创建指令数组，用于存储处理后的指令信息
  const directiveArray: Array<[string, t.Expression]> = []

  // 遍历指令映射表，处理每个指令
  for (const [name, info] of directives) {
    const directiveName = name.slice(2) // 移除 'v-' 前缀
    const directiveValue = buildDirectiveValue(info.value, info.arg, ctx)
    directiveArray.push([directiveName, directiveValue])
  }

  markImport(ctx, 'withDirectives')
  const withDirectivesAlias = getAlias(ctx.vitarxAliases, 'withDirectives')
  return addPureComment(
    createWithDirectivesCall(viewCall, directiveArray, withDirectivesAlias),
    ctx
  )
}

/**
 * 构建指令值对象
 * 该函数用于创建一个包含指令值和参数的对象表达式
 * @param value - 指令的值表达式
 * @param arg - 指令的参数，可选
 * @param ctx - 转换上下文对象，包含转换过程中需要的信息
 * @returns 返回一个对象表达式，包含value和可能的arg属性
 */
function buildDirectiveValue(
  value: t.Expression, // 表达式类型的值，可以是标识符、字面量等
  arg: string | undefined, // 指令参数，可选字符串
  ctx: TransformContext // 转换上下文，包含别名、导入等信息
): t.Expression {
  // 返回一个表达式类型的对象
  const properties: (t.ObjectProperty | t.ObjectMethod)[] = [] // 定义对象属性数组，可以是属性或方法

  // 添加 value 属性
  if (isIdentifier(value)) {
    // 如果值是一个标识符
    markImport(ctx, 'unref') // 标记需要导入unref函数
    const unrefAlias = getAlias(ctx.vitarxAliases, 'unref') // 获取unref函数的别名
    properties.push(
      // 添加一个getter方法作为属性
      t.objectMethod(
        'get', // 方法类型为getter
        t.identifier('value'), // 属性名为value
        [], // 无参数
        t.blockStatement([t.returnStatement(t.callExpression(t.identifier(unrefAlias), [value]))]) // 返回unref(value)
      )
    )
  } else {
    // 如果值不是标识符
    properties.push(
      // 直接添加一个getter方法返回值
      t.objectMethod('get', t.identifier('value'), [], t.blockStatement([t.returnStatement(value)]))
    )
  }

  // 添加 arg 属性
  if (arg) {
    // 如果存在参数
    properties.push(t.objectProperty(t.identifier('arg'), t.stringLiteral(arg))) // 添加arg属性，值为字符串字面量
  }

  return t.objectExpression(properties) // 返回包含所有属性的对象表达式
}
