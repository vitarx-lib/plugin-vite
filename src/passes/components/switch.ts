/**
 * Switch 组件处理器
 * 将 <Switch><Match when={cond}>...</Match></Switch> 编译为 branch 调用
 * @module passes/components/switch
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXElement, isJSXText } from '@babel/types'
import { TransformContext } from '../../context.js'
import { createError } from '../../error.js'
import {
  createArrowFunction,
  createBranch,
  getJSXAttributeByName,
  getJSXElementName
} from '../../utils/index.js'
import { getAttributeValue } from '../props/attribute.js'

/**
 * 处理 Switch 组件
 * @param path - JSX 元素路径
 * @param ctx - 转换上下文
 */
export function processSwitch(path: NodePath<t.JSXElement>, ctx: TransformContext): void {
  const children = path.node.children // 获取 Switch 组件的子节点

  // 获取 fallback 属性
  const fallbackValue = extractFallbackValue(path.node)

  // 收集 Match 子节点
  const matchNodes = collectMatchNodes(children)

  // 构建条件和分支
  const { conditions, branches } = buildConditionsAndBranches(matchNodes)

  // 添加 fallback 分支
  if (fallbackValue) {
    conditions.push(t.booleanLiteral(true)) // 添加一个总是为 true 的条件作为 fallback
    branches.push(createArrowFunction(fallbackValue)) // 将 fallback 值转换为箭头函数
  }

  // 生成 branch 调用
  // Switch 的 when 条件如果是标识符，需要 unref
  const branchCall = createBranch({ conditions, branches }, ctx)

  if (path.node.loc) {
    branchCall.loc = path.node.loc // 保留原始代码的位置信息
  }

  path.replaceWith(branchCall) // 用生成的 branch 调用替换原始的 Switch 元素
}

/**
 * 提取 fallback 属性值
 * 该函数用于从 JSX 元素节点中提取名为 'fallback' 的属性值
 * @param node - 要检查的 JSX 元素节点
 * @returns 返回找到的 fallback 属性的表达式值，如果没有找到则返回 null
 */
function extractFallbackValue(node: t.JSXElement): t.Expression | null {
  // 通过 getJSXAttributeByName 函数获取名为 'fallback' 的属性
  const fallbackAttr = getJSXAttributeByName(node, 'fallback')
  // 如果不存在 fallback 属性，则直接返回 null
  if (!fallbackAttr) return null
  // 如果存在 fallback 属性，则通过 getAttributeValue 函数提取其属性值并返回
  return getAttributeValue(fallbackAttr.value)
}

/**
 * 收集 Match 子节点
 * 该函数用于从给定的子节点数组中收集所有名为 "Match" 的 JSX 元素
 * @param children - 需要处理的子节点数组
 * @returns 返回包含所有 Match JSX 元素的数组
 * @throws 当子节点不是 Match 组件或没有 Match 组件时抛出错误
 */
function collectMatchNodes(children: t.Node[]): t.JSXElement[] {
  const matchNodes: t.JSXElement[] = [] // 用于存储收集到的 Match JSX 元素

  // 遍历所有子节点
  for (const child of children) {
    // 如果是文本节点，则跳过处理
    if (isJSXText(child)) continue

    // 检查子节点是否为 JSX 元素，如果不是则抛出错误
    if (!isJSXElement(child)) {
      throw createError('E006', child, 'Switch children must be Match components')
    }

    // 获取当前子节点的名称
    const childName = getJSXElementName(child)
    // 如果节点名称为 "Match"，则将其添加到结果数组中
    if (childName === 'Match') {
      matchNodes.push(child)
    } else {
      // 如果不是 Match 组件，则抛出错误
      throw createError('E006', child, `Invalid child "${childName}" in Switch`)
    }
  }

  // 检查是否至少有一个 Match 组件，如果没有则抛出错误
  if (matchNodes.length === 0) {
    throw createError('E015', undefined)
  }

  // 返回收集到的所有 Match 组件
  return matchNodes
}

/**
 * 构建条件数组和分支数组
 * 该函数接收一个 JSX 元素数组，提取每个元素的 when 属性作为条件，
 * 并将子元素内容转换为对应的分支函数
 * @param matchNodes - JSX 元素数组，每个元素代表一个条件分支
 * @returns 返回一个对象，包含 conditions 条件数组和 branches 分支数组
 */
function buildConditionsAndBranches(matchNodes: t.JSXElement[]): {
  conditions: t.Expression[] // 条件表达式数组
  branches: t.ArrowFunctionExpression[] // 分支函数数组
} {
  const conditions: t.Expression[] = [] // 存储提取的条件表达式
  const branches: t.ArrowFunctionExpression[] = [] // 存储转换后的分支函数

  // 遍历每个 JSX 元素，提取条件和分支
  for (const matchNode of matchNodes) {
    // 获取 when 属性
    const whenAttr = getJSXAttributeByName(matchNode, 'when')
    // 检查 when 属性是否存在且有效
    if (!whenAttr?.value) {
      throw createError('E007', matchNode) // 如果不存在，抛出错误
    }

    // 提取 when 条件表达式
    const whenExpr =
      whenAttr.value.type === 'JSXExpressionContainer'
        ? (whenAttr.value.expression as t.Expression) // 如果是表达式容器，取出表达式
        : whenAttr.value // 否则直接使用值
    conditions.push(whenExpr) // 将条件添加到条件数组

    // 提取分支内容，过滤掉空白文本节点
    const matchChildren = matchNode.children.filter(c => !isJSXText(c) || c.value.trim())

    // 检查是否有子元素
    if (matchChildren.length === 0) {
      throw createError('E013', matchNode) // 如果没有子元素，抛出错误
    }

    // 根据子元素数量创建不同的分支函数
    if (matchChildren.length === 1) {
      const child = matchChildren[0]
      if (isJSXText(child)) {
        // 如果是单个文本节点，创建返回字符串的函数
        branches.push(createArrowFunction(t.stringLiteral(child.value.trim())))
      } else {
        // 如果是单个表达式节点，直接使用该表达式
        branches.push(createArrowFunction(child as t.Expression))
      }
    } else {
      // 如果有多个子元素，创建返回数组表达式的函数
      branches.push(createArrowFunction(t.arrayExpression(matchChildren as t.Expression[])))
    }
  }

  return { conditions, branches } // 返回条件和分支数组
}
