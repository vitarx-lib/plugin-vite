/**
 * JSX Fragment 处理模块
 * 将 JSX Fragment 转换为 createView(Fragment, ...) 调用
 * @module passes/jsx/processJSXFragment
 */
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { isJSXElement } from '@babel/types'
import { markImport, type TransformContext } from '../../context.js'
import { createError } from '../../error.js'
import {
  addPureComment,
  createCreateViewCall,
  filterWhitespaceChildren,
  getAlias,
  getDevLocInfo,
  getJSXElementName
} from '../../utils/index.js'
import { processChildren } from './processChildren.js'

/**
 * 校验子节点中不能直接包含 Match 组件
 * Match 必须在 Switch 内使用，非 Switch 元素的子节点中不允许出现 Match
 * @param children - 子节点数组
 */
function validateNoDirectMatchChild(children: t.Node[]): void {
  for (const child of children) {
    if (isJSXElement(child)) {
      const childName = getJSXElementName(child)
      if (childName === 'Match') {
        throw createError('E012', child)
      }
    }
  }
}

/**
 * 处理 JSX Fragment
 * @param path - JSX Fragment 路径
 * @param ctx - 转换上下文
 */
export function processJSXFragment(path: NodePath<t.JSXFragment>, ctx: TransformContext): void {
  const node = path.node

  // 过滤空白子节点
  const children = filterWhitespaceChildren(node.children)

  // 校验 Match 组件
  validateNoDirectMatchChild(children)

  // 标记需要的导入
  markImport(ctx, 'Fragment')
  markImport(ctx, 'createView')

  const fragmentAlias = getAlias(ctx.vitarxAliases, 'Fragment')
  const createViewAlias = getAlias(ctx.vitarxAliases, 'createView')
  const locInfo = getDevLocInfo(ctx, node)

  // 无子元素
  if (children.length === 0) {
    const viewCall = addPureComment(
      createCreateViewCall(t.identifier(fragmentAlias), null, locInfo, createViewAlias),
      ctx
    )
    if (node.loc) viewCall.loc = node.loc
    path.replaceWith(viewCall)
    return
  }

  // 处理子元素
  const processedChildren = processChildren(children, ctx)
  const childrenValue =
    processedChildren.length === 1 ? processedChildren[0] : t.arrayExpression(processedChildren)

  const props = t.objectExpression([t.objectProperty(t.identifier('children'), childrenValue)])

  const viewCall = addPureComment(
    createCreateViewCall(t.identifier(fragmentAlias), props, locInfo, createViewAlias),
    ctx
  )
  if (node.loc) viewCall.loc = node.loc
  path.replaceWith(viewCall)
}
