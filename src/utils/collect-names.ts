/**
 * 名称收集模块
 * 负责从 AST 中收集导出名称、绑定名称和 builder 包装名称
 * @module utils/collect-names
 */
import type * as t from '@babel/types'

/**
 * 从命名导出声明中收集名称
 * @param node - 命名导出声明节点
 * @param names - 存储名称的集合
 */
export function collectFromNamedExport(node: t.ExportNamedDeclaration, names: Set<string>): void {
  // 处理内联声明（export function/const）
  if (node.declaration) {
    if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
      names.add(node.declaration.id.name)
    } else if (node.declaration.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === 'Identifier') {
          names.add(decl.id.name)
        }
      }
    }
  }
  // 处理导出说明符（export { a, b }）
  if (node.specifiers) {
    for (const spec of node.specifiers) {
      if (spec.type === 'ExportSpecifier') {
        names.add(spec.local.name)
      }
    }
  }
}

/**
 * 从默认导出声明中收集名称
 * @param node - 默认导出声明节点
 * @param names - 存储名称的集合
 */
export function collectFromDefaultExport(node: t.ExportDefaultDeclaration, names: Set<string>): void {
  const decl = node.declaration
  // 处理命名函数声明
  if (decl.type === 'FunctionDeclaration' && decl.id) {
    names.add(decl.id.name)
  } else if (decl.type === 'Identifier') {
    // 处理标识符引用（export default Component）
    names.add(decl.name)
  }
}

/**
 * 从变量声明中收集变量名
 * @param node - 变量声明节点
 * @param names - 存储名称的集合
 */
function collectFromVariableDeclaration(node: t.VariableDeclaration, names: Set<string>): void {
  for (const decl of node.declarations) {
    // 只处理简单标识符（不处理解构）
    if (decl.id.type === 'Identifier') {
      names.add(decl.id.name)
    }
  }
}

/**
 * 从导入声明中收集绑定的名称
 * @param node - 导入声明节点
 * @param names - 存储名称的集合
 */
function collectFromImportDeclaration(node: t.ImportDeclaration, names: Set<string>): void {
  for (const spec of node.specifiers) {
    // 收集本地绑定名称
    names.add(spec.local.name)
  }
}

/**
 * 收集所有导出的标识符名称
 * @param program - AST Program 节点
 * @returns 导出名称集合
 */
export function collectExportedNames(program: t.Program): Set<string> {
  const names = new Set<string>()

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      collectFromNamedExport(node, names)
    } else if (node.type === 'ExportDefaultDeclaration') {
      collectFromDefaultExport(node, names)
    }
  }

  return names
}

/**
 * 收集模块中所有绑定的名称（用于避免命名冲突）
 * 包括函数声明、变量声明、导入声明和导出声明
 * @param program - AST Program 节点
 * @returns 所有绑定名称集合
 */
export function collectAllBindingNames(program: t.Program): Set<string> {
  const names = new Set<string>()

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 函数声明
    if (node.type === 'FunctionDeclaration' && node.id) {
      names.add(node.id.name)
    } else if (node.type === 'VariableDeclaration') {
      // 变量声明
      collectFromVariableDeclaration(node, names)
    } else if (node.type === 'ImportDeclaration') {
      // 导入声明
      collectFromImportDeclaration(node, names)
    } else if (node.type === 'ExportNamedDeclaration') {
      // 命名导出
      collectFromNamedExport(node, names)
    } else if (node.type === 'ExportDefaultDeclaration') {
      // 默认导出
      collectFromDefaultExport(node, names)
    }
  }

  return names
}

/**
 * 判断调用表达式是否是 builder 调用
 * @param callExpr - 调用表达式节点
 * @param builderAlias - builder 的本地别名
 * @returns 是否是 builder 调用
 */
export function isBuilderCall(callExpr: t.CallExpression, builderAlias: string | null): boolean {
  // 如果没有配置 builder 别名，直接返回 false
  if (!builderAlias) return false
  const callee = callExpr.callee
  // 检查调用者是否为标识符且名称匹配
  return callee.type === 'Identifier' && callee.name === builderAlias
}

/**
 * 收集被 builder 调用的组件名称
 * 检测 builder(Comp) 或 builder(Comp, options) 形式的调用
 * @param program - AST Program 节点
 * @param builderAlias - builder 的本地别名
 * @returns 被 builder 包装的组件名称集合
 */
export function collectBuilderWrappedNames(
  program: t.Program,
  builderAlias: string | null
): Set<string> {
  const wrappedNames = new Set<string>()
  // 如果没有配置 builder 别名，直接返回空集合
  if (!builderAlias) return wrappedNames

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 处理独立调用语句：builder(Comp)
    if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
      const callExpr = node.expression
      if (isBuilderCall(callExpr, builderAlias)) {
        const arg = callExpr.arguments[0]
        if (arg?.type === 'Identifier') {
          wrappedNames.add(arg.name)
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'CallExpression') {
      // 处理默认导出：export default builder(Comp)
      const callExpr = node.declaration
      if (isBuilderCall(callExpr, builderAlias)) {
        const arg = callExpr.arguments[0]
        if (arg?.type === 'Identifier') {
          wrappedNames.add(arg.name)
        }
      }
    } else if (node.type === 'VariableDeclaration') {
      // 处理变量声明：const Comp = builder(CompImpl)
      for (const decl of node.declarations) {
        if (decl.init?.type === 'CallExpression' && isBuilderCall(decl.init, builderAlias)) {
          const arg = decl.init.arguments[0]
          if (arg?.type === 'Identifier') {
            wrappedNames.add(arg.name)
          }
        }
      }
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
      // 处理命名导出：export const Comp = builder(CompImpl)
      for (const decl of node.declaration.declarations) {
        if (decl.init?.type === 'CallExpression' && isBuilderCall(decl.init, builderAlias)) {
          const arg = decl.init.arguments[0]
          if (arg?.type === 'Identifier') {
            wrappedNames.add(arg.name)
          }
        }
      }
    }
  }

  return wrappedNames
}
