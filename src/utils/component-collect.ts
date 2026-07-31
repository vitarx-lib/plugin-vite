/**
 * 组件收集模块
 * 负责从 AST 中收集组件函数信息
 * @module utils/component-collect
 */
import * as t from '@babel/types'
// 导入名称收集相关工具函数
import {
  collectAllBindingNames,
  collectBuilderWrappedNames,
  collectExportedNames
} from './collect-names.js'
import { extractFunctionFromVariableInit } from './function-extract.js'
import {
  processAnonymousDefaultExport,
  processIdentifierDefaultExport
} from './default-export.js'

/**
 * 组件信息接口
 * 描述从 AST 中提取的组件函数信息
 */
export interface ComponentInfo {
  // 组件名称
  name: string
  // 函数节点，可以是函数声明、箭头函数表达式或函数表达式
  node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression
  /** 是否为包装组件（传递给 builder 函数） */
  isWrapped?: boolean
}

/**
 * 检查名称是否为有效的组件名称
 * 必须以大写字母开头（符合 React/Vue 组件命名规范）
 * @param name - 待检查的名称
 * @returns 是否为有效组件名称
 */
export function isValidComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}

/**
 * 尝试添加组件信息到组件列表中
 * @param name - 组件名称
 * @param node - 函数声明节点
 * @param exportedNames - 已导出的名称集合
 * @param components - 组件信息数组
 * @param builderWrappedNames - 已被包装器包装的函数名称集合
 */
function tryAddComponent(
  name: string,
  node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderWrappedNames: Set<string> = new Set()
): void {
  // 检查组件名称是否有效（大写开头）且是否已导出
  if (isValidComponentName(name) && exportedNames.has(name)) {
    const isWrapped = builderWrappedNames.has(name)
    components.push({ name, node, isWrapped })
  }
}

/**
 * 处理变量声明中的组件
 * 提取变量赋值中的箭头函数、函数表达式或 builder 包装调用作为组件
 * @param declaration - 变量声明节点
 * @param exportedNames - 已导出的名称集合
 * @param components - 组件信息数组
 * @param builderWrappedNames - 已被包装器包装的函数名称集合
 * @param program - AST Program 节点，用于插入提取的函数声明
 * @param builderAlias - builder 的本地别名
 * @param allBindingNames - 所有绑定名称集合（用于生成唯一名称时避免冲突）
 */
function processVariableDeclaration(
  declaration: t.VariableDeclaration,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderWrappedNames: Set<string> = new Set(),
  program?: t.Program,
  builderAlias?: string | null,
  allBindingNames?: Set<string>
): void {
  for (const decl of declaration.declarations) {
    // 跳过非标识符的变量名（如解构赋值）
    if (decl.id.type !== 'Identifier') continue

    const init = decl.init
    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
      tryAddComponent(decl.id.name, init, exportedNames, components, builderWrappedNames)
    } else if (
      init?.type === 'CallExpression' &&
      program &&
      builderAlias != null &&
      allBindingNames
    ) {
      // 处理 builder 包装的变量声明：const App = builder(() => <div/>)
      if (!isValidComponentName(decl.id.name) || !exportedNames.has(decl.id.name)) continue

      const result = extractFunctionFromVariableInit(
        init,
        decl.id.name,
        allBindingNames,
        builderAlias
      )
      if (result) {
        // 找到包含该变量声明的语句在 program.body 中的位置
        const stmtIndex = program.body.findIndex(stmt => {
          if (stmt === declaration) return true
          return stmt.type === 'ExportNamedDeclaration' && stmt.declaration === declaration
        })
        if (stmtIndex !== -1) {
          program.body.splice(stmtIndex, 0, result.funcNode)
        }
        components.push({
          name: result.name,
          node: result.funcNode,
          isWrapped: result.isBuilderWrapped
        })
      }
    }
  }
}

/**
 * 收集模块中的组件函数
 * 遍历 AST 程序节点，提取所有导出的组件函数
 * @param program - AST Program 节点
 * @param builderAlias - builder 函数的本地别名（用于识别纯构建组件）
 * @returns 组件信息数组
 */
export function collectComponentFunctions(
  program: t.Program,
  builderAlias: string | null = null
): ComponentInfo[] {
  const exportedNames = collectExportedNames(program)
  const allBindingNames = collectAllBindingNames(program)
  const builderWrappedNames = collectBuilderWrappedNames(program, builderAlias)
  const components: ComponentInfo[] = []

  for (const node of program.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      tryAddComponent(node.id.name, node, exportedNames, components, builderWrappedNames)
    } else if (node.type === 'VariableDeclaration') {
      processVariableDeclaration(
        node, exportedNames, components, builderWrappedNames,
        program, builderAlias, allBindingNames
      )
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
        tryAddComponent(
          node.declaration.id.name, node.declaration,
          exportedNames, components, builderWrappedNames
        )
      } else if (node.declaration.type === 'VariableDeclaration') {
        processVariableDeclaration(
          node.declaration, exportedNames, components, builderWrappedNames,
          program, builderAlias, allBindingNames
        )
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        tryAddComponent(decl.id.name, decl, exportedNames, components, builderWrappedNames)
      } else if (decl.type === 'Identifier') {
        processIdentifierDefaultExport(decl, program, allBindingNames, components, builderAlias)
      } else {
        processAnonymousDefaultExport(node, program, allBindingNames, components, builderAlias)
      }
    }
  }

  return components
}
