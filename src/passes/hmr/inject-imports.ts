/**
 * HMR 导入注入模块
 * 负责注入 HMR 所需的导入语句
 * @module passes/hmr/inject-imports
 */
import * as t from '@babel/types'
import { HMR } from '../../constants/index.js'

/** getComponentView 的内部别名，避免与用户代码冲突 */
export const GET_COMPONENT_VIEW_ALIAS = '__$VITARX_GET_COMPONENT_VIEW$__'

/**
 * 注入 HMR 客户端导入
 * @param program - AST Program 节点
 */
export function injectHMRImport(program: t.Program): void {
  const importDecl = t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier(HMR.manager))],
    t.stringLiteral('@vitarx/vite-plugin/hmr-client')
  )
  program.body.unshift(importDecl)
}

/**
 * 注入 getComponentView 导入
 * 使用唯一的别名避免与用户代码冲突
 * @param program - AST Program 节点
 */
export function injectGetComponentViewImport(program: t.Program): void {
  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(GET_COMPONENT_VIEW_ALIAS), t.identifier('getComponentView'))],
    t.stringLiteral('vitarx')
  )
  program.body.unshift(importDecl)
}
