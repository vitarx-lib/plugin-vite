/**
 * 名称收集模块
 * 负责从 AST 中收集导出名称、绑定名称和 builder 包装名称
 * @module utils/collect-names
 */
import type * as t from '@babel/types'

/**
 * 从命名导出中收集名称
 */
export function collectFromNamedExport(node: t.ExportNamedDeclaration, names: Set<string>): void {
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
  if (node.specifiers) {
    for (const spec of node.specifiers) {
      if (spec.type === 'ExportSpecifier') {
        names.add(spec.local.name)
      }
    }
  }
}

/**
 * 从默认导出中收集名称
 */
export function collectFromDefaultExport(node: t.ExportDefaultDeclaration, names: Set<string>): void {
  const decl = node.declaration
  if (decl.type === 'FunctionDeclaration' && decl.id) {
    names.add(decl.id.name)
  } else if (decl.type === 'Identifier') {
    names.add(decl.name)
  }
}

/**
 * 从变量声明中收集变量名
 */
function collectFromVariableDeclaration(node: t.VariableDeclaration, names: Set<string>): void {
  for (const decl of node.declarations) {
    if (decl.id.type === 'Identifier') {
      names.add(decl.id.name)
    }
  }
}

/**
 * 从导入声明中收集绑定的名称
 */
function collectFromImportDeclaration(node: t.ImportDeclaration, names: Set<string>): void {
  for (const spec of node.specifiers) {
    names.add(spec.local.name)
  }
}

/**
 * 收集所有导出的标识符名称
 */
export function collectExportedNames(program: t.Program): Set<string> {
  const names = new Set<string>()

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
 */
export function collectAllBindingNames(program: t.Program): Set<string> {
  const names = new Set<string>()

  for (const node of program.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      names.add(node.id.name)
    } else if (node.type === 'VariableDeclaration') {
      collectFromVariableDeclaration(node, names)
    } else if (node.type === 'ImportDeclaration') {
      collectFromImportDeclaration(node, names)
    } else if (node.type === 'ExportNamedDeclaration') {
      collectFromNamedExport(node, names)
    } else if (node.type === 'ExportDefaultDeclaration') {
      collectFromDefaultExport(node, names)
    }
  }

  return names
}

/**
 * 判断调用表达式是否是 builder 调用
 * @param callExpr - 调用表达式
 * @param builderAlias - builder 的本地别名
 * @returns 是否是 builder 调用
 */
export function isBuilderCall(callExpr: t.CallExpression, builderAlias: string | null): boolean {
  if (!builderAlias) return false
  const callee = callExpr.callee
  return callee.type === 'Identifier' && callee.name === builderAlias
}

/**
 * 收集被 builder 调用的组件名称
 * 检测 builder(Comp) 或 builder(Comp, options) 形式的调用
 * @param program - AST Program 节点
 * @param builderAlias - builder 的本地别名
 * @returns 被 builder 调用的组件名称集合
 */
export function collectBuilderWrappedNames(
  program: t.Program,
  builderAlias: string | null
): Set<string> {
  const wrappedNames = new Set<string>()
  if (!builderAlias) return wrappedNames

  for (const node of program.body) {
    if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
      const callExpr = node.expression
      if (isBuilderCall(callExpr, builderAlias)) {
        const arg = callExpr.arguments[0]
        if (arg?.type === 'Identifier') {
          wrappedNames.add(arg.name)
        }
      }
    }
  }

  return wrappedNames
}
