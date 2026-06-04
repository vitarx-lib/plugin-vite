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
 * 生成的代码包括：获取视图节点、注册到 HMR 管理器、保存状态
 * @param variableNames - 需要追踪的变量名列表
 * @returns HMR 注册语句数组
 */
export function createHMRRegistrationStatements(variableNames: string[]): t.Statement[] {
  const statements: t.Statement[] = []

  // 语句1: const __$VITARX_HMR_VIEW_NODE$__ = __$VITARX_GET_COMPONENT_VIEW$__(true)
  // 获取当前组件的视图节点
  statements.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(HMR.view),
        t.callExpression(t.identifier(GET_COMPONENT_VIEW_ALIAS), [t.booleanLiteral(true)])
      )
    ])
  )

  // 语句2: __$VITARX_HMR$__.instance.register(__$VITARX_HMR_VIEW_NODE$__)
  // 将视图节点注册到 HMR 管理器
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

  // 构建状态对象的 getter 属性，延迟求值避免不必要的计算
  const stateProperties = variableNames.map(name =>
    t.objectMethod(
      'get',
      t.identifier(name),
      [],
      t.blockStatement([t.returnStatement(t.identifier(name))])
    )
  )

  // 语句3: __$VITARX_HMR_VIEW_NODE$__ && Promise.resolve().then(() => {
  //   __$VITARX_HMR_VIEW_NODE$__.__$vitarx_hmr_state$__ = { get 变量名() { return 变量名 } }
  // })
  // 异步保存状态到视图节点，确保 DOM 更新完成后再保存
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
 * 包装组件（如 defineComponent、builder）只注册节点，不保存状态
 * 传入组件函数自身作为第二个参数，便于更新时重新执行包装函数
 * @param componentName - 组件函数名称
 * @returns HMR 注册语句数组
 */
export function createWrappedComponentHMRStatements(componentName: string): t.Statement[] {
  const statements: t.Statement[] = []

  // 语句1: const __$VITARX_HMR_VIEW_NODE$__ = __$VITARX_GET_COMPONENT_VIEW$__(true)
  statements.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(HMR.view),
        t.callExpression(t.identifier(GET_COMPONENT_VIEW_ALIAS), [t.booleanLiteral(true)])
      )
    ])
  )

  // 语句2: __$VITARX_HMR$__.instance.register(__$VITARX_HMR_VIEW_NODE$__, Component)
  // 第二个参数传入组件函数，支持热更新时重新执行
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
 * 递归遍历函数体中的所有变量声明，用于状态恢复
 * @param functionBody - 函数体语句块
 * @returns 变量名数组
 */
export function collectLocalVariableNames(functionBody: t.BlockStatement): string[] {
  const variableNames = new Set<string>()
  collectFromBlock(functionBody, variableNames)
  return Array.from(variableNames)
}

/**
 * 从语句块中收集变量名
 * @param block - 语句块节点
 * @param variableNames - 存储变量名的集合
 */
function collectFromBlock(block: t.BlockStatement, variableNames: Set<string>): void {
  // 遍历语句块中的每个语句
  for (const stmt of block.body) {
    collectFromStatement(stmt, variableNames)
  }
}

/**
 * 从单个语句中收集变量名
 * 支持多种语句类型：变量声明、条件语句、循环语句、switch、try-catch 等
 * @param stmt - 语句节点
 * @param variableNames - 存储变量名的集合
 */
function collectFromStatement(stmt: t.Statement, variableNames: Set<string>): void {
  // 处理变量声明语句：const/let/var
  if (stmt.type === 'VariableDeclaration') {
    for (const decl of stmt.declarations) {
      // 跳过 void 模式（如 void 0）
      if (decl.id.type !== 'VoidPattern') {
        collectPatternBindings(decl.id, variableNames)
      }
    }
  } else if (stmt.type === 'IfStatement') {
    // 递归处理 if 语句的两个分支
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
    // 处理 for/while/do-while 循环
    if (stmt.body.type === 'BlockStatement') {
      collectFromBlock(stmt.body, variableNames)
    } else {
      collectFromStatement(stmt.body, variableNames)
    }
  } else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
    // 处理 for...in/for...of 循环
    if (stmt.body.type === 'BlockStatement') {
      collectFromBlock(stmt.body, variableNames)
    } else {
      collectFromStatement(stmt.body, variableNames)
    }
  } else if (stmt.type === 'BlockStatement') {
    // 处理嵌套语句块
    collectFromBlock(stmt, variableNames)
  } else if (stmt.type === 'SwitchStatement') {
    // 处理 switch 语句，遍历所有 case
    for (const c of stmt.cases) {
      for (const s of c.consequent) {
        collectFromStatement(s, variableNames)
      }
    }
  } else if (stmt.type === 'TryStatement') {
    // 处理 try-catch-finally
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
 * 函数类型不需要状态恢复（函数定义本身不会改变）
 * @param expr - 表达式节点
 * @returns 是否为函数类型
 */
function isFunctionExpression(expr: t.Expression | null): boolean {
  if (!expr) return false
  return (
    expr.type === 'ArrowFunctionExpression' ||  // 箭头函数
    expr.type === 'FunctionExpression' ||       // 函数表达式
    expr.type === 'ClassExpression'             // 类表达式
  )
}

/**
 * 创建状态恢复表达式
 * 格式：__$VITARX_HMR$__.instance.memo(__$VITARX_HMR_VIEW_NODE$__, '变量名') ?? 原始初始值
 * 如果 memo 方法返回保存的状态则使用，否则使用原始初始值
 * @param variableName - 变量名
 * @param originalInit - 原始初始化表达式
 * @returns 状态恢复表达式
 */
function createMemoExpression(variableName: string, originalInit: t.Expression): t.Expression {
  return t.logicalExpression(
    '??',  // 使用空值合并运算符
    t.callExpression(
      t.memberExpression(
        t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
        t.identifier('memo')
      ),
      [t.identifier(HMR.view), t.stringLiteral(variableName)]
    ),
    originalInit  // 原始初始值作为 fallback
  )
}

/**
 * 为单个变量声明注入状态恢复代码
 * 将 const x = value 转换为 const x = memo(view, 'x') ?? value
 * @param decl - 变量声明节点
 */
function injectStatePreservationForDeclaration(decl: t.VariableDeclarator): void {
  // 只处理标识符形式的变量名（跳过解构赋值）
  if (decl.id.type !== 'Identifier') return
  // 跳过没有初始值的声明
  if (!decl.init) return
  // 跳过函数类型的初始值（不需要状态恢复）
  if (isFunctionExpression(decl.init)) return

  // 替换初始值为状态恢复表达式
  decl.init = createMemoExpression(decl.id.name, decl.init)
}

/**
 * 为函数体内的变量声明注入状态恢复代码
 * 遍历函数体中的所有变量声明语句
 * @param functionBody - 函数体语句块
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
