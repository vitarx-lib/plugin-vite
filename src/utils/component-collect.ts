/**
 * 组件收集模块
 * 负责从 AST 中收集组件函数信息
 * @module utils/component-collect
 */
import * as t from '@babel/types'
import { DEFAULT_EXPORT_BASE_NAME } from '../constants/index.js'
import { generateUniqueAlias } from './generate.js'
import {
  collectExportedNames,
  collectAllBindingNames,
  collectBuilderWrappedNames,
  isBuilderCall
} from './collect-names.js'

/**
 * 组件信息
 */
export interface ComponentInfo {
  name: string
  node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression
  /** 是否为包装组件（传递给 builder/defineComponent 等函数） */
  isWrapped?: boolean
}

/**
 * 生成唯一的默认导出组件名称
 * 避免与已存在的名称冲突
 */
function generateUniqueDefaultName(exportedNames: Set<string>): string {
  if (!exportedNames.has(DEFAULT_EXPORT_BASE_NAME)) {
    return DEFAULT_EXPORT_BASE_NAME
  }
  return generateUniqueAlias(DEFAULT_EXPORT_BASE_NAME, exportedNames)
}

/**
 * 检查名称是否为有效的组件名称
 * 必须以大写字母开头
 */
function isValidComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function tryAddComponent(
  name: string,
  node: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderWrappedNames: Set<string> = new Set()
): void {
  if (isValidComponentName(name) && exportedNames.has(name)) {
    const isWrapped = builderWrappedNames.has(name)
    components.push({ name, node, isWrapped })
  }
}

/**
 * 处理变量声明中的组件
 */
function processVariableDeclaration(
  declaration: t.VariableDeclaration,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderWrappedNames: Set<string> = new Set()
): void {
  for (const decl of declaration.declarations) {
    if (decl.id.type !== 'Identifier') continue

    const init = decl.init
    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
      tryAddComponent(decl.id.name, init, exportedNames, components, builderWrappedNames)
    }
  }
}

/**
 * 将函数表达式或箭头函数转换为命名函数声明
 */
function convertToNamedFunctionDeclaration(
  func: t.FunctionExpression | t.ArrowFunctionExpression,
  name: string
): t.FunctionDeclaration {
  let body: t.BlockStatement
  if (func.type === 'ArrowFunctionExpression' && func.body.type !== 'BlockStatement') {
    body = t.blockStatement([t.returnStatement(func.body)])
  } else {
    body = func.body as t.BlockStatement
  }

  const funcDecl = t.functionDeclaration(
    t.identifier(name),
    func.params,
    body,
    func.type === 'FunctionExpression' ? func.generator : false,
    func.async
  )
  funcDecl.loc = func.loc
  return funcDecl
}

/**
 * 从调用表达式中提取函数参数
 * 将 export default builder(()=><div/>) 转换为：
 * const _defaultExport = ()=><div/>
 * export default builder(_defaultExport)
 * @param callExpr - 调用表达式
 * @param exportedNames - 已存在的名称集合
 * @param builderAlias - builder 的本地别名
 * @returns 提取结果，包含名称、函数声明节点和是否是 builder 包装
 */
function extractFunctionFromCallExpression(
  callExpr: t.CallExpression,
  exportedNames: Set<string>,
  builderAlias: string | null
): { name: string; funcNode: t.FunctionDeclaration; isBuilderWrapped: boolean } | null {
  const isBuilder = isBuilderCall(callExpr, builderAlias)
  for (let i = 0; i < callExpr.arguments.length; i++) {
    const arg = callExpr.arguments[i]
    if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      const name = generateUniqueDefaultName(exportedNames)
      const funcNode = convertToNamedFunctionDeclaration(arg, name)
      callExpr.arguments[i] = t.identifier(name)
      return { name, funcNode, isBuilderWrapped: isBuilder }
    }
  }
  return null
}

/**
 * 处理默认导出的匿名函数
 * 为匿名函数生成唯一名称并转换为命名函数声明
 * @param node - 默认导出节点
 * @param program - AST Program 节点，用于插入提取的函数声明
 * @param exportedNames - 已存在的名称集合
 * @param components - 组件信息数组
 * @param builderAlias - builder 的本地别名
 */
function processAnonymousDefaultExport(
  node: t.ExportDefaultDeclaration,
  program: t.Program,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderAlias: string | null
): void {
  const decl = node.declaration
  let funcNode: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression | null =
    null
  let name: string
  let isWrapped = false

  if (decl.type === 'FunctionDeclaration' && !decl.id) {
    name = generateUniqueDefaultName(exportedNames)
    decl.id = t.identifier(name)
    funcNode = decl
  } else if (decl.type === 'FunctionExpression') {
    name = generateUniqueDefaultName(exportedNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'ArrowFunctionExpression') {
    name = generateUniqueDefaultName(exportedNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'CallExpression') {
    const result = extractFunctionFromCallExpression(decl, exportedNames, builderAlias)
    if (result) {
      name = result.name
      funcNode = result.funcNode
      isWrapped = result.isBuilderWrapped
      const exportIndex = program.body.indexOf(node as t.Statement)
      if (exportIndex !== -1) {
        program.body.splice(exportIndex, 0, funcNode)
      }
    }
  }

  if (funcNode) {
    components.push({ name: name!, node: funcNode, isWrapped })
  }
}

/**
 * 收集模块中的组件函数
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
      processVariableDeclaration(node, exportedNames, components, builderWrappedNames)
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
        tryAddComponent(
          node.declaration.id.name,
          node.declaration,
          exportedNames,
          components,
          builderWrappedNames
        )
      } else if (node.declaration.type === 'VariableDeclaration') {
        processVariableDeclaration(
          node.declaration,
          exportedNames,
          components,
          builderWrappedNames
        )
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        tryAddComponent(decl.id.name, decl, exportedNames, components, builderWrappedNames)
      } else {
        processAnonymousDefaultExport(node, program, allBindingNames, components, builderAlias)
      }
    }
  }

  return components
}
