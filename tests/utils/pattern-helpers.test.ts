import { describe, expect, it } from 'vitest'
import {
  identifier,
  objectPattern,
  objectProperty,
  arrayPattern,
  restElement
} from '@babel/types'
import {
  collectPatternBindings,
  collectObjectPatternBindings
} from '../../src/utils/pattern-helpers.js'

describe('pattern-helpers', () => {
  describe('collectPatternBindings', () => {
    it('收集标识符变量名', () => {
      const variables = new Set<string>()
      collectPatternBindings(identifier('foo'), variables)
      expect(variables.has('foo')).toBe(true)
      expect(variables.size).toBe(1)
    })

    it('收集对象模式中的变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(identifier('a'), identifier('a')),
        objectProperty(identifier('b'), identifier('b'))
      ])
      collectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('b')).toBe(true)
      expect(variables.size).toBe(2)
    })

    it('收集嵌套对象模式中的变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(
          identifier('outer'),
          objectPattern([objectProperty(identifier('inner'), identifier('inner'))])
        )
      ])
      collectPatternBindings(pattern, variables)
      expect(variables.has('inner')).toBe(true)
      expect(variables.size).toBe(1)
    })

    it('收集数组模式中的变量名', () => {
      const variables = new Set<string>()
      const pattern = arrayPattern([identifier('a'), identifier('b'), null])
      collectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('b')).toBe(true)
      expect(variables.size).toBe(2)
    })

    it('收集包含 RestElement 的对象模式', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(identifier('a'), identifier('a')),
        restElement(identifier('rest'))
      ])
      collectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('rest')).toBe(true)
      expect(variables.size).toBe(2)
    })

    it('收集嵌套数组模式中的变量名', () => {
      const variables = new Set<string>()
      const pattern = arrayPattern([
        identifier('a'),
        arrayPattern([identifier('b'), identifier('c')])
      ])
      collectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('b')).toBe(true)
      expect(variables.has('c')).toBe(true)
      expect(variables.size).toBe(3)
    })

    it('收集混合嵌套模式中的变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(
          identifier('arr'),
          arrayPattern([identifier('first'), identifier('second')])
        )
      ])
      collectPatternBindings(pattern, variables)
      expect(variables.has('first')).toBe(true)
      expect(variables.has('second')).toBe(true)
      expect(variables.size).toBe(2)
    })
  })

  describe('collectObjectPatternBindings', () => {
    it('收集简单对象解构变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(identifier('a'), identifier('a')),
        objectProperty(identifier('b'), identifier('b'))
      ])
      collectObjectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('b')).toBe(true)
      expect(variables.size).toBe(2)
    })

    it('收集重命名的变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(identifier('originalName'), identifier('newName'))
      ])
      collectObjectPatternBindings(pattern, variables)
      expect(variables.has('newName')).toBe(true)
      expect(variables.has('originalName')).toBe(false)
      expect(variables.size).toBe(1)
    })

    it('收集嵌套对象解构变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(
          identifier('outer'),
          objectPattern([objectProperty(identifier('inner'), identifier('inner'))])
        )
      ])
      collectObjectPatternBindings(pattern, variables)
      expect(variables.has('inner')).toBe(true)
      expect(variables.size).toBe(1)
    })

    it('收集包含 RestElement 的对象解构', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(identifier('a'), identifier('a')),
        restElement(identifier('rest'))
      ])
      collectObjectPatternBindings(pattern, variables)
      expect(variables.has('a')).toBe(true)
      expect(variables.has('rest')).toBe(true)
      expect(variables.size).toBe(2)
    })

    it('收集多层嵌套对象解构变量名', () => {
      const variables = new Set<string>()
      const pattern = objectPattern([
        objectProperty(
          identifier('level1'),
          objectPattern([
            objectProperty(
              identifier('level2'),
              objectPattern([objectProperty(identifier('deep'), identifier('deep'))])
            )
          ])
        )
      ])
      collectObjectPatternBindings(pattern, variables)
      expect(variables.has('deep')).toBe(true)
      expect(variables.size).toBe(1)
    })
  })
})
