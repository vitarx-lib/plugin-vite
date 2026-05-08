/**
 * v-if 链处理器
 * 处理 Fragment/Element 中的 v-if/v-else-if/v-else 链
 * @module passes/directives/vIf
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXElement, isJSXText } from '@babel/types'
import { TransformContext } from '../../context.js'
import {
  collectFragmentVIfChains,
  createArrowFunction,
  createBranch,
  isWhitespaceJSXText,
  removeVIfChainDirectives
} from '../../utils/index.js'

type TransformJSXElementFn = (
  node: t.JSXElement,
  ctx: TransformContext,
  handleVIf: boolean
) => t.Expression | null

type JSXContainerPath = NodePath<t.JSXFragment | t.JSXElement>

type JSXContainerChildren = (
  | t.JSXText
  | t.JSXExpressionContainer
  | t.JSXSpreadChild
  | t.JSXElement
  | t.JSXFragment
)[]

/**
 * 处理子元素数组中的 v-if 链
 * 收集并转换 v-if/v-else-if/v-else 链为 branch 调用
 * @param children - 子元素数组（会被原地修改）
 * @param ctx - 转换上下文
 * @param transformJSXElement - JSX 元素转换函数
 * @returns 处理后的子元素数组（链节点已替换为 branch 调用，nullLiteral 已移除）
 */
export function transformChildrenVIfChains(
  children: t.Node[],
  ctx: TransformContext,
  transformJSXElement: TransformJSXElementFn
): t.Node[] {
  const chains = collectFragmentVIfChains(children)
  if (chains.length === 0) return children

  for (let c = chains.length - 1; c >= 0; c--) {
    processVIfChainItem(chains[c], children, ctx, transformJSXElement)
  }

  return children.filter(child => {
    if (t.isNullLiteral(child)) return false
    return !(isJSXText(child) && isWhitespaceJSXText(child))
  })
}

/**
 * 处理 Fragment/Element 中的 v-if 链
 * @param path - JSX Fragment 或 Element 路径
 * @param ctx - 转换上下文
 * @param transformJSXElement - JSX 元素转换函数
 */
export function processVIfChain(
  path: JSXContainerPath,
  ctx: TransformContext,
  transformJSXElement: TransformJSXElementFn
): void {
  const children = path.node.children
  const processed = transformChildrenVIfChains(children, ctx, transformJSXElement)
  if (processed !== children) {
    path.node.children = processed as JSXContainerChildren
  }
}

/**
 * 处理单个 v-if 链
 */
function processVIfChainItem(
  chain: { nodes: t.JSXElement[]; conditions: t.Expression[]; endIndex: number },
  children: t.Node[],
  ctx: TransformContext,
  transformJSXElement: TransformJSXElementFn
): void {
  const { nodes, conditions, endIndex } = chain

  let start = -1
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isJSXElement(child) && child === nodes[0]) {
      start = i
      break
    }
  }

  const branches: t.ArrowFunctionExpression[] = []
  for (const node of nodes) {
    removeVIfChainDirectives(node)
    const transformedNode = transformJSXElement(node, ctx, false)
    if (transformedNode) {
      branches.push(createArrowFunction(transformedNode))
    }
  }

  const branchCall = createBranch({ conditions, branches }, ctx)

  if (start >= 0) {
    children[start] = branchCall as any
    for (let k = start + 1; k <= endIndex; k++) {
      children[k] = t.nullLiteral() as any
    }
  }
}
