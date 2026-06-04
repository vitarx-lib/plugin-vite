/**
 * Ref 变量收集模块
 * 负责识别 ref API 别名和收集 ref 变量
 * @module passes/imports/collectRefVariables
 */
import * as t from '@babel/types'
import { REF_APIS, RESPONSIVE_MODULES } from '../../constants/index.js'
import type { RefApiAliases } from '../../context.js'
import { collectPatternBindings, collectObjectPatternBindings } from '../../utils/index.js'

/**
 * 收集 ref API 的别名
 * 识别从 vitarx 或 @vitarx/responsive 导入的 ref/toRef/toRefs/shallowRef/computed
 * @param program - AST Program 节点
 * @returns ref API 别名映射
 */
export function collectRefApiAliases(program: t.Program): RefApiAliases {
  // 初始化别名映射，默认为 null（未导入）
  const aliases: RefApiAliases = {
    ref: null,
    toRef: null,
    toRefs: null,
    shallowRef: null,
    computed: null
  }

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 跳过非导入声明节点
    if (node.type !== 'ImportDeclaration') continue
    const source = node.source.value
    // 只处理 vitarx 和 @vitarx/responsive 模块
    if (!RESPONSIVE_MODULES.includes(source as any)) continue

    // 遍历导入说明符
    for (const specifier of node.specifiers) {
      // 只处理命名导入
      if (specifier.type !== 'ImportSpecifier') continue

      // 获取导入的原始名称
      const importedName =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value

      // 如果是 ref API，记录别名映射
      if (Object.values(REF_APIS).includes(importedName as any)) {
        aliases[importedName as keyof RefApiAliases] = specifier.local.name
      }
    }
  }

  return aliases
}

/**
 * 收集通过 ref API 定义的变量
 * 包括直接赋值（const x = ref(0)）和 toRefs 解构（const { a, b } = toRefs(obj)）
 * @param program - AST Program 节点
 * @param refApiAliases - ref API 别名映射
 * @returns ref 变量名集合
 */
export function collectRefVariables(program: t.Program, refApiAliases: RefApiAliases): Set<string> {
  const refVariables = new Set<string>()
  // 构建 ref API 的本地名称集合（包括别名）
  const { refApiLocalNames, toRefsLocalNames } = buildApiNameSets(refApiAliases)

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    collectRefVariablesFromNode(node, refVariables, refApiLocalNames, toRefsLocalNames)
  }

  return refVariables
}

/**
 * 从节点中递归收集 ref 变量
 * @param node - AST 节点
 * @param refVariables - 存储 ref 变量名的集合
 * @param refApiLocalNames - ref API 的本地名称集合
 * @param toRefsLocalNames - toRefs API 的本地名称集合
 */
function collectRefVariablesFromNode(
  node: t.Node,
  refVariables: Set<string>,
  refApiLocalNames: Set<string>,
  toRefsLocalNames: Set<string>
): void {
  // 处理变量声明
  if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      // 跳过没有初始值的声明
      if (!decl.init) continue
      // 跳过 void 模式
      if (decl.id.type === 'VoidPattern') continue

      const init = decl.init
      // 检查是否为函数调用表达式
      if (init.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
        continue
      }

      const calleeName = init.callee.name

      // toRefs 需要特殊处理：只收集对象解构的属性
      if (toRefsLocalNames.has(calleeName) && decl.id.type === 'ObjectPattern') {
        collectObjectPatternBindings(decl.id, refVariables)
      } else if (refApiLocalNames.has(calleeName)) {
        // 其他 ref API：收集变量名（支持解构）
        collectPatternBindings(decl.id, refVariables)
      }
    }
  } else if (node.type === 'FunctionDeclaration' && node.body) {
    // 递归处理函数体内的语句
    for (const stmt of node.body.body) {
      collectRefVariablesFromNode(stmt, refVariables, refApiLocalNames, toRefsLocalNames)
    }
  } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    // 处理命名导出的声明
    collectRefVariablesFromNode(node.declaration, refVariables, refApiLocalNames, toRefsLocalNames)
  } else if (node.type === 'ExportDefaultDeclaration') {
    // 处理默认导出
    const decl = node.declaration
    if (decl.type === 'FunctionDeclaration' && decl.body) {
      for (const stmt of decl.body.body) {
        collectRefVariablesFromNode(stmt, refVariables, refApiLocalNames, toRefsLocalNames)
      }
    }
  }
}

/**
 * 收集确定不是 ref 的变量
 * 包括函数声明、箭头函数和函数表达式变量（这些不可能是 ref）
 * @param program - AST Program 节点
 * @returns 非 ref 变量名集合
 */
export function collectNonRefVariables(program: t.Program): Set<string> {
  const nonRefVariables = new Set<string>()

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    collectNonRefFromNode(node, nonRefVariables)
  }

  return nonRefVariables
}

/**
 * 从节点中递归收集非 ref 变量
 * @param node - AST 节点
 * @param nonRefVariables - 存储非 ref 变量名的集合
 */
function collectNonRefFromNode(node: t.Node, nonRefVariables: Set<string>): void {
  // 函数声明一定不是 ref
  if (node.type === 'FunctionDeclaration' && node.id) {
    nonRefVariables.add(node.id.name)
    // 递归处理函数体内的变量
    if (node.body) {
      for (const stmt of node.body.body) {
        collectNonRefFromNode(stmt, nonRefVariables)
      }
    }
  } else if (node.type === 'VariableDeclaration') {
    // 变量声明：只有箭头函数或函数表达式才是非 ref
    for (const decl of node.declarations) {
      if (!decl.init) continue
      // 只处理简单标识符（不处理解构）
      if (decl.id.type !== 'Identifier') continue
      const init = decl.init
      if (
        init.type === 'ArrowFunctionExpression' ||
        init.type === 'FunctionExpression'
      ) {
        nonRefVariables.add(decl.id.name)
      }
    }
  } else if (node.type === 'ExportNamedDeclaration') {
    // 处理命名导出的声明
    if (node.declaration) {
      collectNonRefFromNode(node.declaration, nonRefVariables)
    }
  } else if (node.type === 'ExportDefaultDeclaration') {
    // 处理默认导出
    const decl = node.declaration
    if (decl.type === 'FunctionDeclaration' && decl.id) {
      nonRefVariables.add(decl.id.name)
    }
  }
}

/**
 * 构建 ref API 的本地名称集合
 * 将别名映射转换为集合，便于快速查找
 * @param refApiAliases - ref API 别名映射
 * @returns 包含 ref API 和 toRefs API 的本地名称集合
 */
function buildApiNameSets(refApiAliases: RefApiAliases): {
  refApiLocalNames: Set<string>
  toRefsLocalNames: Set<string>
} {
  const refApiLocalNames = new Set<string>()
  const toRefsLocalNames = new Set<string>()

  // 遍历所有 ref API
  for (const key of Object.keys(refApiAliases)) {
    const alias = refApiAliases[key as keyof RefApiAliases]
    if (alias) {
      // 如果有别名，使用别名
      if (key === 'toRefs') {
        toRefsLocalNames.add(alias)
      } else {
        refApiLocalNames.add(alias)
      }
    } else {
      // 如果没有别名，使用原始名称
      if (key === 'toRefs') {
        toRefsLocalNames.add(key)
      } else {
        refApiLocalNames.add(key)
      }
    }
  }

  return { refApiLocalNames, toRefsLocalNames }
}
