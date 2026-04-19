import {
  arrowFunctionExpression,
  blockStatement,
  callExpression,
  exportDefaultDeclaration,
  exportNamedDeclaration,
  expressionStatement,
  functionDeclaration,
  functionExpression,
  identifier,
  program,
  variableDeclaration,
  variableDeclarator
} from '@babel/types'
import { describe, expect, it } from 'vitest'
import { collectComponentFunctions } from '../../src/utils/component-collect.js'

describe('component-collect', () => {
  describe('collectComponentFunctions', () => {
    it('收集普通函数声明组件', () => {
      const ast = program([functionDeclaration(identifier('MyComponent'), [], blockStatement([]))])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('收集导出的函数声明组件', () => {
      const fnDecl = functionDeclaration(identifier('MyComponent'), [], blockStatement([]))
      const ast = program([exportNamedDeclaration(fnDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('MyComponent')
      expect(components[0].isWrapped).toBeFalsy()
    })

    it('收集导出的箭头函数组件', () => {
      const varDecl = variableDeclaration('const', [
        variableDeclarator(
          identifier('MyComponent'),
          arrowFunctionExpression([], blockStatement([]))
        )
      ])
      const ast = program([exportNamedDeclaration(varDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('MyComponent')
      expect(components[0].isWrapped).toBeFalsy()
    })

    it('收集导出的函数表达式组件', () => {
      const varDecl = variableDeclaration('const', [
        variableDeclarator(
          identifier('MyComponent'),
          functionExpression(null, [], blockStatement([]))
        )
      ])
      const ast = program([exportNamedDeclaration(varDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('MyComponent')
    })

    it('收集默认导出的命名函数', () => {
      const fnDecl = functionDeclaration(identifier('MyComponent'), [], blockStatement([]))
      const ast = program([exportDefaultDeclaration(fnDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('MyComponent')
    })

    it('收集默认导出的匿名函数', () => {
      const fnDecl = functionDeclaration(null, [], blockStatement([]))
      const ast = program([exportDefaultDeclaration(fnDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
    })

    it('收集默认导出的箭头函数', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const ast = program([exportDefaultDeclaration(arrowFn)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
    })

    it('收集默认导出的函数表达式', () => {
      const fnExpr = functionExpression(null, [], blockStatement([]))
      const ast = program([exportDefaultDeclaration(fnExpr)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
    })

    it('忽略小写开头的函数', () => {
      const fnDecl = functionDeclaration(identifier('helper'), [], blockStatement([]))
      const ast = program([exportNamedDeclaration(fnDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('忽略非导出的组件', () => {
      const ast = program([functionDeclaration(identifier('MyComponent'), [], blockStatement([]))])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('收集多个组件', () => {
      const fnDecl1 = functionDeclaration(identifier('ComponentA'), [], blockStatement([]))
      const fnDecl2 = functionDeclaration(identifier('ComponentB'), [], blockStatement([]))
      const ast = program([exportNamedDeclaration(fnDecl1), exportNamedDeclaration(fnDecl2)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(2)
      expect(components.map(c => c.name)).toContain('ComponentA')
      expect(components.map(c => c.name)).toContain('ComponentB')
    })

    it('默认导出名称冲突时生成唯一名称', () => {
      const fnDecl1 = functionDeclaration(identifier('DefaultExport'), [], blockStatement([]))
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const ast = program([exportNamedDeclaration(fnDecl1), exportDefaultDeclaration(arrowFn)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(2)
      const names = components.map(c => c.name)
      expect(names).toContain('DefaultExport')
      expect(names).toContain('_defaultExport')
    })

    it('处理变量声明中的非函数', () => {
      const varDecl = variableDeclaration('const', [
        variableDeclarator(identifier('MyComponent'), identifier('OtherComponent'))
      ])
      const ast = program([exportNamedDeclaration(varDecl)])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('处理命名导出的标识符', () => {
      const ast = program([
        exportNamedDeclaration(null, [
          {
            type: 'ExportSpecifier',
            local: identifier('MyComponent'),
            exported: identifier('MyComponent')
          } as any
        ])
      ])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('默认导出标识符引用', () => {
      const ast = program([exportDefaultDeclaration(identifier('MyComponent'))])
      const components = collectComponentFunctions(ast)
      expect(components.length).toBe(0)
    })

    it('提取默认导出调用表达式中的箭头函数', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [arrowFn])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, null)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
      expect(components[0].isWrapped).toBe(false)
      expect(callExpr.arguments[0].type).toBe('Identifier')
      expect((callExpr.arguments[0] as any).name).toBe('_defaultExport')
      expect(ast.body.length).toBe(2)
      expect(ast.body[0].type).toBe('FunctionDeclaration')
    })

    it('提取默认导出调用表达式中的函数表达式', () => {
      const fnExpr = functionExpression(null, [], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [fnExpr])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, null)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
      expect(components[0].isWrapped).toBe(false)
      expect(callExpr.arguments[0].type).toBe('Identifier')
    })

    it('builder 包装的组件标记为 isWrapped', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('builder'), [arrowFn])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, 'builder')
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport')
      expect(components[0].isWrapped).toBe(true)
    })

    it('builder 别名包装的组件标记为 isWrapped', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('myBuilder'), [arrowFn])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, 'myBuilder')
      expect(components.length).toBe(1)
      expect(components[0].isWrapped).toBe(true)
    })

    it('非 builder 包装的组件不标记 isWrapped', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [arrowFn])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, 'builder')
      expect(components.length).toBe(1)
      expect(components[0].isWrapped).toBe(false)
    })

    it('调用表达式无函数参数时不收集', () => {
      const callExpr = callExpression(identifier('defineComponent'), [identifier('Other')])
      const ast = program([exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, null)
      expect(components.length).toBe(0)
    })

    it('调用表达式提取后正确插入到导出语句前', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [arrowFn])
      const ast = program([exportDefaultDeclaration(callExpr)])
      collectComponentFunctions(ast, null)
      expect(ast.body.length).toBe(2)
      expect(ast.body[0].type).toBe('FunctionDeclaration')
      expect(ast.body[1].type).toBe('ExportDefaultDeclaration')
    })

    it('避免与模块内已有变量名冲突', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [arrowFn])
      const ast = program([
        variableDeclaration('const', [
          variableDeclarator(identifier('_defaultExport'), identifier('foo'))
        ]),
        exportDefaultDeclaration(callExpr)
      ])
      const components = collectComponentFunctions(ast, null)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport$1')
      expect(callExpr.arguments[0].type).toBe('Identifier')
      expect((callExpr.arguments[0] as any).name).toBe('_defaultExport$1')
    })

    it('避免与导入的名称冲突', () => {
      const arrowFn = arrowFunctionExpression([], blockStatement([]))
      const callExpr = callExpression(identifier('defineComponent'), [arrowFn])
      const importDecl = {
        type: 'ImportDeclaration',
        specifiers: [{ type: 'ImportDefaultSpecifier', local: identifier('_defaultExport') }],
        source: { type: 'StringLiteral', value: 'some-module' }
      } as any
      const ast = program([importDecl, exportDefaultDeclaration(callExpr)])
      const components = collectComponentFunctions(ast, null)
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('_defaultExport$1')
    })

    it('函数声明 + builder(Comp) + export default 标记为 isWrapped', () => {
      const fnDecl = functionDeclaration(identifier('Comp'), [], blockStatement([]))
      const builderCall = expressionStatement(callExpression(identifier('builder'), [identifier('Comp')]))
      const ast = program([fnDecl, builderCall, exportDefaultDeclaration(identifier('Comp'))])
      const components = collectComponentFunctions(ast, 'builder')
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('Comp')
      expect(components[0].isWrapped).toBe(true)
    })

    it('变量声明 + builder(Comp) + export default 标记为 isWrapped', () => {
      const varDecl = variableDeclaration('const', [
        variableDeclarator(identifier('Comp'), arrowFunctionExpression([], blockStatement([])))
      ])
      const builderCall = expressionStatement(callExpression(identifier('builder'), [identifier('Comp')]))
      const ast = program([varDecl, builderCall, exportDefaultDeclaration(identifier('Comp'))])
      const components = collectComponentFunctions(ast, 'builder')
      expect(components.length).toBe(1)
      expect(components[0].name).toBe('Comp')
      expect(components[0].isWrapped).toBe(true)
    })

    it('builder 别名调用也能正确标记', () => {
      const fnDecl = functionDeclaration(identifier('Comp'), [], blockStatement([]))
      const builderCall = expressionStatement(callExpression(identifier('myBuilder'), [identifier('Comp')]))
      const ast = program([fnDecl, builderCall, exportDefaultDeclaration(identifier('Comp'))])
      const components = collectComponentFunctions(ast, 'myBuilder')
      expect(components.length).toBe(1)
      expect(components[0].isWrapped).toBe(true)
    })

    it('未被 builder 调用的组件不标记 isWrapped', () => {
      const fnDecl = functionDeclaration(identifier('Comp'), [], blockStatement([]))
      const ast = program([fnDecl, exportDefaultDeclaration(identifier('Comp'))])
      const components = collectComponentFunctions(ast, 'builder')
      expect(components.length).toBe(1)
      expect(components[0].isWrapped).toBe(false)
    })
  })
})
