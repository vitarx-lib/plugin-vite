import { describe, expect, it } from 'vitest'
import {
  jsxElement,
  jsxOpeningElement,
  jsxClosingElement,
  jsxIdentifier,
  jsxAttribute,
  jsxNamespacedName,
  jsxText,
  jsxExpressionContainer,
  identifier,
  stringLiteral,
  jsxEmptyExpression
} from '@babel/types'
import {
  getJSXElementName,
  isPureCompileComponent,
  isComponent,
  isNativeElement,
  getJSXAttributeByName,
  hasDirective,
  getDirectiveValue,
  isVIfChain,
  isVIf,
  isVElseIf,
  isVElse,
  removeVDirectives,
  removeVIfChainDirectives,
  removeAttribute,
  filterWhitespaceChildren,
  hasEffectiveChildren,
  filterEffectiveChildren
} from '../../src/utils/jsx-helpers.js'

function createJSXElement(
  tagName: string,
  attributes: any[] = [],
  children: any[] = []
): any {
  return jsxElement(
    jsxOpeningElement(jsxIdentifier(tagName), attributes),
    jsxClosingElement(jsxIdentifier(tagName)),
    children
  )
}

describe('jsx-helpers', () => {
  describe('getJSXElementName', () => {
    it('获取简单元素名称', () => {
      const element = createJSXElement('div')
      expect(getJSXElementName(element)).toBe('div')
    })

    it('获取组件名称', () => {
      const element = createJSXElement('MyComponent')
      expect(getJSXElementName(element)).toBe('MyComponent')
    })

    it('JSXNamespacedName 返回 null', () => {
      const element = jsxElement(
        jsxOpeningElement(jsxNamespacedName(jsxIdentifier('svg'), jsxIdentifier('path')), []),
        jsxClosingElement(jsxNamespacedName(jsxIdentifier('svg'), jsxIdentifier('path'))),
        []
      )
      expect(getJSXElementName(element)).toBe(null)
    })
  })

  describe('isPureCompileComponent', () => {
    it('IfBlock 是纯编译组件', () => {
      expect(isPureCompileComponent('IfBlock')).toBe(true)
    })

    it('Switch 是纯编译组件', () => {
      expect(isPureCompileComponent('Switch')).toBe(true)
    })

    it('Match 是纯编译组件', () => {
      expect(isPureCompileComponent('Match')).toBe(true)
    })

    it('普通组件不是纯编译组件', () => {
      expect(isPureCompileComponent('MyComponent')).toBe(false)
    })

    it('原生元素不是纯编译组件', () => {
      expect(isPureCompileComponent('div')).toBe(false)
    })
  })

  describe('isComponent', () => {
    it('首字母大写是组件', () => {
      expect(isComponent('MyComponent')).toBe(true)
    })

    it('首字母小写不是组件', () => {
      expect(isComponent('div')).toBe(false)
    })

    it('单个大写字母是组件', () => {
      expect(isComponent('A')).toBe(true)
    })

    it('单个小写字母不是组件', () => {
      expect(isComponent('a')).toBe(false)
    })
  })

  describe('isNativeElement', () => {
    it('首字母小写是原生元素', () => {
      expect(isNativeElement('div')).toBe(true)
    })

    it('首字母大写不是原生元素', () => {
      expect(isNativeElement('MyComponent')).toBe(false)
    })
  })

  describe('getJSXAttributeByName', () => {
    it('获取存在的属性', () => {
      const attr = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr])
      const result = getJSXAttributeByName(element, 'class')
      expect(result).toBe(attr)
    })

    it('属性不存在返回 undefined', () => {
      const element = createJSXElement('div')
      expect(getJSXAttributeByName(element, 'class')).toBeUndefined()
    })

    it('多个属性时正确获取', () => {
      const attr1 = jsxAttribute(jsxIdentifier('id'), stringLiteral('foo'))
      const attr2 = jsxAttribute(jsxIdentifier('class'), stringLiteral('bar'))
      const element = createJSXElement('div', [attr1, attr2])
      expect(getJSXAttributeByName(element, 'class')).toBe(attr2)
    })
  })

  describe('hasDirective', () => {
    it('检测 v-if 指令（JSXIdentifier 形式）', () => {
      const attr = jsxAttribute(jsxIdentifier('v-if'))
      const element = createJSXElement('div', [attr])
      expect(hasDirective(element, 'v-if')).toBe(true)
    })

    it('检测 v-if 指令（JSXNamespacedName 形式）', () => {
      const attr = jsxAttribute(
        jsxNamespacedName(jsxIdentifier('v'), jsxIdentifier('if'))
      )
      const element = createJSXElement('div', [attr])
      expect(hasDirective(element, 'v-if')).toBe(true)
    })

    it('指令不存在返回 false', () => {
      const element = createJSXElement('div')
      expect(hasDirective(element, 'v-if')).toBe(false)
    })

    it('检测 v-else-if 指令', () => {
      const attr = jsxAttribute(jsxIdentifier('v-else-if'))
      const element = createJSXElement('div', [attr])
      expect(hasDirective(element, 'v-else-if')).toBe(true)
    })

    it('检测 v-else 指令', () => {
      const attr = jsxAttribute(jsxIdentifier('v-else'))
      const element = createJSXElement('div', [attr])
      expect(hasDirective(element, 'v-else')).toBe(true)
    })
  })

  describe('getDirectiveValue', () => {
    it('获取表达式值', () => {
      const attr = jsxAttribute(
        jsxIdentifier('v-if'),
        jsxExpressionContainer(identifier('show'))
      )
      const element = createJSXElement('div', [attr])
      const value = getDirectiveValue(element, 'v-if')
      expect(value?.type).toBe('Identifier')
    })

    it('获取字符串值', () => {
      const attr = jsxAttribute(jsxIdentifier('v-if'), stringLiteral('condition'))
      const element = createJSXElement('div', [attr])
      const value = getDirectiveValue(element, 'v-if')
      expect(value?.type).toBe('StringLiteral')
    })

    it('无值时返回布尔 true', () => {
      const attr = jsxAttribute(jsxIdentifier('v-else'))
      const element = createJSXElement('div', [attr])
      const value = getDirectiveValue(element, 'v-else')
      expect(value?.type).toBe('BooleanLiteral')
    })

    it('指令不存在返回 null', () => {
      const element = createJSXElement('div')
      expect(getDirectiveValue(element, 'v-if')).toBeNull()
    })
  })

  describe('isVIfChain', () => {
    it('有 v-if 返回 true', () => {
      const attr = jsxAttribute(jsxIdentifier('v-if'))
      const element = createJSXElement('div', [attr])
      expect(isVIfChain(element)).toBe(true)
    })

    it('有 v-else-if 返回 true', () => {
      const attr = jsxAttribute(jsxIdentifier('v-else-if'))
      const element = createJSXElement('div', [attr])
      expect(isVIfChain(element)).toBe(true)
    })

    it('有 v-else 返回 true', () => {
      const attr = jsxAttribute(jsxIdentifier('v-else'))
      const element = createJSXElement('div', [attr])
      expect(isVIfChain(element)).toBe(true)
    })

    it('无 v-if 链指令返回 false', () => {
      const element = createJSXElement('div')
      expect(isVIfChain(element)).toBe(false)
    })
  })

  describe('isVIf / isVElseIf / isVElse', () => {
    it('isVIf 正确检测', () => {
      const element = createJSXElement('div', [jsxAttribute(jsxIdentifier('v-if'))])
      expect(isVIf(element)).toBe(true)
      expect(isVElseIf(element)).toBe(false)
      expect(isVElse(element)).toBe(false)
    })

    it('isVElseIf 正确检测', () => {
      const element = createJSXElement('div', [jsxAttribute(jsxIdentifier('v-else-if'))])
      expect(isVIf(element)).toBe(false)
      expect(isVElseIf(element)).toBe(true)
      expect(isVElse(element)).toBe(false)
    })

    it('isVElse 正确检测', () => {
      const element = createJSXElement('div', [jsxAttribute(jsxIdentifier('v-else'))])
      expect(isVIf(element)).toBe(false)
      expect(isVElseIf(element)).toBe(false)
      expect(isVElse(element)).toBe(true)
    })
  })

  describe('removeVDirectives', () => {
    it('移除 v- 开头的属性', () => {
      const attr1 = jsxAttribute(jsxIdentifier('v-if'))
      const attr2 = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr1, attr2])
      removeVDirectives(element)
      expect(element.openingElement.attributes.length).toBe(1)
      expect((element.openingElement.attributes[0] as any).name.name).toBe('class')
    })

    it('保留非 v- 开头的属性', () => {
      const attr1 = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const attr2 = jsxAttribute(jsxIdentifier('id'), stringLiteral('bar'))
      const element = createJSXElement('div', [attr1, attr2])
      removeVDirectives(element)
      expect(element.openingElement.attributes.length).toBe(2)
    })
  })

  describe('removeVIfChainDirectives', () => {
    it('移除 v-if、v-else-if、v-else 属性', () => {
      const attr1 = jsxAttribute(jsxIdentifier('v-if'))
      const attr2 = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr1, attr2])
      removeVIfChainDirectives(element)
      expect(element.openingElement.attributes.length).toBe(1)
    })

    it('保留其他 v- 指令', () => {
      const attr1 = jsxAttribute(jsxIdentifier('v-show'))
      const attr2 = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr1, attr2])
      removeVIfChainDirectives(element)
      expect(element.openingElement.attributes.length).toBe(2)
    })
  })

  describe('removeAttribute', () => {
    it('移除指定属性', () => {
      const attr = jsxAttribute(jsxIdentifier('class'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr])
      removeAttribute(element, 'class')
      expect(element.openingElement.attributes.length).toBe(0)
    })

    it('属性不存在时不做任何操作', () => {
      const attr = jsxAttribute(jsxIdentifier('id'), stringLiteral('foo'))
      const element = createJSXElement('div', [attr])
      removeAttribute(element, 'class')
      expect(element.openingElement.attributes.length).toBe(1)
    })
  })

  describe('filterWhitespaceChildren', () => {
    it('过滤空白文本节点', () => {
      const children = [jsxText('   '), jsxText('hello'), jsxText('\n\t')]
      const result = filterWhitespaceChildren(children)
      expect(result.length).toBe(1)
    })

    it('保留非空白文本节点', () => {
      const children = [jsxText('hello'), jsxText('world')]
      const result = filterWhitespaceChildren(children)
      expect(result.length).toBe(2)
    })

    it('保留其他类型节点', () => {
      const children = [jsxText('   '), createJSXElement('div')]
      const result = filterWhitespaceChildren(children)
      expect(result.length).toBe(1)
    })
  })

  describe('hasEffectiveChildren', () => {
    it('有非空白文本子节点返回 true', () => {
      const element = createJSXElement('div', [], [jsxText('hello')])
      expect(hasEffectiveChildren(element)).toBe(true)
    })

    it('有元素子节点返回 true', () => {
      const element = createJSXElement('div', [], [createJSXElement('span')])
      expect(hasEffectiveChildren(element)).toBe(true)
    })

    it('有表达式容器返回 true', () => {
      const element = createJSXElement('div', [], [
        jsxExpressionContainer(identifier('foo'))
      ])
      expect(hasEffectiveChildren(element)).toBe(true)
    })

    it('仅有空白文本返回 false', () => {
      const element = createJSXElement('div', [], [jsxText('   ')])
      expect(hasEffectiveChildren(element)).toBe(false)
    })

    it('仅有 JSXEmptyExpression 返回 false', () => {
      const element = createJSXElement('div', [], [
        jsxExpressionContainer(jsxEmptyExpression())
      ])
      expect(hasEffectiveChildren(element)).toBe(false)
    })

    it('无子节点返回 false', () => {
      const element = createJSXElement('div')
      expect(hasEffectiveChildren(element)).toBe(false)
    })
  })

  describe('filterEffectiveChildren', () => {
    it('过滤空白文本节点', () => {
      const element = createJSXElement('div', [], [
        jsxText('   '),
        jsxText('hello'),
        jsxText('\n')
      ])
      const result = filterEffectiveChildren(element)
      expect(result.length).toBe(1)
    })

    it('过滤 JSXEmptyExpression', () => {
      const element = createJSXElement('div', [], [
        jsxExpressionContainer(jsxEmptyExpression()),
        jsxText('hello')
      ])
      const result = filterEffectiveChildren(element)
      expect(result.length).toBe(1)
    })

    it('保留有效子节点', () => {
      const element = createJSXElement('div', [], [
        createJSXElement('span'),
        jsxExpressionContainer(identifier('foo'))
      ])
      const result = filterEffectiveChildren(element)
      expect(result.length).toBe(2)
    })
  })
})
