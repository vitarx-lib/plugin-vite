/**
 * v-if 链处理工具模块
 * 统一处理 v-if/v-else-if/v-else 链的验证和收集
 * @module utils/vif-helpers
 */
import * as t from '@babel/types'
import { isJSXElement, isJSXText } from '@babel/types'
import { createError } from '../error.js'
import { isWhitespaceJSXText } from './ast-guards.js'
import {
  getDirectiveValue,
  hasDirective,
  isVElse,
  isVElseIf,
  isVIf,
  isVIfChain
} from './jsx-helpers.js'

/**
 * v-if 链信息
 */
export interface VIfChainInfo {
  // 链中的 JSX 元素节点数组
  nodes: t.JSXElement[]
  // 对应每个元素的条件表达式数组
  conditions: t.Expression[]
  // 链在父元素子数组中的起始索引
  startIndex: number
  // 链在父元素子数组中的结束索引
  endIndex: number
}

/**
 * 验证 v-if 链的合法性
 * 检查语法错误，如顺序不当、v-else 不是最后一个等
 * @param children - v-if 链的元素数组
 */
export function validateVIfChain(children: t.JSXElement[]): void {
  if (children.length === 0) return

  // 第一个元素必须有 v-if 指令
  if (!hasDirective(children[0], 'v-if')) {
    throw createError('E008', children[0], 'First element must have v-if directive')
  }

  // 验证后续元素
  for (let i = 1; i < children.length; i++) {
    const child = children[i]
    const prevChild = children[i - 1]

    const hasVElseIf = hasDirective(child, 'v-else-if')
    const hasVElse = hasDirective(child, 'v-else')

    // 后续元素必须是 v-else-if 或 v-else
    if (!hasVElseIf && !hasVElse) {
      throw createError(
        'E008',
        child,
        'Elements after v-if must have v-else-if or v-else directive'
      )
    }

    // v-else 必须是最后一个元素
    if (hasVElse && i !== children.length - 1) {
      throw createError('E008', child, 'v-else must be the last element')
    }

    // v-else-if 不能接在 v-else 后面
    if (hasVElseIf && hasDirective(prevChild, 'v-else')) {
      throw createError('E008', child, 'v-else-if cannot follow v-else')
    }
  }
}

/**
 * 从 JSX 元素数组收集 v-if 链信息
 * 要求所有元素都属于 v-if 链（之前已验证）
 * @param nodes - JSX 元素数组
 * @returns v-if 链信息对象
 */
export function collectVIfChainInfo(nodes: t.JSXElement[]): VIfChainInfo {
  const conditions: t.Expression[] = []

  // 遍历每个节点，收集对应的条件
  for (const node of nodes) {
    const vIfValue = getDirectiveValue(node, 'v-if')
    if (vIfValue) {
      // v-if 直接使用其条件表达式
      conditions.push(vIfValue)
      continue
    }

    const vElseIfValue = getDirectiveValue(node, 'v-else-if')
    if (vElseIfValue) {
      // v-else-if 直接使用其条件表达式
      conditions.push(vElseIfValue)
      continue
    }

    if (hasDirective(node, 'v-else')) {
      // v-else 使用 true 作为条件（默认情况）
      conditions.push(t.booleanLiteral(true))
      continue
    }

    // 理论上不会走到这里，因为之前已验证
    throw createError('E008', node, 'Element missing v-if/v-else-if/v-else directive')
  }

  return { nodes, conditions, startIndex: 0, endIndex: nodes.length - 1 }
}

/**
 * 收集 Fragment 中的 v-if 链
 * 从 Fragment 的子元素中识别多个独立的 v-if 链
 * @param children - Fragment 的子节点数组
 * @returns v-if 链信息数组
 */
export function collectFragmentVIfChains(
  children: t.Node[]
): Array<VIfChainInfo & { endIndex: number }> {
  const chains: Array<VIfChainInfo & { endIndex: number }> = []
  let i = 0

  // 遍历所有子节点
  while (i < children.length) {
    const child = children[i]

    // 跳过文本节点
    if (isJSXText(child)) {
      i++
      continue
    }

    // 跳过非 JSXElement 节点
    if (!isJSXElement(child)) {
      i++
      continue
    }

    // 跳过不属于 v-if 链的元素
    if (!isVIfChain(child)) {
      i++
      continue
    }

    // 处理 v-if 开头的链
    if (isVIf(child)) {
      const chain = collectSingleChainFromFragment(children, i)
      chains.push(chain)
      // 跳到链结束的下一个位置
      i = chain.endIndex + 1
    } else if (isVElseIf(child) || isVElse(child)) {
      // v-else-if 或 v-else 不能单独出现
      throw createError(isVElse(child) ? 'E003' : 'E004', child)
    } else {
      i++
    }
  }

  return chains
}

/**
 * 从 Fragment 收集单个 v-if 链
 * 从 v-if 开始，收集后续连续的 v-else-if 和 v-else
 * @param children - Fragment 的子节点数组
 * @param startIndex - v-if 起始索引
 * @returns 单个 v-if 链信息
 */
function collectSingleChainFromFragment(
  children: t.Node[],
  startIndex: number
): VIfChainInfo & { endIndex: number } {
  const nodes: t.JSXElement[] = [children[startIndex] as t.JSXElement]
  const conditions: t.Expression[] = [getDirectiveValue(nodes[0], 'v-if')!]

  let j = startIndex + 1
  // 继续收集后续的 v-else-if 和 v-else
  while (j < children.length) {
    const nextChild = children[j]

    // 跳过空白文本节点（允许链元素间有空白）
    if (isJSXText(nextChild) && isWhitespaceJSXText(nextChild)) {
      j++
      continue
    }

    // 遇到非 JSXElement，链结束
    if (!isJSXElement(nextChild)) break
    // 遇到不属于 v-if 链的元素，链结束
    if (!isVIfChain(nextChild)) break

    if (isVElseIf(nextChild)) {
      // 收集 v-else-if
      nodes.push(nextChild)
      conditions.push(getDirectiveValue(nextChild, 'v-else-if')!)
      j++
    } else if (isVElse(nextChild)) {
      // 收集 v-else 并结束链
      nodes.push(nextChild)
      conditions.push(t.booleanLiteral(true))
      j++
      break
    } else {
      // 其他情况，链结束
      break
    }
  }

  return { nodes, conditions, startIndex, endIndex: j - 1 }
}
