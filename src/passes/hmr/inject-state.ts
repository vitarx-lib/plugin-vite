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

  // 语句3: __$VITARX_HMR_VIEW_NODE$__ && __$VITARX_HMR$__.instance.trackState(
  //   __$VITARX_HMR_VIEW_NODE$__,
  //   { get 变量名() { return 变量名 } }
  // )
  // 惰性登记状态 getter：只在热更新时由管理器读取快照写入视图，
  // 正常「卸载→重挂载」不会写入状态，memo 永远不命中，避免旧状态泄漏
  statements.push(
    t.expressionStatement(
      t.logicalExpression(
        '&&',
        t.identifier(HMR.view),
        t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
            t.identifier('trackState')
          ),
          [t.identifier(HMR.view), t.objectExpression(stateProperties)]
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
 * 变量声明访问者回调类型
 * 用于遍历语句块中的所有 VariableDeclarator 节点
 */
type VariableDeclaratorVisitor = (decl: t.VariableDeclarator) => void

/**
 * 从函数体中收集需要状态登记的局部变量名
 * 递归遍历函数体中的所有变量声明，用于状态登记（trackState）；
 * 函数类型的初始值（箭头函数/函数表达式/类表达式）不登记——快照时
 * 读取 getter 会拿到函数值，一旦被误调用将执行组件内的业务函数
 * @param functionBody - 函数体语句块
 * @returns 变量名数组
 */
export function collectLocalVariableNames(functionBody: t.BlockStatement): string[] {
  const variableNames = new Set<string>()
  forEachVariableDeclarator(functionBody, decl => {
    if (decl.id.type === 'VoidPattern') return
    // 与 injectStatePreservationForDeclaration 的跳过规则保持一致
    if (isFunctionExpression(decl.init ?? null)) return
    collectPatternBindings(decl.id, variableNames)
  })
  return Array.from(variableNames)
}

/**
 * 遍历语句块中的所有变量声明，对每个 VariableDeclarator 执行回调
 * 递归处理嵌套的控制流语句（if/for/while/switch/try 等）
 * @param block - 语句块节点
 * @param visitor - 变量声明访问者回调
 */
function forEachVariableDeclarator(block: t.BlockStatement, visitor: VariableDeclaratorVisitor): void {
  for (const stmt of block.body) {
    traverseStatementForDeclarators(stmt, visitor)
  }
}

/**
 * 从单个语句中递归查找变量声明并执行回调
 * 支持多种语句类型：变量声明、条件语句、循环语句、switch、try-catch 等
 * @param stmt - 语句节点
 * @param visitor - 变量声明访问者回调
 */
function traverseStatementForDeclarators(stmt: t.Statement, visitor: VariableDeclaratorVisitor): void {
  if (stmt.type === 'VariableDeclaration') {
    for (const decl of stmt.declarations) {
      visitor(decl)
    }
  } else if (stmt.type === 'IfStatement') {
    traverseBodyForDeclarators(stmt.consequent, visitor)
    if (stmt.alternate) {
      traverseBodyForDeclarators(stmt.alternate, visitor)
    }
  } else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
    traverseBodyForDeclarators(stmt.body, visitor)
  } else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
    traverseBodyForDeclarators(stmt.body, visitor)
  } else if (stmt.type === 'BlockStatement') {
    forEachVariableDeclarator(stmt, visitor)
  } else if (stmt.type === 'SwitchStatement') {
    for (const c of stmt.cases) {
      for (const s of c.consequent) {
        traverseStatementForDeclarators(s, visitor)
      }
    }
  } else if (stmt.type === 'TryStatement') {
    forEachVariableDeclarator(stmt.block, visitor)
    if (stmt.handler) {
      forEachVariableDeclarator(stmt.handler.body, visitor)
    }
    if (stmt.finalizer) {
      forEachVariableDeclarator(stmt.finalizer, visitor)
    }
  }
}

/**
 * 遍历语句体（可能是 BlockStatement 或单条语句）中的变量声明
 */
function traverseBodyForDeclarators(body: t.Statement, visitor: VariableDeclaratorVisitor): void {
  if (body.type === 'BlockStatement') {
    forEachVariableDeclarator(body, visitor)
  } else {
    traverseStatementForDeclarators(body, visitor)
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
 * 递归遍历所有变量声明（包括 if/for/while/switch/try 嵌套块）
 * @param functionBody - 函数体语句块
 */
export function injectStatePreservation(functionBody: t.BlockStatement): void {
  forEachVariableDeclarator(functionBody, decl => {
    injectStatePreservationForDeclaration(decl)
  })
}
