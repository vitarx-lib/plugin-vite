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
  createLocationObject,
  filterWhitespaceChildren,
  hasDirective,
  removeVIfChainDirectives,
  validateVIfChain
} from '../../utils/index.js'

/**
 * 处理 IfBlock 组件
 */
export function processIfBlock(path: NodePath<t.JSXElement>, ctx: TransformContext): void {
  const children = filterWhitespaceChildren(path.node.children)

  if (children.length === 0) {
    throw createError('E014', path.node)
  }

  validateChildrenType(children)

  const jsxChildren = children as t.JSXElement[]
  validateVIfChain(jsxChildren)

  const { nodes, conditions } = collectVIfChainInfo(jsxChildren)

  nodes.forEach(node => removeVIfChainDirectives(node))
  const branches = nodes.map(node => createArrowFunction(node as t.Expression))

  // 获取位置信息（仅开发环境）
  const locInfo = ctx.options.dev && path.node.loc ? createLocationObject(ctx.filename, path.node.loc) : null

  const branchCall = createBranch({ conditions, branches, locInfo }, ctx)

  if (path.node.loc) {
    branchCall.loc = path.node.loc
  }

  path.replaceWith(branchCall)
}

/**
 * 验证子元素类型
 */
function validateChildrenType(children: t.Node[]): void {
  for (const child of children) {
    if (!isJSXElement(child)) {
      throw createError('E008', child, 'IfBlock children must be JSX elements with v-if directives')
    }

    if (!hasVIfChainDirective(child)) {
      throw createError(
        'E008',
        child,
        'IfBlock children must have v-if/v-else-if/v-else directives'
      )
    }
  }
}

/**
 * 检查元素是否有 v-if 链指令
 */
function hasVIfChainDirective(node: t.JSXElement): boolean {
  return (
    hasDirective(node, 'v-if') || hasDirective(node, 'v-else-if') || hasDirective(node, 'v-else')
  )
}
