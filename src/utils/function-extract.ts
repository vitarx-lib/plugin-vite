/**
 * 函数提取模块
 * 从调用表达式中提取匿名函数，转换为命名函数声明
 * @module utils/function-extract
 */
import * as t from '@babel/types'
import { isBuilderCall } from './collect-names.js'
import { generateUniqueAlias, generateUniqueDefaultName } from './generate.js'

/**
 * 将函数表达式或箭头函数转换为命名函数声明
 * 用于将匿名函数转换为可追踪的命名函数
 * @param func - 函数表达式或箭头函数节点
 * @param name - 生成的函数名称
 * @returns 命名函数声明节点
 */
export function convertToNamedFunctionDeclaration(
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
export function extractFunctionFromCallExpression(
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
 * 从变量声明的调用表达式中提取函数
 * 将 const App = builder(() => <div/>) 转换为：
 * function App$1() { return <div/> }
 * const App = builder(App$1)
 * @param callExpr - 调用表达式
 * @param variableName - 变量名（作为内部函数名的基础）
 * @param allBindingNames - 所有绑定名称集合（用于避免命名冲突）
 * @param builderAlias - builder 的本地别名
 * @returns 提取结果，包含名称、函数声明节点和是否是 builder 包装
 */
export function extractFunctionFromVariableInit(
  callExpr: t.CallExpression,
  variableName: string,
  allBindingNames: Set<string>,
  builderAlias: string | null
): { name: string; funcNode: t.FunctionDeclaration; isBuilderWrapped: boolean } | null {
  // 判断是否为 builder 函数调用
  const isBuilder = isBuilderCall(callExpr, builderAlias)
  // 遍历调用表达式的所有参数
  for (let i = 0; i < callExpr.arguments.length; i++) {
    const arg = callExpr.arguments[i]
    // 找到作为参数传入的匿名函数
    if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      // 以变量名为基础生成唯一别名，避免与已有名称冲突
      const name = generateUniqueAlias(variableName, allBindingNames)
      // 将新名称加入集合，防止后续生成重复名称
      allBindingNames.add(name)
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
