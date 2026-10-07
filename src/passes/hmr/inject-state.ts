/**
 * HMR 状态恢复模块
 * 负责为组件函数注入状态保存和恢复代码
 * @module passes/hmr/inject-state
 */
import * as t from '@babel/types'
import { HMR } from '../../constants/index.js'
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
 * 判断表达式是否为函数类型
 * 函数类型不需要状态恢复（函数定义本身不会改变）；且快照读取 getter 会
 * 拿到函数值，一旦被误调用将执行组件内的业务函数
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
 * 判断是否为 useModel 调用
 *
 * useModel 返回的 ModelRef 是父组件状态的双向桥接（派生视图）而非独立
 * 状态：其内部以 flush:'sync' 的 watch 同步 props→镜像，该 watch 绑定在
 * 执行时的作用域上。若被 memo 复用，旧 watch 会随旧作用域销毁，表现为
 * props→镜像同步断裂（v-model 显示残留）。因此每次执行都重建 ModelRef
 * ——镜像从当前 props 重新初始化，语义正确。
 * @param expr - 表达式节点
 * @returns 是否为 useModel 调用
 */
function isUseModelCall(expr: t.Expression | null): boolean {
  return (
    !!expr &&
    expr.type === 'CallExpression' &&
    expr.callee.type === 'Identifier' &&
    expr.callee.name === 'useModel'
  )
}

/**
 * 创建状态恢复表达式
 * 格式：__$VITARX_HMR$__.instance.memo(view, '变量名') ?? 原始初始值
 * @param variableName - 变量名
 * @param originalInit - 原始初始值表达式
 * @param raw - 是否绕过响应式门禁（memoRaw）：解构声明的隐藏变量保存的是
 *   composable 返回的普通对象（内含 Ref 与函数），memo 的门禁会拒收，
 *   必须走无条件恢复
 * @returns 状态恢复表达式
 */
function createMemoExpression(
  variableName: string,
  originalInit: t.Expression,
  raw: boolean = false
): t.Expression {
  return t.logicalExpression(
    '??',  // 使用空值合并运算符
    t.callExpression(
      t.memberExpression(
        t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
        t.identifier(raw ? 'memoRaw' : 'memo')
      ),
      [t.identifier(HMR.view), t.stringLiteral(variableName)]
    ),
    originalInit  // 原始初始值作为 fallback
  )
}

/**
 * 为函数体注入状态恢复代码并收集需要登记（trackState）的变量名
 *
 * 处理规则：
 * - 标识符声明（非函数初始值）：初始值包装为 memo(view, '变量名') ?? 原始初始值
 * - useModel 调用：豁免（桥接状态每次重建，见 isUseModelCall）
 * - 解构声明（如 `const { a } = useFoo()`）：拆分为隐藏变量整包 memo +
 *   原声明解构隐藏变量——composable 返回的状态对象得以跨重执行保留，
 *   其内部创建的响应式状态与已挂载的副作用保持一致
 * - 函数类型初始值 / 无初始值：不注入
 * - for 循环头部声明：循环局部绑定，不注入（仅递归循环体）
 *
 * 单趟完成注入与收集，返回按执行顺序排列的登记名列表（标识符名 +
 * 隐藏变量名），供 trackState 生成 getter。隐藏变量采用用户标识符不可能
 * 命中的 `__$VITARX_D<N>$__` 命名，按组件函数内确定性计数。
 * @param functionBody - 函数体语句块
 * @returns 需要状态登记的变量名数组
 */
export function injectStatePreservation(functionBody: t.BlockStatement): string[] {
  const trackedNames: string[] = []
  let destructureCounter = 0
  processBlock(functionBody)
  return trackedNames

  /** 处理语句块：注入可能把一条声明拆成多条，需重建语句数组 */
  function processBlock(block: t.BlockStatement): void {
    const newBody: t.Statement[] = []
    for (const stmt of block.body) {
      newBody.push(...processStatement(stmt))
    }
    block.body = newBody
  }

  /** 处理单条语句，返回替换它的语句列表（1~n 条） */
  function processStatement(stmt: t.Statement): t.Statement[] {
    if (stmt.type === 'VariableDeclaration') {
      return processVariableDeclaration(stmt)
    }
    if (stmt.type === 'IfStatement') {
      stmt.consequent = wrapBody(stmt.consequent)
      if (stmt.alternate) stmt.alternate = wrapBody(stmt.alternate)
    } else if (
      stmt.type === 'ForStatement' ||
      stmt.type === 'WhileStatement' ||
      stmt.type === 'DoWhileStatement'
    ) {
      // for 头部声明是循环局部绑定不注入；仅递归循环体
      stmt.body = wrapBody(stmt.body)
    } else if (stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
      // 同上：for-of/for-in 的 left 绑定按迭代取值，不做状态保留
      stmt.body = wrapBody(stmt.body)
    } else if (stmt.type === 'BlockStatement') {
      processBlock(stmt)
    } else if (stmt.type === 'SwitchStatement') {
      for (const switchCase of stmt.cases) {
        switchCase.consequent = processStatementList(switchCase.consequent)
      }
    } else if (stmt.type === 'TryStatement') {
      processBlock(stmt.block)
      if (stmt.handler) processBlock(stmt.handler.body)
      if (stmt.finalizer) processBlock(stmt.finalizer)
    }
    return [stmt]
  }

  function processStatementList(list: t.Statement[]): t.Statement[] {
    const results: t.Statement[] = []
    for (const stmt of list) {
      results.push(...processStatement(stmt))
    }
    return results
  }

  /** 语句体若因注入产生多条语句，需要块化包装保持语法合法 */
  function wrapBody(body: t.Statement): t.Statement {
    if (body.type === 'BlockStatement') {
      processBlock(body)
      return body
    }
    const results = processStatement(body)
    return results.length === 1 ? results[0] : t.blockStatement(results)
  }

  /** 逐 declarator 处理变量声明（多 declarator 时拆分为多条声明） */
  function processVariableDeclaration(stmt: t.VariableDeclaration): t.Statement[] {
    const results: t.Statement[] = []
    for (const decl of stmt.declarations) {
      const init = decl.init ?? null
      // 无初始值 / VoidPattern / 函数初始值：原样保留
      if (decl.id.type === 'VoidPattern' || !init || isFunctionExpression(init)) {
        results.push(t.variableDeclaration(stmt.kind, [decl]))
        continue
      }
      if (decl.id.type === 'Identifier') {
        if (isUseModelCall(init)) {
          // 桥接状态豁免：不 memo、不登记（见 isUseModelCall 注释）
          results.push(t.variableDeclaration(stmt.kind, [decl]))
          continue
        }
        trackedNames.push(decl.id.name)
        decl.init = createMemoExpression(decl.id.name, init)
        results.push(t.variableDeclaration(stmt.kind, [decl]))
        continue
      }
      // 解构声明：隐藏变量整包 memo（raw 恢复）+ 原声明解构隐藏变量
      const hiddenName = `__$VITARX_D${destructureCounter++}$__`
      trackedNames.push(hiddenName)
      results.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(hiddenName),
            createMemoExpression(hiddenName, init, true)
          )
        ]),
        t.variableDeclaration(stmt.kind, [
          t.variableDeclarator(decl.id, t.identifier(hiddenName))
        ])
      )
    }
    return results
  }
}
