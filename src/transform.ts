/**
 * 主转换模块
 * 负责解析 JSX/TSX 代码并转换为 createView 调用
 * @module transform
 */
import generate, { type GeneratorResult } from '@babel/generator'
import { parse, type ParserOptions } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { createContext, type TransformContext } from './context.js'
import {
  collectExistingImports,
  collectLocalBindings,
  collectNonRefVariables,
  collectRefApiAliases,
  collectRefVariables,
  injectHMRSupport,
  injectImports,
  processJSXElement,
  processJSXFragment,
  processPureCompileComponent,
  processVIfChain,
  transformJSXElement
} from './passes/index.js'
import type { CompileOptions } from './types.js'
import {
  collectComponentFunctions,
  generateUniqueAlias,
  getJSXElementName,
  isPureCompileComponent
} from './utils/index.js'

export interface TransformResult extends GeneratorResult {}
const entryPatterns = [/\/src\/main\.(tsx|jsx)$/, /\\src\\main\.(tsx|jsx)$/]
/**
 * 创建解析器选项
 */
function createParserOptions(): ParserOptions {
  return {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'decorators',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator'
    ],
    // 确保保留位置信息
    ranges: true,
    tokens: false
  }
}

/**
 * 设置 API 别名
 */
function setupAliases(ctx: TransformContext, program: t.Program): void {
  const vitarxImports = collectExistingImports(program)
  const localBindings = collectLocalBindings(program)
  const allNames = new Set([...localBindings])

  const apiNames: Array<keyof typeof ctx.vitarxAliases> = [
    'createView',
    'Fragment',
    'branch',
    'expr',
    'accessor',
    'withDirectives',
    'unref',
    'isRef'
  ]

  for (const apiName of apiNames) {
    if (vitarxImports.has(apiName)) {
      ctx.vitarxAliases[apiName] = vitarxImports.get(apiName)!
    } else if (allNames.has(apiName)) {
      ctx.vitarxAliases[apiName] = generateUniqueAlias(apiName, allNames)
    }
  }

  if (ctx.options.hmr) {
    ctx.vitarxAliases.createView = generateUniqueAlias('jsxDEV', allNames)
  }

  if (vitarxImports.has('builder')) {
    ctx.builderAlias = vitarxImports.get('builder')!
  }
}

/**
 * 收集 ref 相关信息
 */
function collectRefInfo(ctx: TransformContext, program: t.Program): void {
  const refApiAliases = collectRefApiAliases(program)
  ctx.refApiAliases = refApiAliases
  ctx.refVariables = collectRefVariables(program, refApiAliases)
  ctx.nonRefVariables = collectNonRefVariables(program)
}
/**
 * 转换 AST
 */
function transformAST(ast: t.File, ctx: TransformContext): void {
  const babelTraverse: typeof traverse =
    typeof traverse === 'object' ? (traverse as any).default : traverse
  babelTraverse(ast, {
    JSXElement: {
      enter(path) {
        if (ctx.processedNodes.has(path.node)) return
        const name = getJSXElementName(path.node)
        if (name && isPureCompileComponent(name)) {
          ctx.processedNodes.add(path.node)
          processPureCompileComponent(path, ctx)
        } else {
          processVIfChain(path, ctx, transformJSXElement)
        }
      },
      exit(path) {
        if (ctx.processedNodes.has(path.node)) return
        const name = getJSXElementName(path.node)
        if (name && isPureCompileComponent(name)) return
        ctx.processedNodes.add(path.node)
        processJSXElement(path, ctx)
      }
    },
    JSXFragment: {
      enter(path) {
        processVIfChain(path, ctx, transformJSXElement)
      },
      exit(path) {
        if (ctx.processedNodes.has(path.node)) return
        ctx.processedNodes.add(path.node)
        processJSXFragment(path, ctx)
      }
    }
  })
}

/**
 * 生成代码
 */
function generateCode(
  ast: t.File,
  code: string,
  id: string,
  sourceMap: boolean | 'inline' | 'both'
): TransformResult {
  const babelGenerate: typeof generate =
    typeof generate === 'object' ? (generate as any).default : generate
  const output = babelGenerate(
    ast,
    { sourceMaps: !!sourceMap, filename: id, sourceFileName: id },
    code
  )
  return { code: output.code, map: output.map }
}

/**
 * 检查文件是否需要转换
 */
export function shouldTransform(id: string): boolean {
  const ext = id.split('?')[0].split('.').pop()?.toLowerCase()
  return ext === 'jsx' || ext === 'tsx'
}

/**
 * 检查是否为入口文件
 * 入口文件（如 src/main.tsx/src/main.jsx）不应注入 HMR，因为主脚本重新执行会导致页面内容重复
 * 最佳实践：入口文件应为 main.ts/main.js，组件应放在 App.tsx/App.jsx 等专门的组件文件中
 */
function isEntryFile(id: string): boolean {
  const normalizedId = id.split('?')[0]
  return entryPatterns.some(pattern => pattern.test(normalizedId))
}
/**
 * 转换 JSX/TSX 代码
 */
export async function transform(
  code: string,
  id: string,
  options: CompileOptions
): Promise<TransformResult | null> {
  const ast = parse(code, createParserOptions())
  const ctx = createContext(code, id, options, ast)

  setupAliases(ctx, ast.program)

  collectRefInfo(ctx, ast.program)

  const components = collectComponentFunctions(ast.program, ctx.builderAlias)

  transformAST(ast, ctx)

  injectImports(ast.program, ctx)

  if (options.hmr && components.length > 0 && !isEntryFile(id)) {
    injectHMRSupport(ast.program, components, id)
  }

  return generateCode(ast, code, id, options.sourceMap)
}
