/**
 * 属性处理模块
 * 负责处理 JSX 元素的各类属性，包括普通属性、展开属性、命名空间属性等
 * @module passes/props/attribute
 */
import * as t from '@babel/types'
import {
  isBooleanLiteral,
  isIdentifier,
  isJSXExpressionContainer,
  isMemberExpression,
  isNumericLiteral,
  isStringLiteral
} from '@babel/types'
import { markImport, TransformContext } from '../../context.js'
import { createError } from '../../error.js'
import { createAccessorCall, getAlias } from '../../utils/index.js'
import type { AttributeResult } from './types.js'

/**
 * 处理展开属性 {...props}
 * 将展开属性转换为 v-bind 特殊属性格式
 * @param attr - JSX 展开属性节点
 * @param hasVBind - 是否已存在 v-bind
 * @param node - JSX 元素节点（用于错误定位）
 * @returns 转换后的属性对象，或 null（如果已存在 v-bind）
 * @throws {Error} E001 - 当已存在 v-bind 时抛出
 */
export function processSpreadAttribute(
  attr: t.JSXSpreadAttribute,
  hasVBind: boolean,
  node: t.JSXElement
): { property: t.ObjectProperty; hasVBind: boolean } | null {
  // 不允许多个 v-bind
  if (hasVBind) {
    throw createError('E001', node)
  }
  return {
    property: t.objectProperty(t.stringLiteral('v-bind'), attr.argument),
    hasVBind: true
  }
}

/**
 * 处理命名空间属性
 *
 * @param attr - JSX 属性节点
 * @param attrName - 命名空间名称
 * @param existingPropNames - 已存在的属性名集合
 * @param ctx - 转换上下文
 * @returns 属性处理结果
 */
function processNamespacedAttribute(
  attr: t.JSXAttribute,
  attrName: t.JSXNamespacedName,
  existingPropNames: Set<string>,
  ctx: TransformContext
): AttributeResult {
  const namespace = attrName.namespace.name
  const name = attrName.name.name
  const fullName = `${namespace}:${name}`
  const value = getAttributeValue(attr.value)

  // v-xxx:arg 格式的带参数指令 (如 v-test:t)
  if (namespace.startsWith('v-')) {
    const directiveName = namespace

    // 排除 v-if 系列和 v-model
    if (!['v-if', 'v-else-if', 'v-else', 'v-model', 'v-bind'].includes(directiveName)) {
      return {
        type: 'directive',
        name: directiveName,
        value,
        isVBind: false,
        isVModel: false,
        arg: name
      }
    }
  }

  // 其他命名空间属性作为普通属性处理
  existingPropNames.add(fullName)
  const property = createProperty(fullName, value, ctx)
  return { type: 'property', property }
}

/**
 * 获取属性值表达式
 * 处理不同类型的属性值，统一返回表达式
 * @param value - JSX 属性值
 * @returns 表达式节点
 */
export function getAttributeValue(value: t.JSXAttribute['value']): t.Expression {
  if (!value) {
    return t.booleanLiteral(true)
  }

  if (isStringLiteral(value)) {
    return value
  }

  if (isJSXExpressionContainer(value)) {
    if (value.expression.type === 'JSXEmptyExpression') {
      return t.booleanLiteral(true)
    }
    return value.expression as t.Expression
  }

  return value
}

/**
 * 创建对象属性节点
 * 静态值直接赋值，动态值生成 getter 方法
 *
 * 特殊处理：
 * - children 属性不使用 unref，因为 ref 作为 children 是合法的可变渲染源
 * - 其他标识符属性使用 unref 解包
 *
 * @param key - 属性名
 * @param value - 属性值表达式
 * @param ctx - 转换上下文
 * @returns 对象属性或方法节点
 */
export function createProperty(
  key: string, // 属性名称字符串
  value: t.Expression, // 属性值的表达式，可以是各种类型的表达式
  ctx: TransformContext // 转换上下文对象，包含转换所需的各种信息和工具函数
): t.ObjectProperty | t.ObjectMethod {
  // 返回类型，可以是对象属性或对象方法
  // 创建属性名的字符串字面量节点
  const keyNode = t.stringLiteral(key)

  // 如果值是字符串、数字或布尔字面量，直接创建对象属性
  if (isStringLiteral(value) || isNumericLiteral(value) || isBooleanLiteral(value)) {
    return t.objectProperty(keyNode, value)
  }

  // 如果值是标识符
  if (isIdentifier(value)) {
    // 检查标识符是否是 ref 变量
    if (ctx.refVariables.has(value.name)) {
      // 如果是 ref 变量，创建一个 getter 方法来访问其 value 属性
      return t.objectMethod(
        'get',
        keyNode,
        [],
        t.blockStatement([t.returnStatement(t.memberExpression(value, t.identifier('value')))])
      )
    }

    // 特殊处理 children 属性，不使用 unref
    if (key === 'children') {
      return t.objectProperty(keyNode, value)
    }

    // 标记需要导入 unref 函数
    markImport(ctx, 'unref')
    // 获取 unref 函数的别名
    const unrefAlias = getAlias(ctx.vitarxAliases, 'unref')
    // 创建 getter 方法，使用 unref 解包属性值
    return t.objectMethod(
      'get',
      keyNode,
      [],
      t.blockStatement([t.returnStatement(t.callExpression(t.identifier(unrefAlias), [value]))])
    )
  }

  // 如果值是成员表达式，创建 accessor 调用
  if (isMemberExpression(value)) {
    // 标记需要导入 accessor 函数
    markImport(ctx, 'accessor')
    // 获取 accessor 函数的别名
    const accessorAlias = getAlias(ctx.vitarxAliases, 'accessor')
    // 创建属性节点，使用 accessor 处理成员表达式
    return t.objectProperty(
      keyNode,
      createAccessorCall(value.object, value.property as t.Expression, accessorAlias)
    )
  }

  // 默认情况下创建 getter 方法直接返回值
  return t.objectMethod('get', keyNode, [], t.blockStatement([t.returnStatement(value)]))
}

/**
 * 处理单个 JSX 属性
 * 根据属性名类型分发到不同的处理逻辑
 * @param attr - JSX 属性节点
 * @param existingPropNames - 已存在的属性名集合
 * @param ctx - 转换上下文
 * @returns - 属性处理结果
 */
export function processAttribute(
  attr: t.JSXAttribute,
  existingPropNames: Set<string>,
  ctx: TransformContext
): AttributeResult {
  const attrName = attr.name

  // 处理命名空间属性 (v:xxx)
  if (attrName.type === 'JSXNamespacedName') {
    return processNamespacedAttribute(attr, attrName, existingPropNames, ctx)
  }

  // 处理标识符属性
  if (attrName.type === 'JSXIdentifier') {
    const name = attrName.name

    // v-bind 指令
    if (name === 'v-bind') {
      const value = getAttributeValue(attr.value)
      return { type: 'directive', name: 'v-bind', value, isVBind: true, isVModel: false }
    }

    // v-model 指令
    if (name === 'v-model') {
      const value = getAttributeValue(attr.value)
      return { type: 'directive', name: 'v-model', value, isVBind: false, isVModel: true }
    }

    // 其他 v- 指令（排除 v-if 系列，它们在单独的处理流程中）
    if (name.startsWith('v-') && !['v-if', 'v-else-if', 'v-else'].includes(name)) {
      const value = getAttributeValue(attr.value)
      return { type: 'directive', name, value, isVBind: false, isVModel: false }
    }

    // 普通属性
    existingPropNames.add(name)
    const value = getAttributeValue(attr.value)
    const property = createProperty(name, value, ctx)
    return { type: 'property', property }
  }

  // 未知属性类型，作为普通属性处理
  throw createError('E002', attr, 'Unsupported attribute name type')
}
