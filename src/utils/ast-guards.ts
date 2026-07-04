/**
 * AST 类型守卫函数
 * 用于判断节点类型和属性
 * @module utils/ast-guards
 */
import { isJSXText, type Node } from '@babel/types'

/**
 * 判断 JSXText 是否为纯空白文本
 * 空白文本在渲染时通常需要被过滤掉
 * @param node - AST 节点
 * @returns 是否为纯空白文本
 */
export function isWhitespaceJSXText(node: Node): boolean {
  // 先判断是否为 JSXText 类型
  if (!isJSXText(node)) return false
  // 使用正则表达式判断是否只包含空白字符
  return /^\s*$/.test(node.value)
}

/**
 * 判断节点是否为 JSX 注释
 * JSX 注释写作 {/* comment *\/}，解析为 JSXExpressionContainer，
 * 其 expression 为 JSXEmptyExpression（注释文本挂在 innerComments 上）
 * @param node - AST 节点
 * @returns 是否为 JSX 注释
 */
export function isJSXComment(node: Node): boolean {
  return (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'JSXEmptyExpression'
  )
}
