/**
 * IfBlock 组件处理器
 * 将 <IfBlock><div v-if>...</div><div v-else>...</div></IfBlock> 编译为 branch 调用
 * @module passes/components/ifBlock
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXElement } from '@babel/types'
import { TransformContext } from '../../context.js'
import { createError } from '../../error.js'
import {
  collectVIfChainInfo,
  createArrowFunction,
  createBranch,
  filterWhitespaceChildren,
  isVIfChain,
  removeVIfChainDirectives,
  validateVIfChain
} from '../../utils/index.js'

/**
 * 处理 IfBlock 组件
 * 该函数用于处理包含 v-if 指令的 JSX 元素，将其转换为条件分支调用
 * @param path - JSX 元素的 AST 路径
 * @param ctx - 转换上下文对象，包含转换过程中的配置和信息
 */
export function processIfBlock(path: NodePath<t.JSXElement>, ctx: TransformContext): void {
  // 过滤掉子元素中的空白文本节点
  const children = filterWhitespaceChildren(path.node.children)

  // 如果过滤后没有子元素，抛出错误 E014
  if (children.length === 0) {
    throw createError('E014', path.node)
  }

  // 验证子元素类型是否符合要求
  validateChildrenType(children)

  // 将子元素转换为 JSXElement 类型（假设前面已经验证过）
  const jsxChildren = children as t.JSXElement[]
  // 验证 v-if 链的合法性
  validateVIfChain(jsxChildren)

  // 收集 v-if 链的相关信息，包括条件和对应的节点
  const { nodes, conditions } = collectVIfChainInfo(jsxChildren)

  // 移除所有节点上的 v-if 指令
  nodes.forEach(node => removeVIfChainDirectives(node))
  // 为每个节点创建箭头函数表达式
  const branches = nodes.map(node => createArrowFunction(node as t.Expression))

  // 创建条件分支调用表达式
  const branchCall = createBranch({ conditions, branches }, ctx)

  // 保留原始位置信息
  if (path.node.loc) {
    branchCall.loc = path.node.loc
  }

  // 用创建的条件分支调用替换原始节点
  path.replaceWith(branchCall)
}

/**
 * 验证子元素类型
 * 该函数用于验证一组子节点是否符合IfBlock的要求
 * @param children - 需要验证的子节点数组
 * @throws 当子节点不符合要求时抛出错误
 */
function validateChildrenType(children: t.Node[]): void {
  // 遍历所有子节点进行验证
  for (const child of children) {
    // 检查子节点是否为JSX元素
    if (!isJSXElement(child)) {
      // 如果不是JSX元素，抛出错误E008
      throw createError('E008', child, 'IfBlock children must be JSX elements with v-if directives')
    }

    // 检查子节点是否包含v-if/v-else-if/v-else指令链
    if (!isVIfChain(child)) {
      // 如果不包含指令链，抛出错误E008
      throw createError(
        'E008',
        child,
        'IfBlock children must have v-if/v-else-if/v-else directives'
      )
    }
  }
}
