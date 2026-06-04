/**
 * JSX 相关工具函数
 * 提供 JSX 元素的各种操作和判断方法
 * @module utils/jsx-helpers
 */
import * as t from '@babel/types'
import {
  type Expression,
  isJSXElement,
  isJSXText,
  type JSXAttribute,
  type JSXElement
} from '@babel/types'
import {
  DIRECTIVE_PREFIX,
  PURE_COMPILE_COMPONENTS,
  V_IF_CHAIN_DIRECTIVES
} from '../constants/index.js'
import { createError } from '../error.js'
import { isWhitespaceJSXText } from './ast-guards.js'

/**
 * 获取 JSX 元素的名称
 * @param node - JSX 元素节点
 * @returns 元素名称（Identifier）或 null（MemberExpression）
 */
export function getJSXElementName(node: JSXElement): string | null {
  const nameNode = node.openingElement.name
  // 只处理简单标识符，MemberExpression 返回 null
  return nameNode.type === 'JSXIdentifier' ? nameNode.name : null
}

/**
 * 将 JSX 元素名称节点转换为 createView 的类型表达式
 * JSXIdentifier → Identifier（组件）或 StringLiteral（原生元素）
 * JSXMemberExpression → MemberExpression（如 Obj.Key → Obj.Key）
 * @param node - JSX 元素节点
 * @returns 类型表达式或 null
 */
export function resolveJSXElementType(node: JSXElement): t.Expression | null {
  const nameNode = node.openingElement.name

  // 处理简单标识符（如 <div> 或 <Component>）
  if (nameNode.type === 'JSXIdentifier') {
    const name = nameNode.name
    // 原生元素转为字符串，组件转为标识符
    return isNativeElement(name) ? t.stringLiteral(name) : t.identifier(name)
  }

  // 处理成员表达式（如 <Obj.Key>）
  if (nameNode.type === 'JSXMemberExpression') {
    return jsxMemberExprToMemberExpr(nameNode)
  }

  return null
}

/**
 * 递归转换 JSXMemberExpression 为 MemberExpression
 * Obj.Key → Obj.Key, A.B.C → A.B.C
 * @param node - JSXMemberExpression 节点
 * @returns MemberExpression 节点
 */
function jsxMemberExprToMemberExpr(node: t.JSXMemberExpression): t.MemberExpression {
  // 递归处理对象部分
  const object =
    node.object.type === 'JSXMemberExpression'
      ? jsxMemberExprToMemberExpr(node.object)
      : t.identifier((node.object as t.JSXIdentifier).name)
  return t.memberExpression(object, t.identifier(node.property.name))
}

/**
 * 判断名称是否为纯编译组件
 * 纯编译组件在编译时完全展开，不会生成运行时调用
 * @param name - 元素名称
 * @returns 是否为纯编译组件
 */
export function isPureCompileComponent(name: string): boolean {
  return PURE_COMPILE_COMPONENTS.includes(name as any)
}

/**
 * 判断名称是否为组件（首字母大写）
 * 遵循 React/Vue 的组件命名约定
 * @param name - 元素名称
 * @returns 是否为组件
 */
export function isComponent(name: string): boolean {
  return name.length > 0 && name[0] === name[0].toUpperCase()
}

/**
 * 判断名称是否为原生元素
 * 原生元素使用小写字母开头
 * @param name - 元素名称
 * @returns 是否为原生元素
 */
export function isNativeElement(name: string): boolean {
  return !isComponent(name)
}

/**
 * 根据名称获取 JSX 属性
 */
export function getJSXAttributeByName(node: JSXElement, name: string): JSXAttribute | undefined {
  for (const attr of node.openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name
    ) {
      return attr
    }
  }
  return undefined
}

/**
 * 检查元素是否具有指定指令
 * v-if/v-else-if/v-else 仅支持 JSXIdentifier 格式（v-if），不支持命名空间格式（v:if）
 * 其他指令（如 v-show）支持 v-xxx:arg 命名空间格式
 */
export function hasDirective(node: JSXElement, directiveName: string): boolean {
  for (const attr of node.openingElement.attributes) {
    if (attr.type === 'JSXAttribute') {
      const attrName = attr.name
      if (attrName.type === 'JSXNamespacedName') {
        if (V_IF_CHAIN_DIRECTIVES.has(directiveName)) continue
        if (attrName.namespace.name === 'v' && attrName.name.name === directiveName.slice(2)) {
          return true
        }
      } else if (attrName.type === 'JSXIdentifier' && attrName.name === directiveName) {
        return true
      }
    }
  }
  return false
}

/**
 * 获取指令的值
 * v-if/v-else-if/v-else 仅支持 JSXIdentifier 格式（v-if），不支持命名空间格式（v:if）
 */
export function getDirectiveValue(node: JSXElement, directiveName: string): Expression | null {
  for (const attr of node.openingElement.attributes) {
    if (attr.type === 'JSXAttribute') {
      const attrName = attr.name
      let matches = false
      if (attrName.type === 'JSXNamespacedName') {
        if (V_IF_CHAIN_DIRECTIVES.has(directiveName)) continue
        matches = attrName.namespace.name === 'v' && attrName.name.name === directiveName.slice(2)
      } else if (attrName.type === 'JSXIdentifier') {
        matches = attrName.name === directiveName
      }
      if (matches) {
        const value = attr.value
        if (value?.type === 'JSXExpressionContainer') {
          return value.expression as Expression
        }
        if (value?.type === 'StringLiteral') {
          return value
        }
        return t.booleanLiteral(true)
      }
    }
  }
  return null
}

/**
 * 检查元素是否为 v-if 链的一部分
 */
export function isVIfChain(node: JSXElement): boolean {
  return (
    hasDirective(node, 'v-if') || hasDirective(node, 'v-else-if') || hasDirective(node, 'v-else')
  )
}

/**
 * 检查元素是否有 v-if 指令
 */
export function isVIf(node: JSXElement): boolean {
  return hasDirective(node, 'v-if')
}

/**
 * 检查元素是否有 v-else-if 指令
 */
export function isVElseIf(node: JSXElement): boolean {
  return hasDirective(node, 'v-else-if')
}

/**
 * 检查元素是否有 v-else 指令
 */
export function isVElse(node: JSXElement): boolean {
  return hasDirective(node, 'v-else')
}

/**
 * 移除元素上所有 v- 开头的指令属性
 */
export function removeVDirectives(node: JSXElement): void {
  node.openingElement.attributes = node.openingElement.attributes.filter(attr => {
    if (attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier') {
      return !attr.name.name.startsWith(DIRECTIVE_PREFIX)
    }
    return true
  })
}

/**
 * 移除元素上的 v-if 链指令（v-if、v-else-if、v-else）
 * 仅处理 JSXIdentifier 格式，不支持命名空间格式（v:if）
 */
export function removeVIfChainDirectives(node: JSXElement): void {
  node.openingElement.attributes = node.openingElement.attributes.filter(attr => {
    if (attr.type === 'JSXAttribute') {
      const attrName = attr.name
      if (attrName.type === 'JSXIdentifier') {
        return !V_IF_CHAIN_DIRECTIVES.has(attrName.name)
      }
    }
    return true
  })
}

/**
 * 移除元素上指定名称的属性
 */
export function removeAttribute(node: JSXElement, attrName: string): void {
  const index = node.openingElement.attributes.findIndex(attr => {
    if (attr.type === 'JSXAttribute') {
      const name = attr.name
      if (name.type === 'JSXIdentifier') return name.name === attrName
      if (name.type === 'JSXNamespacedName') {
        return `${name.namespace.name}:${name.name.name}` === attrName
      }
    }
    return false
  })
  if (index !== -1) {
    node.openingElement.attributes.splice(index, 1)
  }
}

/**
 * 过滤掉空白文本子节点
 */
export function filterWhitespaceChildren(children: t.Node[]): t.Node[] {
  return children.filter(child => !isJSXText(child) || !isWhitespaceJSXText(child))
}

/**
 * 判断子节点是否为有效子元素
 * JSX 注释和纯空白文本视为无效
 * @param child - 子节点
 * @returns 是否有效
 */
function isEffectiveChild(child: t.Node): boolean {
  if (isJSXText(child)) {
    return child.value.trim().length > 0
  }
  if (child.type === 'JSXExpressionContainer') {
    return child.expression.type !== 'JSXEmptyExpression'
  }
  return true
}

/**
 * 检查 JSX 元素是否有有效的子元素
 * @param node - JSX 元素节点
 * @returns 是否有有效子元素
 */
export function hasEffectiveChildren(node: JSXElement): boolean {
  return node.children.some(isEffectiveChild)
}

/**
 * 过滤并返回有效的子元素
 * @param node - JSX 元素节点
 * @returns 有效子元素数组
 */
export function filterEffectiveChildren(node: JSXElement): t.Node[] {
  return node.children.filter(isEffectiveChild)
}

/**
 * 校验子节点中不能直接包含 Match 组件
 * Match 必须在 Switch 内使用，非 Switch 元素的子节点中不允许出现 Match
 * @param children - 子节点数组
 */
export function validateNoDirectMatchChild(children: t.Node[]): void {
  for (const child of children) {
    if (isJSXElement(child)) {
      const childName = getJSXElementName(child)
      if (childName === 'Match') {
        throw createError('E012', child)
      }
    }
  }
}
