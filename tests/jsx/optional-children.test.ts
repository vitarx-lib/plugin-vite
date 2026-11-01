/** 可选链 children 必须延迟求值，避免初始 null 被固化为静态文本。 */
import { describe, expect, it } from 'vitest'
import { compile, devOptions } from '../test-utils.js'

describe('JSX 可选链子表达式', () => {
  it.each([
    'target.value?.name',
    'target.value?.profile?.name',
    'target.value?.[key]',
    'formatter?.(value)',
    'target.value?.format()',
    'target.value.format?.()'
  ])('为 %s 创建响应式表达式且保留可选链语义', async (expression): Promise<void> => {
    const output = await compile(`const App = () => <p>{${expression}}</p>`)
    expect(output).toContain(`expr(() => ${expression})`)
  })

  it('混合文本和条件分支中的可选链同样建立追踪', async (): Promise<void> => {
    const output = await compile(`const App = () => <p>分类「{show ? target.value?.name : fallback?.()}」</p>`)
    expect(output).toContain('expr(() => target.value?.name)')
    expect(output).toContain('expr(() => fallback?.())')
  })

  it('开发模式与生产模式使用相同的响应式包装', async (): Promise<void> => {
    const output = await compile(`const App = () => <p>{target.value?.name}</p>`, devOptions)
    expect(output).toContain('expr(() => target.value?.name)')
  })
})
