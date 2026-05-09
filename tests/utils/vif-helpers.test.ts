import {
  identifier,
  jsxAttribute,
  jsxClosingElement,
  jsxElement,
  jsxExpressionContainer,
  jsxIdentifier,
  jsxOpeningElement,
  jsxText
} from '@babel/types'
import { describe, expect, it } from 'vitest'
import {
  collectFragmentVIfChains,
  collectVIfChainInfo,
  validateVIfChain
} from '../../src/utils/vif-helpers.js'

function createJSXElement(tagName: string, attributes: any[] = [], children: any[] = []): any {
  return jsxElement(
    jsxOpeningElement(jsxIdentifier(tagName), attributes),
    jsxClosingElement(jsxIdentifier(tagName)),
    children
  )
}

function createVIfElement(condition?: any): any {
  const attr = jsxAttribute(
    jsxIdentifier('v-if'),
    condition ? jsxExpressionContainer(condition) : undefined
  )
  return createJSXElement('div', [attr])
}

function createVElseIfElement(condition?: any): any {
  const attr = jsxAttribute(
    jsxIdentifier('v-else-if'),
    condition ? jsxExpressionContainer(condition) : undefined
  )
  return createJSXElement('div', [attr])
}

function createVElseElement(): any {
  const attr = jsxAttribute(jsxIdentifier('v-else'))
  return createJSXElement('div', [attr])
}

describe('vif-helpers', () => {
  describe('validateVIfChain', () => {
    it('空数组不报错', () => {
      expect(() => validateVIfChain([])).not.toThrow()
    })

    it('有效的 v-if 链不报错', () => {
      const elements = [
        createVIfElement(identifier('a')),
        createVElseIfElement(identifier('b')),
        createVElseElement()
      ]
      expect(() => validateVIfChain(elements)).not.toThrow()
    })

    it('第一个元素没有 v-if 时报错', () => {
      const elements = [createVElseIfElement(identifier('a'))]
      expect(() => validateVIfChain(elements)).toThrow('[E008]')
    })

    it('中间元素缺少 v-else-if 或 v-else 时报错', () => {
      const elements = [createVIfElement(identifier('a')), createJSXElement('div')]
      expect(() => validateVIfChain(elements)).toThrow('[E008]')
    })

    it('v-else 不是最后一个元素时报错', () => {
      const elements = [
        createVIfElement(identifier('a')),
        createVElseElement(),
        createVIfElement(identifier('b'))
      ]
      expect(() => validateVIfChain(elements)).toThrow('[E008]')
    })

    it('v-else-if 跟在 v-else 后面时报错', () => {
      const elements = [
        createVIfElement(identifier('a')),
        createVElseElement(),
        createVElseIfElement(identifier('b'))
      ]
      expect(() => validateVIfChain(elements)).toThrow('[E008]')
    })
  })

  describe('collectVIfChainInfo', () => {
    it('收集 v-if 条件', () => {
      const elements = [createVIfElement(identifier('show'))]
      const info = collectVIfChainInfo(elements)
      expect(info.conditions.length).toBe(1)
      expect(info.conditions[0].type).toBe('Identifier')
    })

    it('收集 v-if/v-else-if/v-else 链', () => {
      const elements = [
        createVIfElement(identifier('a')),
        createVElseIfElement(identifier('b')),
        createVElseElement()
      ]
      const info = collectVIfChainInfo(elements)
      expect(info.conditions.length).toBe(3)
      expect(info.conditions[0].type).toBe('Identifier')
      expect(info.conditions[1].type).toBe('Identifier')
      expect(info.conditions[2].type).toBe('BooleanLiteral')
      expect((info.conditions[2] as any).value).toBe(true)
    })

    it('返回正确的节点和结束索引', () => {
      const elements = [createVIfElement(identifier('a')), createVElseIfElement(identifier('b'))]
      const info = collectVIfChainInfo(elements)
      expect(info.nodes.length).toBe(2)
      expect(info.endIndex).toBe(1)
    })

    it('元素缺少指令时报错', () => {
      const elements = [createJSXElement('div')]
      expect(() => collectVIfChainInfo(elements)).toThrow('[E008]')
    })
  })

  describe('collectFragmentVIfChains', () => {
    it('收集单个 v-if 链', () => {
      const children = [
        createVIfElement(identifier('a')),
        createVElseIfElement(identifier('b')),
        createVElseElement()
      ]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(1)
      expect(chains[0].conditions.length).toBe(3)
    })

    it('收集多个独立的 v-if 链', () => {
      const children = [
        createVIfElement(identifier('a')),
        createVElseElement(),
        createVIfElement(identifier('b')),
        createVElseElement()
      ]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(2)
      expect(chains[0].conditions.length).toBe(2)
      expect(chains[1].conditions.length).toBe(2)
    })

    it('跳过空白文本节点', () => {
      const children = [createVIfElement(identifier('a')), jsxText('\n  '), createVElseElement()]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(1)
      expect(chains[0].conditions.length).toBe(2)
    })

    it('跳过非 JSX 元素（不中断 v-if 链）', () => {
      const children = [createVIfElement(identifier('a')), createVElseElement()]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(1)
    })

    it('跳过非 v-if 链元素', () => {
      const children = [
        createJSXElement('div'),
        createVIfElement(identifier('a')),
        createVElseElement()
      ]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(1)
    })

    it('v-else-if 没有前置 v-if 时报错', () => {
      const children = [createVElseIfElement(identifier('a'))]
      expect(() => collectFragmentVIfChains(children)).toThrow('[E004]')
    })

    it('v-else 没有前置 v-if 时报错', () => {
      const children = [createVElseElement()]
      expect(() => collectFragmentVIfChains(children)).toThrow('[E003]')
    })

    it('返回正确的结束索引', () => {
      const children = [
        createVIfElement(identifier('a')),
        createVElseIfElement(identifier('b')),
        createVElseElement(),
        createJSXElement('span')
      ]
      const chains = collectFragmentVIfChains(children)
      expect(chains.length).toBe(1)
      expect(chains[0].endIndex).toBe(2)
    })
  })
})
