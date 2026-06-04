/**
 * 组件收集模块
 * 负责从 AST 中收集组件函数信息
 * @module utils/component-collect
 */
import * as t from '@babel/types'
import { DEFAULT_EXPORT_BASE_NAME } from '../constants/index.js'
// 导入名称收集相关工具函数
import {
  collectAllBindingNames,
  collectBuilderWrappedNames,
  collectExportedNames,
  isBuilderCall
} from './collect-names.js'
import { generateUniqueAlias } from './generate.js'

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
 * 生成唯一的默认导出组件名称
 * 避免与已存在的名称冲突
 */
function generateUniqueDefaultName(exportedNames: Set<string>): string {
  // 如果默认名称未被占用，直接返回
  if (!exportedNames.has(DEFAULT_EXPORT_BASE_NAME)) {
    return DEFAULT_EXPORT_BASE_NAME
  }
  // 否则生成唯一别名
  return generateUniqueAlias(DEFAULT_EXPORT_BASE_NAME, exportedNames)
}

/**
 * 检查名称是否为有效的组件名称
 * 必须以大写字母开头（符合 React/Vue 组件命名规范）
 */
function isValidComponentName(name: string): boolean {
  // 使用正则表达式检查首字母是否为大写
  return /^[A-Z]/.test(name)
}

/**
 * 尝试添加组件信息到组件列表中
 *
 * @param name 组件名称
 * @param node 函数声明节点，可以是函数声明、箭头函数表达式或函数表达式
 * @param exportedNames 已导出的名称集合
 * @param components 组件信息数组，用于存储符合条件的组件信息
 * @param builderWrappedNames 已被包装器包装的函数名称集合，默认为空集合
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
    // 判断组件是否已被 builder/defineComponent 等包装器包装
    const isWrapped = builderWrappedNames.has(name)
    // 将组件信息添加到组件数组中
    components.push({ name, node, isWrapped })
  }
}

/**
 * 处理变量声明中的组件
 * 提取变量赋值中的箭头函数或函数表达式作为组件
 */
function processVariableDeclaration(
  declaration: t.VariableDeclaration,
  exportedNames: Set<string>,
  components: ComponentInfo[],
  builderWrappedNames: Set<string> = new Set()
): void {
  // 遍历变量声明中的每个声明
  for (const decl of declaration.declarations) {
    // 跳过非标识符的变量名（如解构赋值）
    if (decl.id.type !== 'Identifier') continue

    const init = decl.init
    // 检查初始值是否为箭头函数或函数表达式
    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
      tryAddComponent(decl.id.name, init, exportedNames, components, builderWrappedNames)
    }
  }
}

/**
 * 将函数表达式或箭头函数转换为命名函数声明
 * 用于将匿名函数转换为可追踪的命名函数
 */
function convertToNamedFunctionDeclaration(
  func: t.FunctionExpression | t.ArrowFunctionExpression,
  name: string
): t.FunctionDeclaration {
  let body: t.BlockStatement
  // 处理箭头函数的隐式返回：将表达式体包装为显式 return 语句
  if (func.type === 'ArrowFunctionExpression' && func.body.type !== 'BlockStatement') {
    body = t.blockStatement([t.returnStatement(func.body)])
  } else {
    body = func.body as t.BlockStatement
  }

  // 创建函数声明节点
  const funcDecl = t.functionDeclaration(
    t.identifier(name), // 函数名称
    func.params, // 参数列表
    body, // 函数体
    func.type === 'FunctionExpression' ? func.generator : false, // 是否为生成器
    func.async // 是否为异步函数
  )
  // 保留原始位置信息用于源码映射
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
  // 判断是否为 builder 函数调用
  const isBuilder = isBuilderCall(callExpr, builderAlias)
  // 遍历调用表达式的所有参数
  for (let i = 0; i < callExpr.arguments.length; i++) {
    const arg = callExpr.arguments[i]
    // 找到作为参数传入的匿名函数
    if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      // 生成唯一名称
      const name = generateUniqueDefaultName(exportedNames)
      // 转换为命名函数声明
      const funcNode = convertToNamedFunctionDeclaration(arg, name)
      // 将原参数替换为标识符引用
      callExpr.arguments[i] = t.identifier(name)
      return { name, funcNode, isBuilderWrapped: isBuilder }
    }
  }
  // 未找到可提取的函数参数
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

  // 处理无名称的函数声明 export default function() {}
  if (decl.type === 'FunctionDeclaration' && !decl.id) {
    name = generateUniqueDefaultName(exportedNames)
    decl.id = t.identifier(name)
    funcNode = decl
  } else if (decl.type === 'FunctionExpression') {
    // 处理函数表达式 export default function() {}
    name = generateUniqueDefaultName(exportedNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'ArrowFunctionExpression') {
    // 处理箭头函数 export default () => {}
    name = generateUniqueDefaultName(exportedNames)
    funcNode = convertToNamedFunctionDeclaration(decl, name)
    node.declaration = funcNode
  } else if (decl.type === 'CallExpression') {
    // 处理包装调用 export default builder(() => {})
    const result = extractFunctionFromCallExpression(decl, exportedNames, builderAlias)
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
  // 收集所有已导出的名称
  const exportedNames = collectExportedNames(program)
  // 收集所有绑定名称（用于生成唯一名称时避免冲突）
  const allBindingNames = collectAllBindingNames(program)
  // 收集被 builder 包装的函数名称
  const builderWrappedNames = collectBuilderWrappedNames(program, builderAlias)
  // 存储收集到的组件信息
  const components: ComponentInfo[] = []

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 处理普通函数声明 function Component() {}
    if (node.type === 'FunctionDeclaration' && node.id) {
      tryAddComponent(node.id.name, node, exportedNames, components, builderWrappedNames)
    } else if (node.type === 'VariableDeclaration') {
      // 处理变量声明 const Component = () => {}
      processVariableDeclaration(node, exportedNames, components, builderWrappedNames)
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      // 处理命名导出 export function Component() {} 或 export const Component = () => {}
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
        tryAddComponent(
          node.declaration.id.name,
          node.declaration,
          exportedNames,
          components,
          builderWrappedNames
        )
      } else if (node.declaration.type === 'VariableDeclaration') {
        processVariableDeclaration(node.declaration, exportedNames, components, builderWrappedNames)
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      // 处理默认导出 export default Component 或 export default () => {}
      const decl = node.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        tryAddComponent(decl.id.name, decl, exportedNames, components, builderWrappedNames)
      } else {
        // 处理匿名默认导出
        processAnonymousDefaultExport(node, program, allBindingNames, components, builderAlias)
      }
    }
  }

  return components
}
