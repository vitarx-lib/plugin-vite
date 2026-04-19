import { describe, expect, it } from 'vitest'
import { generateUniqueAlias } from '../../src/utils/generate.js'

describe('generate', () => {
  describe('generateUniqueAlias', () => {
    it('基础名称不存在时返回原名称加 $1', () => {
      const existingNames = new Set<string>()
      expect(generateUniqueAlias('Component', existingNames)).toBe('Component$1')
    })

    it('基础名称存在时递增索引', () => {
      const existingNames = new Set<string>(['Component$1'])
      expect(generateUniqueAlias('Component', existingNames)).toBe('Component$2')
    })

    it('跳过已存在的索引', () => {
      const existingNames = new Set<string>(['Component$1', 'Component$2', 'Component$3'])
      expect(generateUniqueAlias('Component', existingNames)).toBe('Component$4')
    })

    it('中间有间隔时找到第一个可用索引', () => {
      const existingNames = new Set<string>(['Component$1', 'Component$3'])
      expect(generateUniqueAlias('Component', existingNames)).toBe('Component$2')
    })

    it('不同基础名称互不影响', () => {
      const existingNames = new Set<string>(['App$1', 'App$2'])
      expect(generateUniqueAlias('Component', existingNames)).toBe('Component$1')
    })

    it('空集合时返回基础名称加 $1', () => {
      const existingNames = new Set<string>()
      expect(generateUniqueAlias('Test', existingNames)).toBe('Test$1')
    })
  })
})
