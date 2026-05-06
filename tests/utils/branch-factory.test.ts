import {
  arrowFunctionExpression,
  booleanLiteral,
  file,
  identifier,
  logicalExpression,
  program,
  stringLiteral
} from '@babel/types'
import { describe, expect, it } from 'vitest'
import type { TransformContext } from '../../src/context.js'
import {
  buildNestedCondition,
  createBinaryBranch,
  createBranch
} from '../../src/utils/branch-factory.js'

function createMockContext(): TransformContext {
  return {
    code: '',
    id: '/test.tsx',
    filename: '/test.tsx',
    options: {
      hmr: false,
      dev: false,
      ssr: false,
      runtimeModule: 'vitarx',
      sourceMap: false,
      transformClassNameToClass: false
    },
    ast: file(program([])),
    imports: {
      createView: false,
      Fragment: false,
      branch: false,
      expr: false,
      accessor: false,
      withDirectives: false,
      unref: false,
      isRef: false
    },
    existingImports: new Set(),
    vitarxAliases: {
      createView: null,
      Fragment: null,
      branch: null,
      expr: null,
      accessor: null,
      withDirectives: null,
      unref: null,
      isRef: null
    },
    refApiAliases: {
      ref: null,
      toRef: null,
      toRefs: null,
      shallowRef: null,
      computed: null
    },
    refVariables: new Set(),
    builderAlias: null,
    processedNodes: new WeakSet(),
    pureCommentedNodes: new WeakSet(),
    warnings: []
  }
}

describe('branch-factory', () => {
  describe('buildNestedCondition', () => {
    it('空条件数组返回 null', () => {
      const ctx = createMockContext()
      const result = buildNestedCondition([], ctx)
      expect(result.type).toBe('NullLiteral')
    })

    it('单个条件返回条件表达式', () => {
      const ctx = createMockContext()
      const conditions = [identifier('show')]
      const result = buildNestedCondition(conditions, ctx)
      expect(result.type).toBe('ConditionalExpression')
    })

    it('标识符条件使用 unref 包装', () => {
      const ctx = createMockContext()
      const conditions = [identifier('show')]
      const result = buildNestedCondition(conditions, ctx)
      expect(result.type).toBe('ConditionalExpression')
      const cond = (result as any).test
      expect(cond.type).toBe('CallExpression')
      expect(cond.callee.name).toBe('unref')
    })

    it('非标识符条件不使用 unref 包装', () => {
      const ctx = createMockContext()
      const conditions = [stringLiteral('test')]
      const result = buildNestedCondition(conditions, ctx, false)
      expect(result.type).toBe('ConditionalExpression')
      const cond = (result as any).test
      expect(cond.type).toBe('StringLiteral')
    })

    it('v-else 条件（布尔 true）返回数字索引', () => {
      const ctx = createMockContext()
      const conditions = [identifier('show'), booleanLiteral(true)]
      const result = buildNestedCondition(conditions, ctx)
      expect(result.type).toBe('ConditionalExpression')
    })

    it('多个条件构建嵌套三元表达式', () => {
      const ctx = createMockContext()
      const conditions = [identifier('a'), identifier('b'), booleanLiteral(true)]
      const result = buildNestedCondition(conditions, ctx)
      expect(result.type).toBe('ConditionalExpression')
    })

    it('复杂表达式条件添加括号', () => {
      const ctx = createMockContext()
      const complexCond = logicalExpression('&&', identifier('a'), identifier('b'))
      const conditions = [complexCond]
      const result = buildNestedCondition(conditions, ctx, false)
      expect(result.type).toBe('ConditionalExpression')
      const cond = (result as any).test
      expect(cond.type).toBe('ParenthesizedExpression')
    })

    it('useRef=false 时不使用 unref', () => {
      const ctx = createMockContext()
      const conditions = [identifier('show')]
      const result = buildNestedCondition(conditions, ctx, false)
      expect(result.type).toBe('ConditionalExpression')
      const cond = (result as any).test
      expect(cond.type).toBe('Identifier')
    })
  })

  describe('createBranch', () => {
    it('创建 branch 调用', () => {
      const ctx = createMockContext()
      const config = {
        conditions: [identifier('show')],
        branches: [arrowFunctionExpression([], identifier('a'))]
      }
      const call = createBranch(config, ctx)
      expect(call.type).toBe('CallExpression')
      expect(ctx.imports.branch).toBe(true)
    })

    it('标识符条件标记 unref 导入', () => {
      const ctx = createMockContext()
      const config = {
        conditions: [identifier('show')],
        branches: [arrowFunctionExpression([], identifier('a'))]
      }
      createBranch(config, ctx)
      expect(ctx.imports.unref).toBe(true)
    })

    it('非标识符条件不标记 unref 导入', () => {
      const ctx = createMockContext()
      const config = {
        conditions: [stringLiteral('test')],
        branches: [arrowFunctionExpression([], identifier('a'))]
      }
      createBranch(config, ctx)
      expect(ctx.imports.unref).toBe(false)
    })

    it('useRef=false 时不标记 unref 导入', () => {
      const ctx = createMockContext()
      const config = {
        conditions: [identifier('show')],
        branches: [arrowFunctionExpression([], identifier('a'))],
        useRef: false
      }
      createBranch(config, ctx)
      expect(ctx.imports.unref).toBe(false)
    })

    it('添加 PURE 注释', () => {
      const ctx = createMockContext()
      const config = {
        conditions: [identifier('show')],
        branches: [arrowFunctionExpression([], identifier('a'))]
      }
      const call = createBranch(config, ctx)
      expect(call.leadingComments).toBeDefined()
      expect(call.leadingComments?.[0]?.value).toContain('__PURE__')
    })
  })

  describe('createBinaryBranch', () => {
    it('创建二元条件 branch', () => {
      const ctx = createMockContext()
      const call = createBinaryBranch(identifier('show'), identifier('a'), identifier('b'), ctx)
      expect(call.type).toBe('CallExpression')
      expect(ctx.imports.branch).toBe(true)
      expect(ctx.imports.unref).toBe(true)
    })

    it('非标识符条件不标记 unref', () => {
      const ctx = createMockContext()
      const call = createBinaryBranch(stringLiteral('test'), identifier('a'), identifier('b'), ctx)
      expect(ctx.imports.unref).toBe(false)
    })
  })
})
