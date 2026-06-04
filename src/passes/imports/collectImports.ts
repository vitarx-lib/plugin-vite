/**
 * 导入收集模块
 * 负责收集现有导入信息和本地变量绑定
 * @module passes/imports/collectImports
 */
import * as t from '@babel/types'
import { VITARX_MODULE } from '../../constants/index.js'
import { collectPatternBindings } from '../../utils/index.js'

/**
 * 收集现有 vitarx 导入信息
 * 只收集普通的 import 语句，跳过 import type/typeof 语句
 * @param program - AST Program 节点
 * @returns 映射表：导入名 -> 本地别名
 */
export function collectExistingImports(program: t.Program): Map<string, string> {
  // 存储导入名到本地别名的映射
  const vitarxImports = new Map<string, string>()

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 跳过非导入声明节点
    if (node.type !== 'ImportDeclaration') continue

    // 跳过类型导入（不影响运行时）
    if (node.importKind === 'type' || node.importKind === 'typeof') continue

    // 只处理 vitarx 模块的导入
    const source = node.source.value
    if (source !== VITARX_MODULE) continue

    // 遍历导入说明符
    for (const specifier of node.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        // 获取导入的原始名称（支持字符串字面量和标识符）
        const importedName =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        // 记录导入名到本地别名的映射
        vitarxImports.set(importedName, specifier.local.name)
      }
    }
  }

  return vitarxImports
}

/**
 * 收集本地变量绑定
 * 包括导入绑定、变量声明、函数声明、类声明
 * 只收集运行时存在的绑定，跳过 import type/typeof
 * @param program - AST Program 节点
 * @returns 本地变量名集合
 */
export function collectLocalBindings(program: t.Program): Set<string> {
  const bindings = new Set<string>()

  // 遍历程序体中的所有节点
  for (const node of program.body) {
    // 处理导入声明
    if (node.type === 'ImportDeclaration') {
      // 跳过类型导入（不影响运行时绑定）
      if (node.importKind === 'type' || node.importKind === 'typeof') continue
      // 收集所有导入的本地名称
      for (const specifier of node.specifiers) {
        bindings.add(specifier.local.name)
      }
    }

    // 处理变量声明（支持解构赋值）
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        // 跳过 void 模式（如 void 0）
        if (decl.id.type !== 'VoidPattern') {
          collectPatternBindings(decl.id, bindings)
        }
      }
    }

    // 处理函数声明
    if (node.type === 'FunctionDeclaration' && node.id) {
      bindings.add(node.id.name)
    }

    // 处理类声明
    if (node.type === 'ClassDeclaration' && node.id) {
      bindings.add(node.id.name)
    }
  }

  return bindings
}
