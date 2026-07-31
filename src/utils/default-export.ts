/**
 * 默认导出处理模块
 * 处理 export default 的各种形式，提取组件函数
 * @module utils/default-export
 */
import * as t from '@babel/types'
import { generateUniqueDefaultName } from './generate.js'
import {
  convertToNamedFunctionDeclaration,
  extractFunctionFromCallExpression,
  extractFunctionFromVariableInit
} from './function-extract.js'
import type { ComponentInfo } from './component-collect.js'
import { isValidComponentName } from './component-collect.js'

/**
 * 在 program.body 中查找指定名称的变量声明
 * 用于处理 export default X 场景，追溯标识符对应的变量声明
 * @param program - AST Program 节点
 * @param name - 要查找的变量名
 * @returns 包含变量声明和所在语句的对象，未找到返回 null
 */
export function findVariableDeclaration(
  program: t.Program,
  name: string
): { decl: t.VariableDeclarator; statement: t.Statement } | null {
  for (const stmt of program.body) {
    // 查找普通变量声明
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === name) {
          return { decl, statement: stmt }
        }
      }
    }
    // 查找命名导出中的变量声明
    if (
      stmt.type === 'ExportNamedDeclaration' &&
      stmt.declaration?.type === 'VariableDeclaration'
    ) {
      for (const decl of stmt.declaration.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === name) {
          return { decl, statement: stmt }
        }
      }
    }
  }
  return null
}

/**
 * 处理默认导出的匿名函数
 * 为匿名函数生成唯一名称并转换为命名函数声明
 * @param node - 默认导出节点
 * @param program - AST Program 节点，用于插入提取的函数声明
 * @param allBindingNames - 所有绑定名称集合（用于生成唯一名称时避免冲突）
 * @param components - 组件信息数组
 * @param builderAlias - builder 的本地别名
 */
export function processAnonymousDefaultExport(
  node: t.ExportDefaultDeclaration,
  program: t.Program,
  allBindingNames: Set<string>,
  components: ComponentInfo[],
  builderAlias: string | null
): void {
  const decl = node.declaration
  let funcNode: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression | null =
    null
  let name: string
  let isWrapped = false

  // 处理无名称的函数声明 export default function() {}
  if (decl.type === 'FunctionDeclaration' && !decl.id) {
    name = generateUniqueDefaultName(allBindingNames)
    decl.id = t.identifier(name)
    funcNode = decl
  } else if (decl.type === 'FunctionExpression') {
    // 处理函数表达式 export default function() {}
    name = generateUniqueDefaultName(allBindingNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'ArrowFunctionExpression') {
    // 处理箭头函数 export default () => {}
    name = generateUniqueDefaultName(allBindingNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'CallExpression') {
    // 处理包装调用 export default builder(() => {})
    const result = extractFunctionFromCallExpression(decl, allBindingNames, builderAlias)
    if (result) {
      name = result.name
      funcNode = result.funcNode
      isWrapped = result.isBuilderWrapped
      // 将提取的函数声明插入到导出语句之前
      const exportIndex = program.body.indexOf(node as t.Statement)
      if (exportIndex !== -1) {
        program.body.splice(exportIndex, 0, funcNode)
      }
    }
  }

  // 如果成功提取到函数节点，添加到组件列表
  if (funcNode) {
    components.push({ name: name!, node: funcNode, isWrapped })
  }
}

/**
 * 处理标识符默认导出的 builder 包装追溯
 * 处理 export default X 场景，追溯 X 是否为 builder 包装的组件
 * @param decl - 标识符声明节点
 * @param program - AST Program 节点
 * @param allBindingNames - 所有绑定名称集合
 * @param components - 组件信息数组
 * @param builderAlias - builder 的本地别名
 */
export function processIdentifierDefaultExport(
  decl: t.Identifier,
  program: t.Program,
  allBindingNames: Set<string>,
  components: ComponentInfo[],
  builderAlias: string | null
): void {
  // 追溯标识符对应的变量声明，判断是否为 builder 包装组件
  if (!isValidComponentName(decl.name)) return

  const varDecl = findVariableDeclaration(program, decl.name)
  if (varDecl?.decl.init?.type !== 'CallExpression') return

  const result = extractFunctionFromVariableInit(
    varDecl.decl.init,
    decl.name,
    allBindingNames,
    builderAlias
  )
  if (!result) return

  // 将提取的函数声明插入到变量声明所在语句之前
  const stmtIndex = program.body.indexOf(varDecl.statement)
  if (stmtIndex !== -1) {
    program.body.splice(stmtIndex, 0, result.funcNode)
  }
  components.push({
    name: result.name,
    node: result.funcNode,
    isWrapped: result.isBuilderWrapped
  })
}
