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
import { getAlias } from '../../utils/index.js'
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
  value: t.Expression, // 属性值的表达式节点
  ctx: TransformContext // 转换上下文对象，包含转换所需的环境信息
): t.ObjectProperty | t.ObjectMethod {
  // 返回对象属性或方法节点
  // 创建属性名的字面量节点
  const keyNode = t.stringLiteral(key)

  // 处理静态值：字符串、数字、布尔值和null字面量
  if (
    isStringLiteral(value) || // 检查是否为字符串字面量
    isNumericLiteral(value) || // 检查是否为数字字面量
    isBooleanLiteral(value) || // 检查是否为布尔值字面量
    t.isNullLiteral(value) // 检查是否为null字面量
  ) {
    // 对于静态值，直接创建对象属性节点
    return t.objectProperty(keyNode, value)
  }

  // 处理标识符类型的值
  if (isIdentifier(value)) {
    // 如果值是标识符且在引用变量集合中
    if (ctx.refVariables.has(value.name)) {
      // 创建getter方法，返回引用的value属性
      return createGetter(
        keyNode,
        t.returnStatement(t.memberExpression(value, t.identifier('value')))
      )
    }
    // 特殊处理children属性
    if (key === 'children') {
      // children属性不使用unref，保持原样
      return t.objectProperty(keyNode, value)
    }
    // 其他标识符属性创建unref getter
    return createUnrefGetter(keyNode, value, ctx)
  }

  // 处理成员表达式类型的值
  if (isMemberExpression(value)) {
    // 创建unref getter处理成员表达式
    return createUnrefGetter(keyNode, value, ctx)
  }

  // 默认情况：创建getter方法返回原始值
  return createGetter(keyNode, t.returnStatement(value))
}

/**
 * 创建一个getter方法
 * @param keyNode - 属性键的字符串字面量节点
 * @param statement - getter方法体中的语句
 * @returns 返回一个ObjectMethod类型的AST节点，表示一个getter方法
 */
function createGetter(keyNode: t.StringLiteral, statement: t.Statement): t.ObjectMethod {
  // 使用objectMethod方法创建一个getter方法
  // 参数分别为: 方法类型('get')、属性键、参数数组(空数组)、方法体(包含传入的语句)
  return t.objectMethod('get', keyNode, [], t.blockStatement([statement]))
}

/**
 * 创建一个getter方法，该方法会对返回值进行unref处理
 * @param keyNode - 对象的键节点，是一个字符串字面量
 * @param value - 需要进行unref处理的值表达式
 * @param ctx - 转换上下文对象，包含转换所需的各种信息和工具函数
 * @returns 返回一个ObjectMethod类型的AST节点，表示一个getter方法
 */
function createUnrefGetter(
  keyNode: t.StringLiteral, // 对象的键，使用字符串字面量表示
  value: t.Expression, // 需要进行unref处理的值表达式
  ctx: TransformContext // 转换上下文，包含转换所需的各种信息和工具函数
): t.ObjectMethod {
  // 返回一个对象方法类型的AST节点
  markImport(ctx, 'unref') // 标记需要导入unref函数
  const unrefAlias = getAlias(ctx.vitarxAliases, 'unref') // 获取unref函数的别名
  return createGetter(
    // 创建并返回一个getter方法
    keyNode,
    t.returnStatement(t.callExpression(t.identifier(unrefAlias), [value])) // 返回对value进行unref处理后的结果
  )
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
