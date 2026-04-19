import { describe, expect, it } from 'vitest'
import {
  identifier,
  stringLiteral,
  numericLiteral,
  objectExpression,
  objectProperty,
  nullLiteral
} from '@babel/types'
import {
  createUnrefCall,
  createAccessCall,
  createDynamicCall,
  createBranchCall,
  createCreateViewCall,
  createWithDirectivesCall,
  createArrowFunction,
  createLocationObject,
  addPureComment,
  getAlias
} from '../../src/utils/ast-builders.js'
import type { VitarxImportAliases, TransformContext } from '../../src/context.js'

function createAliases(partial: Partial<VitarxImportAliases> = {}): VitarxImportAliases {
  return {
    createView: null,
    Fragment: null,
    branch: null,
    dynamic: null,
    access: null,
    withDirectives: null,
    unref: null,
    isRef: null,
    ...partial
  }
}

function createMockContext(): TransformContext {
  return {
    pureCommentedNodes: new WeakSet()
  } as any
}

describe('ast-builders', () => {
  describe('createUnrefCall', () => {
    it('创建 unref 调用（无别名）', () => {
      const arg = identifier('value')
      const call = createUnrefCall(arg)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('unref')
      expect(call.arguments.length).toBe(1)
      expect(call.arguments[0]).toBe(arg)
    })

    it('创建 unref 调用（有别名）', () => {
      const arg = identifier('value')
      const call = createUnrefCall(arg, '_unref')
      expect((call.callee as any).name).toBe('_unref')
    })
  })

  describe('createAccessCall', () => {
    it('创建 access 调用（标识符键）', () => {
      const obj = identifier('state')
      const key = identifier('name')
      const call = createAccessCall(obj, key)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('access')
      expect(call.arguments.length).toBe(2)
      expect(call.arguments[0]).toBe(obj)
      expect((call.arguments[1] as any).type).toBe('StringLiteral')
      expect((call.arguments[1] as any).value).toBe('name')
    })

    it('创建 access 调用（字符串键）', () => {
      const obj = identifier('state')
      const key = stringLiteral('name')
      const call = createAccessCall(obj, key)
      expect((call.arguments[1] as any).value).toBe('name')
    })

    it('创建 access 调用（有别名）', () => {
      const obj = identifier('state')
      const key = identifier('name')
      const call = createAccessCall(obj, key, '_access')
      expect((call.callee as any).name).toBe('_access')
    })
  })

  describe('createDynamicCall', () => {
    it('创建 dynamic 调用（无位置信息）', () => {
      const arg = identifier('value')
      const call = createDynamicCall(arg)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('dynamic')
      expect(call.arguments.length).toBe(1)
      expect((call.arguments[0] as any).type).toBe('ArrowFunctionExpression')
    })

    it('创建 dynamic 调用（有位置信息）', () => {
      const arg = identifier('value')
      const locInfo = objectExpression([])
      const call = createDynamicCall(arg, undefined, locInfo)
      expect(call.arguments.length).toBe(2)
      expect(call.arguments[1]).toBe(locInfo)
    })

    it('创建 dynamic 调用（有别名）', () => {
      const arg = identifier('value')
      const call = createDynamicCall(arg, '_dynamic')
      expect((call.callee as any).name).toBe('_dynamic')
    })
  })

  describe('createBranchCall', () => {
    it('创建 branch 调用（无位置信息）', () => {
      const condition = createArrowFunction(identifier('show'))
      const branches = [createArrowFunction(identifier('a')), createArrowFunction(identifier('b'))]
      const call = createBranchCall(condition, branches)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('branch')
      expect(call.arguments.length).toBe(2)
      expect(call.arguments[0]).toBe(condition)
      expect((call.arguments[1] as any).type).toBe('ArrayExpression')
    })

    it('创建 branch 调用（有位置信息）', () => {
      const condition = createArrowFunction(identifier('show'))
      const branches = [createArrowFunction(identifier('a'))]
      const locInfo = objectExpression([])
      const call = createBranchCall(condition, branches, undefined, locInfo)
      expect(call.arguments.length).toBe(3)
      expect(call.arguments[2]).toBe(locInfo)
    })

    it('创建 branch 调用（有别名）', () => {
      const condition = createArrowFunction(identifier('show'))
      const branches = [createArrowFunction(identifier('a'))]
      const call = createBranchCall(condition, branches, '_branch')
      expect((call.callee as any).name).toBe('_branch')
    })
  })

  describe('createCreateViewCall', () => {
    it('创建 createView 调用（仅类型）', () => {
      const type = stringLiteral('div')
      const call = createCreateViewCall(type, null)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('createView')
      expect(call.arguments.length).toBe(1)
      expect(call.arguments[0]).toBe(type)
    })

    it('创建 createView 调用（有 props）', () => {
      const type = stringLiteral('div')
      const props = objectExpression([objectProperty(identifier('class'), stringLiteral('foo'))])
      const call = createCreateViewCall(type, props)
      expect(call.arguments.length).toBe(2)
      expect(call.arguments[1]).toBe(props)
    })

    it('创建 createView 调用（有位置信息无 props）', () => {
      const type = stringLiteral('div')
      const locInfo = objectExpression([])
      const call = createCreateViewCall(type, null, locInfo)
      expect(call.arguments.length).toBe(3)
      expect(call.arguments[1]).toEqual(nullLiteral())
      expect(call.arguments[2]).toBe(locInfo)
    })

    it('创建 createView 调用（有 props 和位置信息）', () => {
      const type = stringLiteral('div')
      const props = objectExpression([])
      const locInfo = objectExpression([])
      const call = createCreateViewCall(type, props, locInfo)
      expect(call.arguments.length).toBe(3)
      expect(call.arguments[1]).toBe(props)
      expect(call.arguments[2]).toBe(locInfo)
    })

    it('创建 createView 调用（有别名）', () => {
      const type = stringLiteral('div')
      const call = createCreateViewCall(type, null, null, '_createView')
      expect((call.callee as any).name).toBe('_createView')
    })
  })

  describe('createWithDirectivesCall', () => {
    it('创建 withDirectives 调用', () => {
      const view = identifier('viewNode')
      const directives: [string, any][] = [
        ['show', identifier('isVisible')],
        ['model', identifier('value')]
      ]
      const call = createWithDirectivesCall(view, directives)
      expect(call.type).toBe('CallExpression')
      expect((call.callee as any).name).toBe('withDirectives')
      expect(call.arguments.length).toBe(2)
      expect(call.arguments[0]).toBe(view)
      expect((call.arguments[1] as any).type).toBe('ArrayExpression')
      expect((call.arguments[1] as any).elements.length).toBe(2)
    })

    it('创建 withDirectives 调用（空指令数组）', () => {
      const view = identifier('viewNode')
      const call = createWithDirectivesCall(view, [])
      expect((call.arguments[1] as any).elements.length).toBe(0)
    })

    it('创建 withDirectives 调用（有别名）', () => {
      const view = identifier('viewNode')
      const call = createWithDirectivesCall(view, [], '_withDirectives')
      expect((call.callee as any).name).toBe('_withDirectives')
    })
  })

  describe('createArrowFunction', () => {
    it('创建箭头函数', () => {
      const body = identifier('value')
      const fn = createArrowFunction(body)
      expect(fn.type).toBe('ArrowFunctionExpression')
      expect(fn.params.length).toBe(0)
      expect(fn.body).toBe(body)
    })
  })

  describe('createLocationObject', () => {
    it('创建位置信息对象', () => {
      const loc = {
        start: { line: 10, column: 5 },
        end: { line: 10, column: 20 }
      }
      const obj = createLocationObject('test.tsx', loc as any)
      expect(obj.type).toBe('ObjectExpression')
      expect(obj.properties.length).toBe(3)
      const props = obj.properties as any[]
      expect(props[0].key.name).toBe('fileName')
      expect(props[0].value.value).toBe('test.tsx')
      expect(props[1].key.name).toBe('lineNumber')
      expect(props[1].value.value).toBe(10)
      expect(props[2].key.name).toBe('columnNumber')
      expect(props[2].value.value).toBe(6)
    })
  })

  describe('addPureComment', () => {
    it('添加 PURE 注释', () => {
      const ctx = createMockContext()
      const call = createUnrefCall(identifier('value'))
      const result = addPureComment(call, ctx)
      expect(result).toBe(call)
      expect(call.leadingComments).toBeDefined()
      expect(call.leadingComments?.[0]?.value).toContain('__PURE__')
    })

    it('重复添加不会重复注释', () => {
      const ctx = createMockContext()
      const call = createUnrefCall(identifier('value'))
      addPureComment(call, ctx)
      addPureComment(call, ctx)
      expect(call.leadingComments?.length).toBe(1)
    })
  })

  describe('getAlias', () => {
    it('无别名时返回原名', () => {
      const aliases = createAliases()
      expect(getAlias(aliases, 'unref')).toBe('unref')
    })

    it('有别名时返回别名', () => {
      const aliases = createAliases({ unref: '_unref' })
      expect(getAlias(aliases, 'unref')).toBe('_unref')
    })

    it('其他 API 的别名', () => {
      const aliases = createAliases({
        createView: '_createView',
        branch: '_branch',
        dynamic: '_dynamic'
      })
      expect(getAlias(aliases, 'createView')).toBe('_createView')
      expect(getAlias(aliases, 'branch')).toBe('_branch')
      expect(getAlias(aliases, 'dynamic')).toBe('_dynamic')
    })
  })
})
