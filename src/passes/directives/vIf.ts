/**
 * v-if 链处理器
 * 处理 Fragment/Element 中的 v-if/v-else-if/v-else 链
 * @module passes/directives/vIf
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXText } from '@babel/types'
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

/**
 * 处理子元素数组中的 v-if 链
 * 收集并转换 v-if/v-else-if/v-else 链为 branch 调用
 * @param children - 子元素数组（会被原地修改）
 * @param ctx - 转换上下文
 * @param transformJSXElement - JSX 元素转换函数
 * @returns 处理后的子元素数组（链节点已替换为 branch 调用，nullLiteral 已移除）
 */
export function transformChildrenVIfChains(
  children: t.Node[], // 子元素数组，将被原地修改
  ctx: TransformContext, // 转换上下文，包含转换所需的环境信息
  transformJSXElement: TransformJSXElementFn // JSX 元素转换函数，用于转换 JSX 元素节点
): t.Node[] {
  // 返回处理后的子元素数组，链节点已替换为 branch 调用，nullLiteral 已移除
  const chains = collectFragmentVIfChains(children) // 收集所有 v-if 链
  if (chains.length === 0) return children // 如果没有 v-if 链，直接返回原数组

  // 从后向前处理每个 v-if 链，确保正确的顺序
  for (let c = chains.length - 1; c >= 0; c--) {
    processVIfChainItem(chains[c], children, ctx, transformJSXElement) // 处理单个 v-if 链项
  }

  // 过滤掉 nullLiteral 类型的节点和空白文本节点
  return children.filter(child => {
    if (t.isNullLiteral(child)) return false // 过滤掉 nullLiteral 节点
    return !(isJSXText(child) && isWhitespaceJSXText(child)) // 过滤掉空白文本节点
  })
}

/**
 * 处理 Fragment/Element 中的 v-if 链
 * @param path - JSX Fragment 或 Element 路径
 * @param ctx - 转换上下文
 * @param transformJSXElement - JSX 元素转换函数
 */
export function processVIfChain( // 导出处理 v-if 链的函数
  path: JSXContainerPath, // 参数 path：接收 JSX 容器（Fragment 或 Element）的路径
  ctx: TransformContext, // 参数 ctx：提供转换过程中所需的上下文信息
  transformJSXElement: TransformJSXElementFn // 参数 transformJSXElement：用于转换 JSX 元素的回调函数
): void {
  // 函数无返回值
  const children = path.node.children // 获取当前路径下节点的子节点数组
  const processed = transformChildrenVIfChains(children, ctx, transformJSXElement) // 调用函数处理子节点中的 v-if 链
  if (processed !== children) {
    // 检查处理后的子节点是否与原始子节点不同
    path.node.children = processed as typeof path.node.children // 如果不同，则更新节点的子节点数组
  }
}

/**
 * 处理单个 v-if 链
 * 该函数用于处理包含 v-if 指令的 JSX 元素链，将其转换为条件分支结构
 * @param chain - 包含 v-if 链信息的对象，包含节点、条件和索引范围
 * @param children - 子节点数组，将被修改以插入转换后的条件分支
 * @param ctx - 转换上下文，包含转换过程中需要的配置和信息
 * @param transformJSXElement - 用于转换 JSX 元素的函数
 */
function processVIfChainItem(
  chain: {
    nodes: t.JSXElement[] // JSX 元素数组，代表条件分支的各个节点
    conditions: t.Expression[] // 条件表达式数组，每个条件对应一个分支
    startIndex: number // 当前 v-if 链在子数组中的起始索引
    endIndex: number // 当前 v-if 链在子数组中的结束索引
  },
  children: t.Node[], // 子节点数组，将被修改以插入转换后的条件分支
  ctx: TransformContext, // 转换上下文对象，包含转换过程中的配置和信息
  transformJSXElement: TransformJSXElementFn // 转换 JSX 元素的函数类型
): void {
  const { nodes, conditions, startIndex, endIndex } = chain // 解构赋值获取链信息

  // 创建分支数组，每个分支是一个箭头函数表达式
  const branches: t.ArrowFunctionExpression[] = []
  // 遍历所有节点，移除 v-if 指令并转换节点
  for (const node of nodes) {
    removeVIfChainDirectives(node) // 移除节点上的 v-if 相关指令
    const transformedNode = transformJSXElement(node, ctx, false) // 转换 JSX 元素
    if (transformedNode) {
      branches.push(createArrowFunction(transformedNode)) // 将转换后的节点包装为箭头函数
    }
  }

  // 在起始位置创建条件分支结构
  children[startIndex] = createBranch({ conditions, branches }, ctx)
  // 将后续位置填充为 null 字面量，避免重复渲染
  for (let k = startIndex + 1; k <= endIndex; k++) {
    children[k] = t.nullLiteral()
  }
}
