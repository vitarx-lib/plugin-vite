/**
 * HMR 状态恢复模块
 * 负责为组件函数注入状态保存和恢复代码
 * @module passes/hmr/inject-state
 */
import * as t from '@babel/types'
import { HMR } from '../../constants/index.js'
import { collectPatternBindings } from '../../utils/index.js'
import { GET_COMPONENT_VIEW_ALIAS } from './inject-imports.js'

/**
 * 创建组件函数体内的 HMR 注册代码
 * @param variableNames - 需要追踪的变量名列表
 * @returns HMR 注册语句数组
 */
export function createHMRRegistrationStatements(variableNames: string[]): t.Statement[] {
  const statements: t.Statement[] = []

  statements.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(HMR.view),
        t.callExpression(t.identifier(GET_COMPONENT_VIEW_ALIAS), [t.booleanLiteral(true)])
      )
    ])
  )

  statements.push(
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(
          t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
          t.identifier('register')
        ),
        [t.identifier(HMR.view)]
      )
    )
  )

  const stateProperties = variableNames.map(name =>
    t.objectMethod(
      'get',
      t.identifier(name),
      [],
      t.blockStatement([t.returnStatement(t.identifier(name))])
    )
  )

  statements.push(
    t.expressionStatement(
      t.logicalExpression(
        '&&',
        t.identifier(HMR.view),
        t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
              []
            ),
            t.identifier('then')
          ),
          [
            t.arrowFunctionExpression(
              [],
              t.blockStatement([
                t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    t.memberExpression(t.identifier(HMR.view), t.identifier(HMR.state)),
                    t.objectExpression(stateProperties)
                  )
                )
              ])
            )
          ]
        )
      )
    )
  )

  return statements
}

/**
 * 创建包装组件的 HMR 注册代码
 * 只注册节点，不保存状态，传入组件函数自身作为第二个参数
 * @param componentName - 组件函数名称
 * @returns HMR 注册语句数组
 */
export function createWrappedComponentHMRStatements(componentName: string): t.Statement[] {
  const statements: t.Statement[] = []

  statements.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(HMR.view),
        t.callExpression(t.identifier(GET_COMPONENT_VIEW_ALIAS), [t.booleanLiteral(true)])
      )
    ])
  )

  statements.push(
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(
          t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
          t.identifier('register')
        ),
        [t.identifier(HMR.view), t.identifier(componentName)]
      )
    )
  )

  return statements
}

/**
 * 从函数体中收集局部变量名
 * @param functionBody - 函数体语句块
 * @returns 变量名数组
 */
export function collectLocalVariableNames(functionBody: t.BlockStatement): string[] {
  const variableNames = new Set<string>()
  collectFromBlock(functionBody, variableNames)
  return Array.from(variableNames)
}

function collectFromBlock(block: t.BlockStatement, variableNames: Set<string>): void {
  for (const stmt of block.body) {
    collectFromStatement(stmt, variableNames)
  }
}

function collectFromStatement(stmt: t.Statement, variableNames: Set<string>): void {
  if (stmt.type === 'VariableDeclaration') {
    for (const decl of stmt.declarations) {
      if (decl.id.type !== 'VoidPattern') {
        collectPatternBindings(decl.id, variableNames)
      }
    }
  } else if (stmt.type === 'IfStatement') {
    if (stmt.consequent.type === 'BlockStatement') {
      collectFromBlock(stmt.consequent, variableNames)
    } else {
      collectFromStatement(stmt.consequent, variableNames)
    }
    if (stmt.alternate) {
      if (stmt.alternate.type === 'BlockStatement') {
        collectFromBlock(stmt.alternate, variableNames)
      } else {
        collectFromStatement(stmt.alternate, variableNames)
      }
    }
  } else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
    if (stmt.body.type === 'BlockStatement') {
      collectFromBlock(stmt.body, variableNames)
    } else {
      collectFromStatement(stmt.body, variableNames)
    }
  } else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
    if (stmt.body.type === 'BlockStatement') {
      collectFromBlock(stmt.body, variableNames)
    } else {
      collectFromStatement(stmt.body, variableNames)
    }
  } else if (stmt.type === 'BlockStatement') {
    collectFromBlock(stmt, variableNames)
  } else if (stmt.type === 'SwitchStatement') {
    for (const c of stmt.cases) {
      for (const s of c.consequent) {
        collectFromStatement(s, variableNames)
      }
    }
  } else if (stmt.type === 'TryStatement') {
    collectFromBlock(stmt.block, variableNames)
    if (stmt.handler) {
      collectFromBlock(stmt.handler.body, variableNames)
    }
    if (stmt.finalizer) {
      collectFromBlock(stmt.finalizer, variableNames)
    }
  }
}

/**
 * 判断表达式是否为函数类型
 */
function isFunctionExpression(expr: t.Expression | null): boolean {
  if (!expr) return false
  return (
    expr.type === 'ArrowFunctionExpression' ||
    expr.type === 'FunctionExpression' ||
    expr.type === 'ClassExpression'
  )
}

/**
 * 创建状态恢复表达式
 * 格式：__$VITARX_HMR$__.instance.memo(__$VITARX_HMR_VIEW_NODE$__, '变量名') ?? 原始初始值
 */
function createMemoExpression(variableName: string, originalInit: t.Expression): t.Expression {
  return t.logicalExpression(
    '??',
    t.callExpression(
      t.memberExpression(
        t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
        t.identifier('memo')
      ),
      [t.identifier(HMR.view), t.stringLiteral(variableName)]
    ),
    originalInit
  )
}

/**
 * 为单个变量声明注入状态恢复代码
 */
function injectStatePreservationForDeclaration(decl: t.VariableDeclarator): void {
  if (decl.id.type !== 'Identifier') return
  if (!decl.init) return
  if (isFunctionExpression(decl.init)) return

  decl.init = createMemoExpression(decl.id.name, decl.init)
}

/**
 * 为函数体内的变量声明注入状态恢复代码
 */
export function injectStatePreservation(functionBody: t.BlockStatement): void {
  for (const stmt of functionBody.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        injectStatePreservationForDeclaration(decl)
      }
    }
  }
}
