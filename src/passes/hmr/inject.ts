/**
 * HMR 代码注入模块
 * 在 HMR 模式下为组件函数注入热更新支持代码
 * @module passes/hmr
 */
import * as t from '@babel/types'
import { HMR } from '../../constants/index.js'
import type { ComponentInfo } from '../../utils/index.js'
import { injectHMRImport, injectGetComponentViewImport } from './inject-imports.js'
import {
  createHMRRegistrationStatements,
  createWrappedComponentHMRStatements,
  collectLocalVariableNames,
  injectStatePreservation
} from './inject-state.js'

/**
 * 为组件函数注入 HMR 注册代码
 * @param func - 函数声明/表达式/箭头函数
 * @param variableNames - 需要追踪的变量名列表
 * @param isWrapped - 是否为包装组件
 * @param componentName - 组件名称（包装组件需要）
 */
function injectHMRIntoFunction(
  func: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
  variableNames: string[],
  isWrapped: boolean = false,
  componentName?: string
): void {
  if (func.type === 'ArrowFunctionExpression' && func.body.type !== 'BlockStatement') {
    const returnStmt = t.returnStatement(func.body)
    func.body = t.blockStatement([returnStmt])
  }

  if (!func.body || func.body.type !== 'BlockStatement') return

  if (!isWrapped) {
    injectStatePreservation(func.body)
  }

  const statements = isWrapped
    ? createWrappedComponentHMRStatements(componentName!)
    : createHMRRegistrationStatements(variableNames)
  func.body.body.unshift(...statements)
}

/**
 * 创建 bindId 语句
 */
function createBindIdStatement(componentName: string, componentId: string): t.Statement {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(
        t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
        t.identifier('bindId')
      ),
      [t.identifier(componentName), t.stringLiteral(componentId)]
    )
  )
}

/**
 * 创建 import.meta.hot.accept 语句
 */
function createHotAcceptStatement(): t.Statement {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(
        t.memberExpression(
          t.memberExpression(t.identifier('import'), t.identifier('meta')),
          t.identifier('hot')
        ),
        t.identifier('accept')
      ),
      [
        t.arrowFunctionExpression(
          [t.identifier('mod')],
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
                  t.identifier('update')
                ),
                [t.identifier('mod')]
              )
            )
          ])
        )
      ]
    )
  )
}

/**
 * 生成组件唯一 ID（文件路径 + 组件名称）
 */
function generateComponentId(filename: string, componentName: string): string {
  const combined = `${filename}:${componentName}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

/**
 * 注入 HMR 支持
 * 主入口函数，为所有组件注入完整的 HMR 支持
 * @param program - AST Program 节点
 * @param components - 组件信息列表
 * @param filename - 文件名
 */
export function injectHMRSupport(
  program: t.Program,
  components: ComponentInfo[],
  filename: string
): void {
  if (components.length === 0) return

  injectHMRImport(program)
  injectGetComponentViewImport(program)

  for (const { node, isWrapped, name } of components) {
    const variableNames =
      node.body?.type === 'BlockStatement' ? collectLocalVariableNames(node.body) : []
    injectHMRIntoFunction(node, variableNames, isWrapped, name)
  }

  for (const { name } of components) {
    program.body.push(createBindIdStatement(name, generateComponentId(filename, name)))
  }

  program.body.push(createHotAcceptStatement())
}
