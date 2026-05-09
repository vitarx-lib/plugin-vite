/**
 * JSX 元素处理模块
 * 将 JSX 元素转换为 createView 调用
 * @module passes/jsx/processJSXElement
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXElement } from '@babel/types'
import { addWarning, markImport, TransformContext } from '../../context.js'
import { createError, createWarning } from '../../error.js'
import {
  addPureComment,
  createArrowFunction,
  createBranch,
  createCreateViewCall,
  filterEffectiveChildren,
  getAlias,
  getDevLocInfo,
  getDirectiveValue,
  getJSXAttributeByName,
  getJSXElementName,
  hasEffectiveChildren,
  isVElse,
  isVIf,
  isVIfChain,
  removeVIfChainDirectives,
  resolveJSXElementType
} from '../../utils/index.js'
import { processDirectives, transformChildrenVIfChains } from '../directives/index.js'
import { processProps } from '../props/index.js'
import { processChildren } from './processChildren.js'

/**
 * 处理 JSX 元素
 * @param path - JSX 元素路径
 * @param ctx - 转换上下文
 */
export function processJSXElement(path: NodePath<t.JSXElement>, ctx: TransformContext): void {
  const name = getJSXElementName(path.node)

  // 校验 Match 必须在 Switch 内使用
  if (name === 'Match') {
    validateMatchInSwitch(path)
  }

  const result = transformJSXElement(path.node, ctx, true)
  if (result) {
    path.replaceWith(result)
  }
}

/**
 * 校验 Match 组件必须在 Switch 内使用
 */
function validateMatchInSwitch(path: NodePath<t.JSXElement>): void {
  let current: NodePath<t.Node> | null = path.parentPath
  while (current) {
    if (current.node.type === 'JSXElement') {
      const name = getJSXElementName(current.node)
      if (name === 'Switch') return
    }
    current = current.parentPath
  }
  throw createError('E012', path.node)
}

/**
 * 转换 JSX 元素为表达式
 * @param node - JSX 元素节点
 * @param ctx - 转换上下文
 * @param handleVIf - 是否处理 v-if 指令
 * @returns 转换后的表达式
 */
export function transformJSXElement(
  node: t.JSXElement,
  ctx: TransformContext,
  handleVIf: boolean = false
): t.Expression | null {
  // 处理 v-if 链
  if (handleVIf && isVIfChain(node)) {
    if (isVIf(node)) {
      return transformSingleVIf(node, ctx)
    } else {
      throw createError(isVElse(node) ? 'E003' : 'E004', node)
    }
  }

  // 解析 JSX 元素类型
  const type = resolveJSXElementType(node)
  if (!type) return null

  // 检测是否有有效子元素
  const hasChildren = hasEffectiveChildren(node)

  // 处理属性（有子元素时跳过 children 属性）
  const { props, directives } = processProps(node, ctx, hasChildren)

  // 处理子元素
  const finalProps = processElementChildren(node, props, ctx)

  // 生成 createView 调用
  markImport(ctx, 'createView')
  const createViewAlias = getAlias(ctx.vitarxAliases, 'createView')
  const locInfo = getDevLocInfo(ctx, node)

  let viewCall = createCreateViewCall(type, finalProps, locInfo, createViewAlias)

  // 处理指令
  if (directives.size > 0) {
    viewCall = processDirectives(viewCall, directives, ctx)
  } else {
    viewCall = addPureComment(viewCall, ctx)
  }

  if (node.loc) {
    viewCall.loc = node.loc
  }

  return viewCall
}

/**
 * 处理元素的子元素
 * 子元素优先于 children 属性，同时发出警告
 */
function processElementChildren(
  node: t.JSXElement,
  props: t.ObjectExpression | null,
  ctx: TransformContext
): t.ObjectExpression | null {
  // 过滤有效子元素
  const children = filterEffectiveChildren(node)

  if (children.length === 0) {
    return props
  }

  // 检查是否存在 children 属性
  const childrenAttr = getJSXAttributeByName(node, 'children')
  if (childrenAttr) {
    // 发出警告：children 属性和子元素同时存在
    addWarning(ctx, createWarning('W001', childrenAttr))
  }

  // 校验 Match 组件必须在 Switch 内使用
  // 当前元素不是 Switch 时，检查子元素中是否有 Match
  const currentName = getJSXElementName(node)
  if (currentName !== 'Switch') {
    for (const child of children) {
      if (isJSXElement(child)) {
        const childName = getJSXElementName(child as t.JSXElement)
        if (childName === 'Match') {
          throw createError('E012', child as t.JSXElement)
        }
      }
    }
  }

  // 处理子元素中的 v-if 链（确保嵌套链在 transformJSXElement 递归调用时被正确处理）
  const chainProcessed = transformChildrenVIfChains(children, ctx, transformJSXElement)

  // 处理子元素
  const processedChildren = processChildren(chainProcessed, ctx)
  const childrenValue =
    processedChildren.length === 1 ? processedChildren[0] : t.arrayExpression(processedChildren)

  // 添加 children 属性
  if (props) {
    props.properties.push(t.objectProperty(t.identifier('children'), childrenValue))
    return props
  }

  return t.objectExpression([t.objectProperty(t.identifier('children'), childrenValue)])
}

/**
 * 转换单个 v-if 元素
 * 该函数处理带有 v-if 指令的 JSX 元素，将其转换为条件渲染的函数调用
 * @param node - 要转换的 JSX 元素节点
 * @param ctx - 转换上下文，包含转换所需的环境信息
 * @returns 返回转换后的条件渲染函数调用表达式，如果转换失败则返回 null
 */
function transformSingleVIf(node: t.JSXElement, ctx: TransformContext): t.CallExpression | null {
  // 首先检查节点是否是有效的 v-if 元素
  if (!isVIf(node)) return null

  // 获取 v-if 指令的值（条件表达式）
  const condition = getDirectiveValue(node, 'v-if')
  // 如果没有找到条件表达式，则返回 null
  if (!condition) return null

  // 移除节点上的 v-if 相关指令链
  removeVIfChainDirectives(node)

  // 转换 JSX 元素，不保留原始属性
  const transformedNode = transformJSXElement(node, ctx, false)
  // 如果转换失败，返回 null
  if (!transformedNode) return null

  // 创建条件分支的函数调用
  const branchCall = createBranch(
    // 包含条件数组和对应的分支函数
    { conditions: [condition], branches: [createArrowFunction(transformedNode)] },
    ctx
  )

  // 保留原始节点的位置信息
  if (node.loc) {
    branchCall.loc = node.loc
  }

  // 返回转换后的分支函数调用
  return branchCall
}
