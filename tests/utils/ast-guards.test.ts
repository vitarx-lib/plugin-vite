import { describe, expect, it } from 'vitest'
import { jsxText } from '@babel/types'
import { isWhitespaceJSXText } from '../../src/utils/ast-guards.js'

describe('ast-guards', () => {
  describe('isWhitespaceJSXText', () => {
    it('纯空白文本返回 true', () => {
      const node = jsxText('   ')
      expect(isWhitespaceJSXText(node)).toBe(true)
    })

    it('包含换行符的空白文本返回 true', () => {
      const node = jsxText('\n\t  \n')
      expect(isWhitespaceJSXText(node)).toBe(true)
    })

    it('空字符串返回 true', () => {
      const node = jsxText('')
      expect(isWhitespaceJSXText(node)).toBe(true)
    })

    it('包含非空白字符返回 false', () => {
      const node = jsxText('hello')
      expect(isWhitespaceJSXText(node)).toBe(false)
    })

    it('混合空白和非空白字符返回 false', () => {
      const node = jsxText('  hello  ')
      expect(isWhitespaceJSXText(node)).toBe(false)
    })

    it('非 JSXText 节点返回 false', () => {
      const node = { type: 'Identifier', name: 'test' }
      expect(isWhitespaceJSXText(node as any)).toBe(false)
    })
  })
})
