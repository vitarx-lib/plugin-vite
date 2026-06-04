/**
 * 导入注入模块
 * 负责动态注入 vitarx 导入语句
 * @module passes/imports/injectImports
 */
import * as t from '@babel/types'
import { VITARX_MODULE } from '../../constants/index.js'
import type { ImportInfo, TransformContext, VitarxImportAliases } from '../../context.js'

/**
 * API 导入配置
 * 定义需要注入的 API 及其与 ImportInfo 的映射关系
 * 当代码中使用了特定的 vitarx API 时，自动注入对应的 import 语句
 */
const API_IMPORT_CONFIG: Array<{
  name: keyof VitarxImportAliases
  importKey: keyof ImportInfo
}> = [
  { name: 'createView', importKey: 'createView' },
  { name: 'Fragment', importKey: 'Fragment' },
  { name: 'branch', importKey: 'branch' },
  { name: 'expr', importKey: 'expr' },
  { name: 'accessor', importKey: 'accessor' },
  { name: 'withDirectives', importKey: 'withDirectives' },
  { name: 'unref', importKey: 'unref' },
  { name: 'isRef', importKey: 'isRef' }
]

/**
 * 注入 vitarx 导入
 * 根据已使用的 API 动态生成导入语句
 * 如果已存在 vitarx 导入，则追加说明符；否则创建新的导入语句
 * @param program - AST Program 节点
 * @param ctx - 转换上下文
 */
export function injectImports(program: t.Program, ctx: TransformContext): void {
  // 如果没有需要注入的 API，直接返回
  if (!needsInject(ctx)) return

  // 查找已存在的 vitarx 导入语句
  const existingVitarxImport = findExistingVitarxImport(program)

  // 如果存在且可以追加说明符，则追加
  if (existingVitarxImport && canAppendSpecifiers(existingVitarxImport)) {
    appendImportSpecifiers(existingVitarxImport, ctx)
  } else {
    // 否则创建新的导入语句
    const specifiers = buildImportSpecifiers(ctx)
    if (specifiers.length === 0) return
    const importDecl = t.importDeclaration(specifiers, t.stringLiteral(VITARX_MODULE))
    program.body.unshift(importDecl)
  }
}

/**
 * 检查是否可以向导入语句追加说明符
 * 只有纯命名导入才能追加，命名空间导入（import * as xxx）和默认导入（import xxx）不能追加
 * @param importDecl - 导入声明节点
 * @returns 是否可以追加说明符
 */
function canAppendSpecifiers(importDecl: t.ImportDeclaration): boolean {
  for (const spec of importDecl.specifiers) {
    // 如果存在命名空间导入或默认导入，不能追加
    if (spec.type === 'ImportNamespaceSpecifier' || spec.type === 'ImportDefaultSpecifier') {
      return false
    }
  }
  return true
}

/**
 * 查找已存在的 vitarx 导入语句
 * 只查找普通的 import 语句，跳过 import type/typeof 语句
 * @param program - AST Program 节点
 * @returns 已存在的 vitarx 导入声明，不存在则返回 null
 */
function findExistingVitarxImport(program: t.Program): t.ImportDeclaration | null {
  for (const node of program.body) {
    if (
      node.type === 'ImportDeclaration' &&
      node.source.value === VITARX_MODULE &&
      node.importKind !== 'type' &&
      node.importKind !== 'typeof'
    ) {
      return node
    }
  }
  return null
}

/**
 * 向已存在的导入语句追加说明符
 * @param importDecl - 导入声明节点
 * @param ctx - 转换上下文
 */
function appendImportSpecifiers(importDecl: t.ImportDeclaration, ctx: TransformContext): void {
  // 收集已存在的本地名称，避免重复
  const existingLocals = new Set<string>()
  for (const spec of importDecl.specifiers) {
    if (spec.type === 'ImportSpecifier') {
      existingLocals.add(spec.local.name)
    }
  }

  // 遍历需要注入的 API
  for (const { name, importKey } of API_IMPORT_CONFIG) {
    // 如果该 API 未被使用，跳过
    if (!ctx.imports[importKey]) continue

    // 获取用户配置的别名，无别名则使用原始名称
    const alias = ctx.vitarxAliases[name]
    const localName = alias || name

    // 如果该本地名称已存在，跳过
    if (existingLocals.has(localName)) continue

    // 创建导入说明符并追加
    const imported = t.identifier(name)
    const local = t.identifier(localName)
    importDecl.specifiers.push(t.importSpecifier(local, imported))
  }
}

/**
 * 检查是否需要注入导入
 * @param ctx - 转换上下文
 * @returns 是否有需要注入的 API
 */
function needsInject(ctx: TransformContext): boolean {
  // 检查 imports 对象中是否有任何值为 true
  return Object.values(ctx.imports).some(Boolean)
}

/**
 * 构建导入说明符列表
 * @param ctx - 转换上下文
 * @returns 导入说明符数组
 */
function buildImportSpecifiers(ctx: TransformContext): t.ImportSpecifier[] {
  const specifiers: t.ImportSpecifier[] = []

  // 遍历需要注入的 API
  for (const { name, importKey } of API_IMPORT_CONFIG) {
    // 只处理已使用的 API
    if (ctx.imports[importKey]) {
      // 获取用户配置的别名
      const alias = ctx.vitarxAliases[name]
      const imported = t.identifier(name)
      const local = alias ? t.identifier(alias) : imported
      specifiers.push(t.importSpecifier(local, imported))
    }
  }

  return specifiers
}
