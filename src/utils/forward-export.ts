/**
 * 导入转发默认导出检测
 *
 * 识别「纯转发组件默认导出」的模块——典型场景是文件路由的 _layout 布局
 * 转发文件（`export default AdminLayout` / `export { AdminLayout as default }`，
 * AdminLayout 为 import 绑定）。此类模块本身不含组件函数定义，组件收集
 * 结果为空，此前不会注入任何 HMR 代码，编辑该文件时 Vite 找不到自接受
 * 边界而回落整页刷新。
 *
 * 注意只匹配组件形态（大写开头）的导入绑定：转发普通值（工具函数、常量）
 * 的模块不具备组件热更新能力，保持整页刷新的默认行为。
 * @module utils/forward-export
 */
import * as t from '@babel/types'
import { isValidComponentName } from './component-collect.js'

/**
 * 收集模块内所有本地 import 绑定名称
 * @param program - AST Program 节点
 * @returns 导入绑定名称集合
 */
function collectImportedBindingNames(program: t.Program): Set<string> {
  const importedBindings = new Set<string>()
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue
    for (const spec of node.specifiers) {
      importedBindings.add(spec.local.name)
    }
  }
  return importedBindings
}

/**
 * 解包 TS 类型包装表达式
 *
 * `export default X as T` 在 babel TS 插件下解析为 TSAsExpression
 * （还有 satisfies / 非空断言变体），解包到真实表达式后再判定。
 * @param node - 默认导出声明表达式
 * @returns 解包后的表达式
 */
function unwrapTsWrappers(node: t.Expression): t.Expression {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression'
  ) {
    node = node.expression
  }
  return node
}

/**
 * 检测模块是否存在「导入转发形式的组件默认导出」
 *
 * 覆盖两种转发形态（转发目标均为本地 import 绑定且大写开头）：
 * 1. `export default AdminLayout`（含 `as T` 断言包装）
 * 2. `export { AdminLayout as default }`
 *
 * 带 source 的 re-export（`export { X as default } from './x'`）没有本地
 * 绑定，不在导入绑定集合中，天然被排除。
 *
 * @param program - AST Program 节点
 * @returns 是否存在转发形式的组件默认导出
 */
export function hasForwardedComponentDefaultExport(program: t.Program): boolean {
  const importedBindings = collectImportedBindingNames(program)
  if (importedBindings.size === 0) return false

  for (const node of program.body) {
    // 形态1：export default X
    if (node.type === 'ExportDefaultDeclaration') {
      const decl = unwrapTsWrappers(node.declaration as t.Expression)
      if (decl.type === 'Identifier') {
        const name = decl.name
        if (importedBindings.has(name) && isValidComponentName(name)) return true
      }
    }
    // 形态2：export { X as default }
    if (node.type === 'ExportNamedDeclaration') {
      for (const spec of node.specifiers) {
        if (
          spec.type === 'ExportSpecifier' &&
          spec.exported.type === 'Identifier' &&
          spec.exported.name === 'default' &&
          spec.local.type === 'Identifier' &&
          importedBindings.has(spec.local.name) &&
          isValidComponentName(spec.local.name)
        ) {
          return true
        }
      }
    }
  }
  return false
}
