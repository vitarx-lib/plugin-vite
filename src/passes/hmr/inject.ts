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
  injectStatePreservation
} from './inject-state.js'

/**
 * 为组件函数注入 HMR 注册代码
 * @param func - 函数声明/表达式/箭头函数
 * @param isWrapped - 是否为包装组件（defineComponent/builder）
 * @param componentName - 组件名称（包装组件需要）
 */
function injectHMRIntoFunction(
  func: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
  isWrapped: boolean = false,
  componentName?: string
): void {
  // 如果是箭头函数且函数体不是块语句（单行箭头函数），转换为块语句
  if (func.type === 'ArrowFunctionExpression' && func.body.type !== 'BlockStatement') {
    const returnStmt = t.returnStatement(func.body)
    func.body = t.blockStatement([returnStmt])
  }

  // 确保函数体是块语句
  if (!func.body || func.body.type !== 'BlockStatement') return

  // 非包装组件：注入状态恢复代码并收集登记名（单趟完成）
  const variableNames: string[] = isWrapped ? [] : injectStatePreservation(func.body)

  // 根据组件类型创建对应的 HMR 注册语句
  const statements = isWrapped
    ? createWrappedComponentHMRStatements(componentName!)
    : createHMRRegistrationStatements(variableNames)
  // 将注册语句插入到函数体开头
  func.body.body.unshift(...statements)
}

/**
 * 创建 bindId 语句
 * 将组件名称与唯一 ID 绑定，用于热更新时识别组件
 * @param componentName - 组件名称
 * @param componentId - 组件唯一 ID
 * @returns bindId 调用语句
 */
function createBindIdStatement(componentName: string, componentId: string): t.Statement {
  // 生成：__$VITARX_HMR$__.instance.bindId(Component, 'hash')
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
 * 监听模块热更新事件，触发组件更新
 * @returns hot.accept 调用语句
 */
function createHotAcceptStatement(): t.Statement {
  // 生成：import.meta.hot.accept(mod => { __$VITARX_HMR$__.instance.update(mod) })
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
 * 创建导入转发模块的 hot.accept 语句（带 invalidate 兜底）
 *
 * 生成：import.meta.hot.accept(mod => {
 *   if (!__$VITARX_HMR$__.instance.update(mod)) {
 *     import.meta.hot.invalidate('[VitarxHMR]: ...')
 *   }
 * })
 *
 * 转发模块本身不含组件定义，update 的返回值表示新模块导出中是否
 * 含已绑定 HMR id 的组件——为 false 说明转发目标不可识别（如换成
 * 未转换模块的组件），必须 invalidate 整页刷新，避免界面静默 stale。
 *
 * 已知边界：转发目标在两个均有 HMR id 的组件间切换（export default A
 * 改为 export default B）时，update 只登记 B 的 id 并返回 true，不会
 * invalidate，挂在旧 id A 名下的视图不会被更新——文件路由场景由
 * vitarx-router 虚拟路由模块自身的 hot accept 重建路由树兜底；非路由
 * 场景需手动刷新。此为接受的降级路径，不做运行时检测。
 * @returns hot.accept 调用语句
 */
function createForwardingHotAcceptStatement(): t.Statement {
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
            t.ifStatement(
              t.unaryExpression(
                '!',
                t.callExpression(
                  t.memberExpression(
                    t.memberExpression(t.identifier(HMR.manager), t.identifier('instance')),
                    t.identifier('update')
                  ),
                  [t.identifier('mod')]
                )
              ),
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.memberExpression(
                        t.memberExpression(t.identifier('import'), t.identifier('meta')),
                        t.identifier('hot')
                      ),
                      t.identifier('invalidate')
                    ),
                    [t.stringLiteral('[VitarxHMR]: 转发的默认导出不是可热更新的组件，回退整页刷新')]
                  )
                )
              ])
            )
          ])
        )
      ]
    )
  )
}

/**
 * 生成组件唯一 ID（文件路径 + 组件名称）
 * 使用 FNV-1a 哈希算法生成短哈希值
 * @param filename - 文件路径
 * @param componentName - 组件名称
 * @returns 组件唯一 ID（十六进制字符串）
 */
function generateComponentId(filename: string, componentName: string): string {
  const combined = `${filename}:${componentName}`
  // FNV-1a 哈希算法初始值
  let hash = 2166136261
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // 转换为无符号整数并转为十六进制
  return (hash >>> 0).toString(16)
}

/**
 * 注入 HMR 支持
 * 主入口函数，为所有组件注入完整的 HMR 支持
 * @param program - AST Program 节点
 * @param components - 组件信息列表
 * @param filename - 文件名（用于生成组件唯一 ID）
 */
export function injectHMRSupport(
  program: t.Program,
  components: ComponentInfo[],
  filename: string
): void {
  // 如果没有组件，直接返回
  if (components.length === 0) return

  // 步骤1: 注入 HMR 相关的 import 语句
  injectHMRImport(program)
  injectGetComponentViewImport(program)

  // 步骤2: 为每个组件函数注入 HMR 注册代码和状态恢复
  for (const { node, isWrapped, name } of components) {
    injectHMRIntoFunction(node, isWrapped, name)
  }

  // 步骤3: 为每个组件创建 bindId 语句（用于热更新时识别）
  for (const { name } of components) {
    program.body.push(createBindIdStatement(name, generateComponentId(filename, name)))
  }

  // 步骤4: 创建 import.meta.hot.accept 语句（监听热更新事件）
  program.body.push(createHotAcceptStatement())
}

/**
 * 为「导入转发组件默认导出」的模块注入 accept-only HMR 支持
 *
 * 典型场景：文件路由的 _layout 转发文件（export default AdminLayout）。
 * 模块本身不含组件函数定义，无需 bindId 与函数体注入（函数体属于
 * 源模块，其自身已有完整 HMR）；仅需自接受模块更新并把新导出交给
 * HMRManager.update 按组件 id 热替换。
 * @param program - AST Program 节点
 */
export function injectHMRAcceptOnly(program: t.Program): void {
  injectHMRImport(program)
  program.body.push(createForwardingHotAcceptStatement())
}
