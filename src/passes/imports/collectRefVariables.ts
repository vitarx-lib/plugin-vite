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
  const aliases: RefApiAliases = {
    ref: null,
    toRef: null,
    toRefs: null,
    shallowRef: null,
    computed: null
  }

  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue
    const source = node.source.value
    if (!RESPONSIVE_MODULES.includes(source as any)) continue

    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue

      const importedName =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value

      if (Object.values(REF_APIS).includes(importedName as any)) {
        aliases[importedName as keyof RefApiAliases] = specifier.local.name
      }
    }
  }

  return aliases
}

/**
 * 收集通过 ref API 定义的变量
 * 包括直接赋值和 toRefs 解构
 * @param program - AST Program 节点
 * @param refApiAliases - ref API 别名映射
 * @returns ref 变量名集合
 */
export function collectRefVariables(program: t.Program, refApiAliases: RefApiAliases): Set<string> {
  const refVariables = new Set<string>()
  const { refApiLocalNames, toRefsLocalNames } = buildApiNameSets(refApiAliases)

  for (const node of program.body) {
    collectRefVariablesFromNode(node, refVariables, refApiLocalNames, toRefsLocalNames)
  }

  return refVariables
}

function collectRefVariablesFromNode(
  node: t.Node,
  refVariables: Set<string>,
  refApiLocalNames: Set<string>,
  toRefsLocalNames: Set<string>
): void {
  if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      if (!decl.init) continue
      if (decl.id.type === 'VoidPattern') continue

      const init = decl.init
      if (init.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
        continue
      }

      const calleeName = init.callee.name

      if (toRefsLocalNames.has(calleeName) && decl.id.type === 'ObjectPattern') {
        collectObjectPatternBindings(decl.id, refVariables)
      } else if (refApiLocalNames.has(calleeName)) {
        collectPatternBindings(decl.id, refVariables)
      }
    }
  } else if (node.type === 'FunctionDeclaration' && node.body) {
    for (const stmt of node.body.body) {
      collectRefVariablesFromNode(stmt, refVariables, refApiLocalNames, toRefsLocalNames)
    }
  } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    collectRefVariablesFromNode(node.declaration, refVariables, refApiLocalNames, toRefsLocalNames)
  } else if (node.type === 'ExportDefaultDeclaration') {
    const decl = node.declaration
    if (decl.type === 'FunctionDeclaration' && decl.body) {
      for (const stmt of decl.body.body) {
        collectRefVariablesFromNode(stmt, refVariables, refApiLocalNames, toRefsLocalNames)
      }
    }
  }
}

/**
 * 构建 API 名称集合
 */
function buildApiNameSets(refApiAliases: RefApiAliases): {
  refApiLocalNames: Set<string>
  toRefsLocalNames: Set<string>
} {
  const refApiLocalNames = new Set<string>()
  const toRefsLocalNames = new Set<string>()

  for (const key of Object.keys(refApiAliases)) {
    const alias = refApiAliases[key as keyof RefApiAliases]
    if (alias) {
      if (key === 'toRefs') {
        toRefsLocalNames.add(alias)
      } else {
        refApiLocalNames.add(alias)
      }
    } else {
      if (key === 'toRefs') {
        toRefsLocalNames.add(key)
      } else {
        refApiLocalNames.add(key)
      }
    }
  }

  return { refApiLocalNames, toRefsLocalNames }
}
